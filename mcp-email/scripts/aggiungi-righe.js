#!/usr/bin/env node
/**
 * Accoda al file Excel della campagna le righe di un secondo file Excel
 * (stesse colonne: Inviato, Email, Oggetto, Corpo). Le righe esistenti non
 * vengono toccate (la colonna Inviato resta com'è) e ogni email già
 * presente nella campagna viene saltata, così nessuno riceve doppioni.
 *
 * Uso:
 *   node scripts/aggiungi-righe.js "C:\...\Invii_scuole_Interest.xlsx" "C:\...\nuove-righe-campagna.xlsx"
 *
 * Crea una copia di sicurezza della campagna prima di modificarla.
 * Chiudere Excel prima di eseguirlo.
 */

import { copyFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "..", "package.json")
);
const ExcelJS = require("exceljs");

const [campaignPath, additionsPath] = process.argv.slice(2);
if (!campaignPath || !additionsPath) {
  console.error(
    'Uso: node scripts/aggiungi-righe.js "campagna.xlsx" "nuove-righe.xlsx"'
  );
  process.exit(1);
}
for (const p of [campaignPath, additionsPath]) {
  if (!existsSync(p)) {
    console.error(`File non trovato: ${p}`);
    process.exit(1);
  }
}

const cellText = (row, col) => {
  if (!col) return "";
  const v = row.getCell(col).value;
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.text) return String(v.text);
    if (v.richText) return v.richText.map((p) => p.text).join("");
    if (v.result != null) return String(v.result);
  }
  return String(v);
};

const headerMap = (sheet) => {
  const h = {};
  sheet.getRow(1).eachCell((cell, col) => {
    const name = String(cell.value ?? "").trim().toLowerCase();
    if (name) h[name] = col;
  });
  return h;
};

const backupPath = campaignPath.replace(/\.xlsx$/i, "") + ".backup.xlsx";
copyFileSync(campaignPath, backupPath);
console.log(`Copia di sicurezza creata: ${backupPath}`);

const campaign = new ExcelJS.Workbook();
await campaign.xlsx.readFile(campaignPath);
const cSheet = campaign.worksheets[0];
const cHead = headerMap(cSheet);
for (const req of ["inviato", "email", "oggetto", "corpo"]) {
  if (!cHead[req]) {
    console.error(`Colonna "${req}" non trovata nel file campagna.`);
    process.exit(1);
  }
}

const existing = new Set();
cSheet.eachRow((row, n) => {
  if (n === 1) return;
  const e = cellText(row, cHead["email"]).trim().toLowerCase();
  if (e) existing.add(e);
});
console.log(`Email già presenti nella campagna: ${existing.size}`);

const additions = new ExcelJS.Workbook();
await additions.xlsx.readFile(additionsPath);
const aSheet = additions.worksheets[0];
const aHead = headerMap(aSheet);
for (const req of ["email", "oggetto", "corpo"]) {
  if (!aHead[req]) {
    console.error(`Colonna "${req}" non trovata nel file delle nuove righe.`);
    process.exit(1);
  }
}

let added = 0;
let skipped = 0;
aSheet.eachRow((row, n) => {
  if (n === 1) return;
  const email = cellText(row, aHead["email"]).trim().toLowerCase();
  if (!email || !email.includes("@")) return;
  if (existing.has(email)) {
    skipped += 1;
    return;
  }
  existing.add(email);
  const newRow = cSheet.addRow([]);
  newRow.getCell(cHead["inviato"]).value = "";
  newRow.getCell(cHead["email"]).value = email;
  newRow.getCell(cHead["oggetto"]).value = cellText(row, aHead["oggetto"]);
  newRow.getCell(cHead["corpo"]).value = cellText(row, aHead["corpo"]);
  added += 1;
});

await campaign.xlsx.writeFile(campaignPath);
console.log(`Aggiunte ${added} righe a ${campaignPath}`);
console.log(`Saltate perché già presenti: ${skipped}`);
