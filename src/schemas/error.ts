import { t } from "elysia";

// 404 Not found
export const NotFoundErrorResponseSchema = t.Object({
  error: t.Literal("Not found"),
});

// 400 Bad request
export const BadRequestErrorResponseSchema = t.Object({
  error: t.Literal("Bad request"),
});

// 403 Forbidden
export const ForbiddenErrorResponseSchema = t.Object({
  error: t.Literal("Forbidden"),
});

// 500 Internal server error
export const InternalServerErrorResponseSchema = t.Object({
  error: t.Literal("Internal server error"),
});
