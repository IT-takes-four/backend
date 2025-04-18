import type { OpenAPIV3 } from "openapi-types";

import { auth } from "@/lib/auth";

type HttpMethod =
  | "get"
  | "put"
  | "post"
  | "delete"
  | "options"
  | "head"
  | "patch"
  | "trace";
const validHttpMethods: HttpMethod[] = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
];

export const mergeSwaggerSchemas = async (
  authTag: string = "Auth"
): Promise<OpenAPIV3.Document> => {
  const authSchema =
    (await auth.api.generateOpenAPISchema()) as OpenAPIV3.Document;

  const baseDocumentation: OpenAPIV3.Document = {
    openapi: "3.0.0",
    info: {
      title: "Quokka API",
      version: "1.0.0",
      description: "API for the Quokka game tracking application",
    },
    tags: [
      { name: "Games", description: "Game related endpoints" },
      { name: "Igdb", description: "IGDB integration endpoints" },
      {
        name: authTag,
        description: `${
          authTag.charAt(0).toUpperCase() + authTag.slice(1)
        } endpoints`,
      },
    ],
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {},
    },
  };

  const taggedAuthSchemaPaths = Object.entries(authSchema.paths || {}).reduce(
    (acc, [path, pathItem]) => {
      const currentPathItem = pathItem as OpenAPIV3.PathItemObject;
      acc[path] = { ...currentPathItem };

      validHttpMethods.forEach((method) => {
        const operation = currentPathItem[method] as OpenAPIV3.OperationObject;
        if (operation && typeof operation === "object") {
          (acc[path] as OpenAPIV3.PathItemObject)[method] = {
            ...operation,
            tags: [authTag],
          };
        }
      });
      return acc;
    },
    {} as OpenAPIV3.PathsObject
  );

  const mergedTags = [...(baseDocumentation.tags || [])];
  const baseTagNames = new Set(mergedTags.map((tag) => tag.name));
  (authSchema.tags || []).forEach((tag: OpenAPIV3.TagObject) => {
    if (!baseTagNames.has(tag.name)) {
      mergedTags.push(tag);
    }
  });

  const mergedDocumentation: OpenAPIV3.Document = {
    ...baseDocumentation,
    info: { ...(baseDocumentation.info || {}), ...(authSchema.info || {}) },
    servers: [
      ...(baseDocumentation.servers || []),
      ...(authSchema.servers || []),
    ],
    paths: {
      ...(baseDocumentation.paths || {}),
      ...(taggedAuthSchemaPaths || {}),
    },
    components: {
      schemas: {
        ...(baseDocumentation.components?.schemas || {}),
        ...(authSchema.components?.schemas || {}),
      },
      securitySchemes: {
        ...(baseDocumentation.components?.securitySchemes || {}),
        ...(authSchema.components?.securitySchemes || {}),
      },
      parameters: {
        ...(baseDocumentation.components?.parameters || {}),
        ...(authSchema.components?.parameters || {}),
      },
      responses: {
        ...(baseDocumentation.components?.responses || {}),
        ...(authSchema.components?.responses || {}),
      },
      requestBodies: {
        ...(baseDocumentation.components?.requestBodies || {}),
        ...(authSchema.components?.requestBodies || {}),
      },
      headers: {
        ...(baseDocumentation.components?.headers || {}),
        ...(authSchema.components?.headers || {}),
      },
      examples: {
        ...(baseDocumentation.components?.examples || {}),
        ...(authSchema.components?.examples || {}),
      },
      links: {
        ...(baseDocumentation.components?.links || {}),
        ...(authSchema.components?.links || {}),
      },
      callbacks: {
        ...(baseDocumentation.components?.callbacks || {}),
        ...(authSchema.components?.callbacks || {}),
      },
    },
    tags: mergedTags,
    security: [
      ...(baseDocumentation.security || []),
      ...(authSchema.security || []),
    ],
    externalDocs: authSchema.externalDocs || baseDocumentation.externalDocs,
  };

  return mergedDocumentation;
};
