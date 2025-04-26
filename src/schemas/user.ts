import { t } from "elysia";

export const UserResponseSchema = t.Object(
  {
    id: t.Numeric(),
    image: t.String(),
    name: t.String(),
    username: t.String(),
    games: t.Array(t.Object({})), // Пока пустой объект
  },
  { $id: "UserResponse" }
);
