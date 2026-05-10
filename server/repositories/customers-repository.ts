import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { customersTable } from "@/server/db/schema";
import { ensureAuthSchema } from "@/server/db/ensure-auth-schema";

export async function getCustomerByEmail(email: string) {
  await ensureAuthSchema();
  const db = getDb();
  const rows = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.email, email.trim().toLowerCase()));

  return rows[0] ?? null;
}

export async function createCustomer(email: string, name: string) {
  await ensureAuthSchema();
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();

  await db.insert(customersTable).values({
    email: normalizedEmail,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  });

  return getCustomerByEmail(normalizedEmail);
}
