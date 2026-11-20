import app from "./app.js";
import { env } from "./config/env.js";
import { getDb } from "./config/db.js";

async function start() {
  await getDb();
  console.log("MongoDB connected");
  app.listen(env.PORT, () => console.log(`PizzaHub API listening on http://localhost:${env.PORT}`));
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});