const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function init() {
  try {
    console.log("Connecting to MySQL...");
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      multipleStatements: true
    });

    console.log("Creating database phishing_triage if it doesn't exist...");
    await conn.query("CREATE DATABASE IF NOT EXISTS phishing_triage;");
    await conn.query("USE phishing_triage;");

    console.log("Reading schema.sql...");
    const schema = fs.readFileSync('schema.sql', 'utf8');

    console.log("Executing schema.sql...");
    await conn.query(schema);

    console.log("Database initialized successfully!");
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  }
}

init();
