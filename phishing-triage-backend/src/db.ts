import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "phishing_triage",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function testConnection(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.query("SELECT 1");
    console.log("[db] MySQL connection OK");
    
    // Auto-migrate schema for Phase 2: urlscan.io integration
    await conn.query("ALTER TABLE analyses ADD COLUMN urlscan_reputation JSON DEFAULT NULL;")
      .then(() => console.log("[db] Added missing 'urlscan_reputation' column"))
      .catch((err) => {
        // Ignore error if column already exists (ER_DUP_FIELDNAME - 1060)
        if (err.code !== 'ER_DUP_FIELDNAME') {
          console.error("[db] Migration error:", err.message);
        }
      });
  } finally {
    conn.release();
  }
}
