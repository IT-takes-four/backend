import { z } from "zod";

export const UserResponseSchema = z.object({
  id: z.number(),
  image: z.string(),
  name: z.string(),
  username: z.string(),
  games: z.array(z.object({})),
});
