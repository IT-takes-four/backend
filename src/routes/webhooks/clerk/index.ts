import { Elysia, t } from "elysia";
import { Webhook } from "svix";
import { UserJSON, WebhookEvent } from "@clerk/backend";
import type { IncomingHttpHeaders } from "http";

import { createUser, updateUser, deleteUser } from "@/services/userService";

export const verifyClerkWebhookSignature = (
  payload: string,
  headers: IncomingHttpHeaders
) => {
  const SIGNING_SECRET = process.env.CLERK_SIGNING_SECRET;

  if (!SIGNING_SECRET) {
    throw new Error(
      "Error: Please add CLERK_SIGNING_SECRET from Clerk Dashboard to .env"
    );
  }

  const wh = new Webhook(SIGNING_SECRET);

  const svix_id = headers["svix-id"];
  const svix_timestamp = headers["svix-timestamp"];
  const svix_signature = headers["svix-signature"];

  if (!svix_id || !svix_timestamp || !svix_signature) {
    throw new Error("Error: Missing Svix headers");
  }

  return wh.verify(payload, {
    "svix-id": svix_id as string,
    "svix-timestamp": svix_timestamp as string,
    "svix-signature": svix_signature as string,
  }) as WebhookEvent;
};

export const clerkWebhook = new Elysia()
  .onParse(({ request }) => request.text())
  .post(
    "/clerk",
    async ({ body, headers, set }) => {
      try {
        const rawBody = body as string;

        const event = verifyClerkWebhookSignature(rawBody, headers);
        const eventType = event.type;

        console.log(`Webhook verified successfully. Event type: ${eventType}`);

        const eventData = JSON.parse(rawBody);

        switch (eventType) {
          case "user.created":
            await createUser(eventData.data as UserJSON);
            break;
          case "user.updated":
            await updateUser(eventData.data as UserJSON);
            break;
          case "user.deleted":
            if (eventData.data.id) {
              await deleteUser(eventData.data.id);
            }
            break;
          default:
            console.log(`Unhandled webhook event type: ${eventType}`);
        }

        return { success: true };
      } catch (error: any) {
        console.error(`Error handling webhook:`, error);
        set.status = 401;
        return {
          error: "Webhook verification failed",
          message: error.message || "Unknown error",
        };
      }
    },
    {
      detail: {
        tags: ["clerk"],
        summary: "Clerk webhook",
        description: "Handles Clerk webhooks",
      },
      body: t.String(),
    }
  );
