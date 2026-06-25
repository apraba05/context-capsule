import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client);
  console.log("running migrations…");
  await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
  console.log("done");
  await client.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
