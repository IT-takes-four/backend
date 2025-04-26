import * as schemas from "@/schemas";

export const getSchemas = () => {
  const entries = Object.entries(schemas)
    .filter(([key]) => key.endsWith("Schema"))
    .map(([key, value]) => [key.replace(/Schema$/, ""), value]);

  console.log({ entries });
  return Object.fromEntries(entries);
};
