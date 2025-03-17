import { getRedisClient } from "./redisClient";
import { createLogger } from "../enhancedLogger";

const logger = createLogger("redis-queue");

export interface QueueJob<T = any> {
  id: string;
  type: string;
  data: T;
  createdAt: number;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
}

export class RedisQueue {
  private queueName: string;
  private processingQueueName: string;

  constructor(queueName: string) {
    this.queueName = `queue:${queueName}`;
    this.processingQueueName = `queue:${queueName}:processing`;
  }

  async enqueue<T>(
    jobType: string,
    data: T,
    options: { maxAttempts?: number } = {}
  ): Promise<string> {
    const redis = getRedisClient();
    const jobId = `job:${jobType}:${Date.now()}:${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    const job: QueueJob<T> = {
      id: jobId,
      type: jobType,
      data,
      createdAt: Date.now(),
      status: "pending",
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
    };

    await redis.lpush(this.queueName, JSON.stringify(job));
    logger.info(`Enqueued job ${jobId} to ${this.queueName}`);

    return jobId;
  }

  async dequeue(): Promise<QueueJob | null> {
    const redis = getRedisClient();
    const jobData = await redis.rpoplpush(
      this.queueName,
      this.processingQueueName
    );

    if (!jobData) {
      return null;
    }

    try {
      const job = JSON.parse(jobData) as QueueJob;
      job.status = "processing";
      job.attempts += 1;

      // Update the job in the processing queue
      await redis.lset(
        this.processingQueueName,
        -1, // Last item in the list
        JSON.stringify(job)
      );

      return job;
    } catch (error) {
      logger.exception(error, {
        context: "Redis queue",
        operation: "dequeue",
        queueName: this.queueName,
        jobData,
      });

      // Remove invalid job from processing queue
      await redis.rpop(this.processingQueueName);
      return null;
    }
  }

  async complete(jobId: string): Promise<void> {
    const redis = getRedisClient();
    await this.removeFromProcessing(jobId);

    // Optionally store completed jobs in a separate list
    await redis.lpush(`${this.queueName}:completed`, jobId);
  }

  async fail(jobId: string, error: Error): Promise<void> {
    const redis = getRedisClient();

    // Use the enhanced logger's exception method
    logger.exception(error, {
      context: "Redis queue",
      operation: "jobFailed",
      queueName: this.queueName,
      jobId,
    });

    // Find the job in the processing queue
    const processingJobs = await redis.lrange(this.processingQueueName, 0, -1);

    for (let i = 0; i < processingJobs.length; i++) {
      try {
        const job = JSON.parse(processingJobs[i]) as QueueJob;

        if (job.id === jobId) {
          // If max attempts reached, remove from processing
          if (job.attempts >= job.maxAttempts) {
            await this.removeFromProcessing(jobId);
            // Optionally store failed jobs in a separate list
            await redis.lpush(
              `${this.queueName}:failed`,
              JSON.stringify({ ...job, error: error.message })
            );
          } else {
            // Otherwise, put it back in the queue for retry
            job.status = "pending";
            await redis.lpush(this.queueName, JSON.stringify(job));
            await this.removeFromProcessing(jobId);
          }
          break;
        }
      } catch (parseError) {
        logger.exception(parseError, {
          context: "Redis queue",
          operation: "fail:parseJob",
          queueName: this.queueName,
          jobId,
          jobData: processingJobs[i],
        });
      }
    }
  }

  private async removeFromProcessing(jobId: string): Promise<void> {
    const redis = getRedisClient();
    const processingJobs = await redis.lrange(this.processingQueueName, 0, -1);

    for (let i = 0; i < processingJobs.length; i++) {
      try {
        const job = JSON.parse(processingJobs[i]) as QueueJob;

        if (job.id === jobId) {
          // Remove the job at index i
          await redis.lrem(this.processingQueueName, 1, processingJobs[i]);
          break;
        }
      } catch (error) {
        logger.exception(error, {
          context: "Redis queue",
          operation: "removeFromProcessing",
          queueName: this.queueName,
          jobId,
        });
      }
    }
  }

  async getQueueLength(): Promise<number> {
    const redis = getRedisClient();
    return redis.llen(this.queueName);
  }

  async getProcessingLength(): Promise<number> {
    const redis = getRedisClient();
    return redis.llen(this.processingQueueName);
  }
}
