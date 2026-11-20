import { getDb } from "../config/db.js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run make-admin -- user@example.com");
  process.exit(1);
}

const db = await getDb();
const result = await db
  .collection("user")
  .updateOne({ email }, { $set: { role: "admin", roleSelected: true, isBlocked: false, updatedAt: new Date() } });

if (result.matchedCount === 0) {
  console.error(`No user found with email ${email}. Sign up through the app first.`);
  process.exit(1);
}
console.log(`${email} is now an admin.`);
process.exit(0);