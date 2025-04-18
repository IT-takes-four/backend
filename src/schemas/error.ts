import { t } from "elysia";

// 404 Not found
export const NotFoundErrorResponseSchema = t.Object({
  error: t.Literal("Not found"),
});

// 400 Bad request
export const BadRequestErrorResponseSchema = t.Object({
  error: t.Literal("Bad request"),
});

// 401 Unauthorized
export const UnauthorizedErrorResponseSchema = t.Object({
  error: t.Literal("Unauthorized"),
  message: t.Literal("Authentication required"),
});

// 403 Forbidden
export const ForbiddenErrorResponseSchema = t.Object({
  error: t.Literal("Forbidden"),
});

// 409 Conflict
export const ConflictErrorResponseSchema = t.Object({
  error: t.Literal("Conflict"),
});

// 500 Internal server error
export const InternalServerErrorResponseSchema = t.Object({
  error: t.Literal("Internal server error"),
});
