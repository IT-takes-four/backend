import { z } from "zod";

export const DeleteSuccessResponseSchema = z.object({
  message: z.literal("Removed successfully"),
  id: z.number(),
});
