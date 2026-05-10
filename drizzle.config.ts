import type { Config } from "drizzle-kit";

const url = (process.env.DATABASE_URL ?? "file:./data/quorum.db").replace(/^file:/, "");

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url },
} satisfies Config;
