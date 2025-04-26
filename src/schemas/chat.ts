import { t } from "elysia";

export const ChatRoleSchema = t.Union(
  [
    t.Literal("user"),
    t.Literal("assistant"),
    t.Literal("system"),
    t.Literal("function"),
  ],
  { $id: "ChatRole" }
);

export const BaseMessageSchema = t.Object(
  {
    role: t.Union([
      t.Literal("user"),
      t.Literal("assistant"),
      t.Literal("system"),
    ]),
    content: t.Nullable(t.String()),
  },
  { $id: "BaseMessage" }
);

export const FunctionMessageSchema = t.Object(
  {
    role: t.Literal("function"),
    name: t.String(),
    content: t.Nullable(t.String()),
  },
  { $id: "FunctionMessage" }
);

export const MessageSchema = t.Union(
  [t.Ref("BaseMessage"), t.Ref("FunctionMessage")],
  { $id: "Message" }
);

export const OpenAIChatRequestSchema = t.Object(
  {
    messages: t.Array(t.Ref("Message")),
    showOnlyGames: t.Optional(t.Boolean({ default: true })),
  },
  { $id: "OpenAIChatRequest" }
);

export const OpenAIChatResponseSchema = t.Object(
  {
    message: t.Object({
      role: t.Literal("assistant"),
      content: t.String(),
      gameData: t.Ref("GameResponse"),
      gameResults: t.Optional(t.Array(t.Ref("GameResponse"))),
      userRating: t.Optional(t.Numeric()),
      userStatus: t.Optional(t.String()),
      userReview: t.Optional(t.String()),
    }),
  },
  { $id: "OpenAIChatResponse" }
);
