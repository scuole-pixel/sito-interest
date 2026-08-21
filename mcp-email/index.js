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

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

server.tool(
  "send_campaign",
  "Invia le email di una campagna leggendo un file Excel con colonne: Inviato, Email, Oggetto, Corpo. " +
    "Salta le righe già segnate come inviate; dopo ogni invio riuscito scrive data e ora nella colonna " +
    "Inviato e salva il file, così una nuova chiamata riprende da dove si era interrotta. " +
    "Invia al massimo `limit` email per chiamata: richiamare finché non restano righe da inviare.",
  {
    excelPath: z
      .string()
      .describe("Percorso del file Excel della campagna (es. C:\\Users\\...\\Invii_scuole_Interest.xlsx)"),
    attachmentPath: z
      .string()
      .optional()
      .describe("Percorso di un file da allegare a ogni email (es. il PDF di presentazione)"),
    sheetName: z
      .string()
      .optional()
      .describe("Nome del foglio (default: il primo foglio del file)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Numero massimo di email da inviare in questa chiamata (default: 10)"),
    delaySeconds: z
      .number()
      .min(0)
      .max(60)
      .optional()
      .describe("Pausa in secondi tra un invio e l'altro (default: 3)"),
    subjectOverride: z
      .string()
      .optional()
      .describe("Se indicato, usa questo oggetto per tutte le email al posto della colonna Oggetto"),
    dryRun: z
      .boolean()
      .optional()
      .describe("Se true non invia nulla: mostra solo quante righe restano e un'anteprima dei prossimi destinatari"),
  },
  async ({
    excelPath,
    attachmentPath,
    sheetName,
    limit = 10,
    delaySeconds = 3,
    subjectOverride,
    dryRun = false,
  }) => {
    const { default: ExcelJS } = await import("exceljs");

    if (attachmentPath && !existsSync(attachmentPath)) {
      throw new Error(`Allegato non trovato: ${attachmentPath}`);
    }
    if (!existsSync(excelPath)) {
      throw new Error(`File Excel non trovato: ${excelPath}`);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const sheet = sheetName
      ? workbook.getWorksheet(sheetName)
      : workbook.worksheets[0];
    if (!sheet) {
      throw new Error(`Foglio "${sheetName}" non trovato nel file Excel`);
    }

    // Individua le colonne dall'intestazione (riga 1).
    const header = {};
    sheet.getRow(1).eachCell((cell, col) => {
      const name = String(cell.value ?? "").trim().toLowerCase();
      if (name) header[name] = col;
    });
    for (const required of ["inviato", "email", "oggetto", "corpo"]) {
      if (!header[required]) {
        throw new Error(
          `Colonna "${required}" non trovata nella riga di intestazione del foglio "${sheet.name}". ` +
            `Colonne attese: Inviato, Email, Oggetto, Corpo.`
        );
      }
    }

    const cellText = (row, col) => {
      const v = row.getCell(col).value;
      if (v == null) return "";
      if (typeof v === "object") {
        if (v.text) return String(v.text);
        if (v.richText) return v.richText.map((p) => p.text).join("");
        if (v.result != null) return String(v.result);
      }
      return String(v);
    };

    // Raccoglie le righe ancora da inviare.
    const pending = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const sent = cellText(row, header["inviato"]).trim();
      const email = cellText(row, header["email"]).trim();
      if (!email || sent) return;
      pending.push({
        rowNumber,
        email,
        subject: subjectOverride || cellText(row, header["oggetto"]).trim(),
        body: cellText(row, header["corpo"]),
      });
    });

    if (dryRun) {
      const preview = pending
        .slice(0, 10)
        .map((p) => `  riga ${p.rowNumber}: ${p.email} — ${p.subject.slice(0, 70)}`)
        .join("\n");
      return {
        content: [
          {
            type: "text",
            text:
              `ANTEPRIMA (nessuna email inviata).\n` +
              `Righe ancora da inviare: ${pending.length}` +
              (attachmentPath ? `\nAllegato: ${attachmentPath}` : "\nNessun allegato indicato") +
              (pending.length ? `\nProssimi destinatari:\n${preview}` : ""),
          },
        ],
      };
    }

    if (pending.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Campagna completata: nessuna riga da inviare (tutte le righe con email hanno già la colonna Inviato compilata).",
          },
        ],
      };
    }

    // Controlla PRIMA di inviare che il file sia salvabile (es. non aperto
    // in Excel): se il progresso non fosse registrabile, al riavvio le email
    // già partite verrebbero rimandate.
    try {
      await workbook.xlsx.writeFile(excelPath);
    } catch (err) {
      throw new Error(
        `Impossibile scrivere sul file Excel (${err.message}). ` +
          `Probabilmente è aperto in Excel: chiuderlo e riprovare. Nessuna email è stata inviata.`
      );
    }

    const transporter = createTransporter();
    const batch = pending.slice(0, limit);
    const sentOk = [];
    const failures = [];
    let consecutiveFailures = 0;

    for (const item of batch) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) {
        failures.push({ ...item, error: "indirizzo email non valido" });
        continue;
      }
      if (!item.subject || !item.body.trim()) {
        failures.push({ ...item, error: "oggetto o corpo mancante nella riga" });
        continue;
      }
      try {
        await transporter.sendMail({
          from: `"${config.fromName}" <${config.user}>`,
          to: item.email,
          subject: item.subject,
          text: item.body,
          attachments: attachmentPath
            ? [{ filename: basename(attachmentPath), path: attachmentPath }]
            : undefined,
        });
        consecutiveFailures = 0;
        sentOk.push(item);
      } catch (err) {
        consecutiveFailures += 1;
        failures.push({ ...item, error: err.message });
        if (consecutiveFailures >= 3) {
          failures.push({
            email: "—",
            rowNumber: "—",
            error: "3 errori consecutivi: invio interrotto per sicurezza (controllare credenziali/connessione prima di riprovare)",
          });
          break;
        }
        continue;
      }
      // Segna la riga come inviata e salva subito: se qualcosa si
      // interrompe, la prossima chiamata riprende dalla riga successiva.
      sheet.getRow(item.rowNumber).getCell(header["inviato"]).value =
        new Date().toISOString().slice(0, 16).replace("T", " ");
      try {
        await workbook.xlsx.writeFile(excelPath);
      } catch (err) {
        failures.push({
          ...item,
          sent: true,
          error:
            `EMAIL GIÀ INVIATA ma impossibile salvare il progresso nel file (${err.message}). ` +
            `Invio interrotto: prima di riprendere, chiudere Excel e compilare a mano la colonna ` +
            `Inviato alla riga ${item.rowNumber}, altrimenti questa email verrebbe rimandata.`,
        });
        break;
      }
      if (delaySeconds > 0 && item !== batch[batch.length - 1]) {
        await sleep(delaySeconds * 1000);
      }
    }

    const remaining =
      pending.length -
      sentOk.length -
      failures.filter((f) => f.rowNumber !== "—" && !f.sent).length;
    const lines = [
      `Inviate in questa chiamata: ${sentOk.length}`,
      `Errori: ${failures.length ? failures.map((f) => `riga ${f.rowNumber} (${f.email}): ${f.error}`).join("; ") : "nessuno"}`,
      `Righe ancora da inviare: ${remaining}`,
    ];
    if (remaining > 0) {
      lines.push(
        `Per continuare, richiamare send_campaign con gli stessi parametri: riprende automaticamente dalle righe non ancora segnate come inviate.`
      );
    } else if (failures.length === 0) {
      lines.push("Campagna completata.");
    }
    return { content: [{ type: "text", text: lines.join("\n") }] };
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
