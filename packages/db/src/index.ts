import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export * from "./encryption";

export type Database = ReturnType<typeof createDatabase>;

let singleton: Database | null = null;

export function createDatabase(connectionString?: string): ReturnType<typeof drizzle<typeof schema>> {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = postgres(url, {
    max: 10,
    idle_timeout: 20,
    prepare: false,
  });
  return drizzle(client, { schema });
}

export function getDatabase(): Database {
  if (!singleton) {
    singleton = createDatabase();
  }
  return singleton;
}
