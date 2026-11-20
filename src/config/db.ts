import { MongoClient, type Db } from "mongodb";
import { env } from "./env.js";

let clientPromise: Promise<MongoClient> | undefined;

export async function getDb(): Promise<Db> {
  clientPromise ??= new MongoClient(env.MONGODB_URI)
    .connect()
    .catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  const client = await clientPromise;
  return client.db(env.MONGODB_DB);
}