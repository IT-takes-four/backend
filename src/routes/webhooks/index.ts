import Elysia from "elysia";

import { clerkWebhook } from "./clerk";

export const webhooksRouter = new Elysia({ prefix: "/webhooks" }).use(
  clerkWebhook
);
