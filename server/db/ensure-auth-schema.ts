// Ensures the customers and email verification token tables exist.
// Runs once per process. Safe to call from multiple repository functions.

import { getPool } from "@/server/db/client";

let ensuredAuthSchemaPromise: Promise<void> | null = null;

export async function ensureAuthSchema() {
  if (!ensuredAuthSchemaPromise) {
    ensuredAuthSchemaPromise = (async () => {
      const pool = getPool();

      await pool.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          created_at VARCHAR(40) NOT NULL
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS customer_email_verification_tokens (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          token_hash VARCHAR(128) NOT NULL UNIQUE,
          name VARCHAR(255),
          expires_at VARCHAR(40) NOT NULL,
          created_at VARCHAR(40) NOT NULL
        )
      `);
    })().catch((error) => {
      ensuredAuthSchemaPromise = null;
      throw error;
    });
  }

  await ensuredAuthSchemaPromise;
}
