import { t } from "elysia";

export const DeleteSuccessResponseSchema = t.Object(
  {
    message: t.Literal("Removed successfully"),
    id: t.Numeric(),
  },
  { $id: "DeleteSuccessResponse" }
);
