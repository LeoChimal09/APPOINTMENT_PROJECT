import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { customerEmailVerificationTokensTable } from "@/server/db/schema";
import { ensureAuthSchema } from "@/server/db/ensure-auth-schema";

type CreateVerificationTokenInput = {
  email: string;
  tokenHash: string;
  expiresAt: string;
  name?: string | null;
};

export async function createEmailVerificationToken(
  input: CreateVerificationTokenInput,
) {
  await ensureAuthSchema();
  const db = getDb();
  const normalizedEmail = input.email.trim().toLowerCase();

  // One active token per email at a time.
  await db
    .delete(customerEmailVerificationTokensTable)
    .where(eq(customerEmailVerificationTokensTable.email, normalizedEmail));

  await db.insert(customerEmailVerificationTokensTable).values({
    email: normalizedEmail,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    name: input.name?.trim() || null,
    createdAt: new Date().toISOString(),
  });
}

export async function consumeEmailVerificationToken(
  email: string,
  tokenHash: string,
) {
  await ensureAuthSchema();
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const nowIso = new Date().toISOString();

  const rows = await db
    .select()
    .from(customerEmailVerificationTokensTable)
    .where(
      and(
        eq(customerEmailVerificationTokensTable.email, normalizedEmail),
        eq(customerEmailVerificationTokensTable.tokenHash, tokenHash),
        gt(customerEmailVerificationTokensTable.expiresAt, nowIso),
      ),
    );

  const tokenRow = rows[0] ?? null;
  if (!tokenRow) return null;

  // Single-use: delete on consumption.
  await db
    .delete(customerEmailVerificationTokensTable)
    .where(eq(customerEmailVerificationTokensTable.id, tokenRow.id));

  return tokenRow;
}

export async function deleteExpiredEmailVerificationTokens() {
  await ensureAuthSchema();
  const db = getDb();
  const nowIso = new Date().toISOString();

  await db
    .delete(customerEmailVerificationTokensTable)
    .where(lt(customerEmailVerificationTokensTable.expiresAt, nowIso));
}
