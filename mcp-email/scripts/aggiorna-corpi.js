#!/usr/bin/env node
/**
 * Uniforma la colonna "Corpo" del file Excel della campagna: conserva la
 * prima riga di saluto già personalizzata (es. "Gentile Prof.ssa Rossi," o
 * "Gentile Dirigenza,") e sostituisce tutto il resto con il testo fisso
 * concordato. Le colonne Inviato/Email/Oggetto non vengono toccate.
 *
 * Uso:  node scripts/aggiorna-corpi.js "C:\percorso\Invii_scuole_Interest.xlsx"
 *
 * Prima di sovrascrivere crea una copia di sicurezza accanto al file
 * (stesso nome + ".backup.xlsx"). Chiudere Excel prima di eseguirlo.
 */

import { copyFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "..", "package.json")
);
const ExcelJS = require("exceljs");

const TESTO_FISSO = `siamo Interest, associazione che promuove l’educazione finanziaria nelle scuole superiori, in collaborazione con Starting Finance, attraverso incontri gratuiti e interattivi rivolti agli studenti del triennio.

Vorremmo chiedervi se il vostro istituto potesse essere interessato a organizzare uno o più incontri durante il prossimo anno scolastico.

Gli incontri affrontano temi quali gestione del denaro, risparmio, debito, rischio e prevenzione delle truffe finanziarie, con un approccio pratico, neutrale e privo di finalità commerciali.

Nel caso foste interessati, saremmo lieti di presentarvi il progetto e confrontarci sulle possibili modalità organizzative. In allegato trovate una breve presentazione.

Ringraziandovi per l’attenzione, rimaniamo a disposizione per qualsiasi informazione.

Cordiali saluti,

Interest`;

const excelPath = process.argv[2];
if (!excelPath) {
  console.error('Uso: node scripts/aggiorna-corpi.js "percorso\\del\\file.xlsx"');
  process.exit(1);
}
if (!existsSync(excelPath)) {
  console.error(`File non trovato: ${excelPath}`);
  process.exit(1);
}

const backupPath = excelPath.replace(/\.xlsx$/i, "") + ".backup.xlsx";
copyFileSync(excelPath, backupPath);
console.log(`Copia di sicurezza creata: ${backupPath}`);

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(excelPath);
const sheet = workbook.worksheets[0];

const header = {};
sheet.getRow(1).eachCell((cell, col) => {
  const name = String(cell.value ?? "").trim().toLowerCase();
  if (name) header[name] = col;
});
if (!header["email"] || !header["corpo"]) {
  console.error(`Colonne "Email" e/o "Corpo" non trovate nel foglio "${sheet.name}".`);
  process.exit(1);
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

let updated = 0;
const anomalie = [];
sheet.eachRow((row, rowNumber) => {
  if (rowNumber === 1) return;
  const email = cellText(row, header["email"]).trim();
  if (!email) return;
  const corpo = cellText(row, header["corpo"]);
  let saluto = (corpo.split("\n")[0] || "").trim();
  if (!saluto || !saluto.endsWith(",")) {
    anomalie.push(`riga ${rowNumber} (${email}): saluto non riconosciuto ("${saluto.slice(0, 40)}"), uso "Gentile Dirigenza,"`);
    saluto = "Gentile Dirigenza,";
  }
  row.getCell(header["corpo"]).value = `${saluto}\n\n${TESTO_FISSO}`;
  updated += 1;
});

await workbook.xlsx.writeFile(excelPath);
console.log(`Aggiornate ${updated} righe in ${excelPath}`);
if (anomalie.length) {
  console.log("Note:");
  for (const a of anomalie) console.log("  - " + a);
}
