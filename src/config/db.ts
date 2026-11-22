import { MongoClient, type Db } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";
import { env } from "./env.js";

let clientPromise: Promise<MongoClient> | undefined;

function connect(): Promise<MongoClient> {
  const client = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
  });
  attachDatabasePool(client);
  return client.connect().catch((error) => {
    clientPromise = undefined; // don't cache a failed attempt
    throw error;
  });
}

export async function getDb(): Promise<Db> {
  clientPromise ??= connect();
  const client = await clientPromise;
  return client.db(env.MONGODB_DB);
}