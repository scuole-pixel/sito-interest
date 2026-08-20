#!/usr/bin/env node
// Verifica rapida delle credenziali SMTP: `npm run test-connection`
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const raw = readFileSync(join(__dirname, ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const user = process.env.EMAIL_USER || "scuole@buildinterest.it";
const pass = process.env.EMAIL_PASSWORD;
const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT || 465);

if (!pass) {
  console.error("EMAIL_PASSWORD non impostata: copia .env.example in .env e compilala.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

try {
  await transporter.verify();
  console.log(`OK: connessione a ${host}:${port} riuscita, credenziali valide per ${user}.`);
} catch (err) {
  console.error(`ERRORE: ${err.message}`);
  if (/535|username and password not accepted|application-specific/i.test(String(err))) {
    console.error(
      "\nGmail ha rifiutato le credenziali. Con Google Workspace serve una " +
        "password per le app (non la password normale dell'account):\n" +
        "  https://myaccount.google.com/apppasswords"
    );
  }
  process.exit(1);
}
