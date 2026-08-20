#!/usr/bin/env node
/**
 * Server MCP per l'invio di email dall'account scuole@buildinterest.it.
 *
 * Trasporto: stdio. Espone i tool:
 *   - send_email: invia una email (testo e/o HTML, con cc/bcc e allegati)
 *   - verify_connection: verifica le credenziali SMTP senza inviare nulla
 *
 * Configurazione tramite variabili d'ambiente (o file .env in questa cartella):
 *   EMAIL_USER      indirizzo mittente (default: scuole@buildinterest.it)
 *   EMAIL_PASSWORD  password SMTP — per Gmail/Google Workspace serve una
 *                   "password per le app": https://myaccount.google.com/apppasswords
 *   SMTP_HOST       default: smtp.gmail.com
 *   SMTP_PORT       default: 465 (TLS implicito)
 *   EMAIL_FROM_NAME nome visualizzato del mittente (default: "Interest — Scuole")
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import nodemailer from "nodemailer";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carica un eventuale file .env locale senza dipendenze esterne.
// Le variabili già presenti nell'ambiente hanno la precedenza.
function loadDotEnv() {
  try {
    const raw = readFileSync(join(__dirname, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let value = m[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // Nessun .env: si usano solo le variabili d'ambiente.
  }
}

loadDotEnv();

const config = {
  user: process.env.EMAIL_USER || "scuole@buildinterest.it",
  password: process.env.EMAIL_PASSWORD || "",
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  fromName: process.env.EMAIL_FROM_NAME || "Interest — Scuole",
};

function createTransporter() {
  if (!config.password) {
    throw new Error(
      "EMAIL_PASSWORD non impostata. Crea mcp-email/.env (vedi .env.example) " +
        "con una password per le app di Google: https://myaccount.google.com/apppasswords"
    );
  }
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
  });
}

const server = new McpServer({
  name: "mcp-email-scuole",
  version: "1.0.0",
});

server.tool(
  "send_email",
  "Invia una email dall'account " + config.user,
  {
    to: z
      .union([z.string(), z.array(z.string())])
      .describe("Destinatario o lista di destinatari"),
    subject: z.string().describe("Oggetto della email"),
    body: z.string().describe("Corpo del messaggio in testo semplice"),
    html: z
      .string()
      .optional()
      .describe("Corpo alternativo in HTML (opzionale)"),
    cc: z.union([z.string(), z.array(z.string())]).optional().describe("Cc"),
    bcc: z.union([z.string(), z.array(z.string())]).optional().describe("Ccn"),
    replyTo: z.string().optional().describe("Indirizzo di risposta"),
    attachments: z
      .array(
        z.object({
          filename: z.string().describe("Nome del file"),
          path: z
            .string()
            .optional()
            .describe("Percorso del file sul disco"),
          content: z
            .string()
            .optional()
            .describe("Contenuto in base64 (alternativo a path)"),
        })
      )
      .optional()
      .describe("Allegati (opzionale)"),
  },
  async ({ to, subject, body, html, cc, bcc, replyTo, attachments }) => {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.user}>`,
      to,
      cc,
      bcc,
      replyTo,
      subject,
      text: body,
      html,
      attachments: attachments?.map((a) =>
        a.content
          ? { filename: a.filename, content: a.content, encoding: "base64" }
          : { filename: a.filename, path: a.path }
      ),
    });
    return {
      content: [
        {
          type: "text",
          text:
            `Email inviata a ${Array.isArray(to) ? to.join(", ") : to}.\n` +
            `ID messaggio: ${info.messageId}\n` +
            `Risposta server: ${info.response}`,
        },
      ],
    };
  }
);

server.tool(
  "verify_connection",
  "Verifica le credenziali SMTP senza inviare email",
  {},
  async () => {
    const transporter = createTransporter();
    await transporter.verify();
    return {
      content: [
        {
          type: "text",
          text: `Connessione a ${config.host}:${config.port} riuscita, credenziali valide per ${config.user}.`,
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
  `mcp-email-scuole avviato (mittente: ${config.user}, SMTP: ${config.host}:${config.port})`
);
