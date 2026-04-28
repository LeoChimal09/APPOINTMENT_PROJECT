import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

declare global {
  var __cuttingEdgeMysqlPool: mysql.Pool | undefined;
}

function getConnectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL is required to use the appointment database.");
  }

  return value;
}

function getPool() {
  if (!globalThis.__cuttingEdgeMysqlPool) {
    globalThis.__cuttingEdgeMysqlPool = mysql.createPool({
      uri: getConnectionString(),
      connectionLimit: 10,
    });
  }

  return globalThis.__cuttingEdgeMysqlPool;
}

export function getDb() {
  return drizzle(getPool());
}