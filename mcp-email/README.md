# MCP Email — scuole@buildinterest.it

Server MCP (Model Context Protocol) che permette a Claude di inviare email
dall'account **scuole@buildinterest.it** via SMTP (Google Workspace).

## Tool esposti

| Tool | Descrizione |
|------|-------------|
| `send_email` | Invia una email: destinatari (`to`, `cc`, `bcc`), `subject`, corpo in testo (`body`) e/o `html`, allegati opzionali |
| `verify_connection` | Verifica le credenziali SMTP senza inviare nulla |

## Requisito: password per le app di Google

La casella è su Google Workspace, che **non accetta la password normale
dell'account** per l'invio via SMTP. Serve una *password per le app*:

1. Accedi a scuole@buildinterest.it e attiva la **verifica in due passaggi**
   (obbligatoria per le password per le app)
2. Vai su <https://myaccount.google.com/apppasswords>
3. Crea una password per le app (nome a piacere, es. "MCP Email")
4. Copia i 16 caratteri generati

## Installazione

```bash
cd mcp-email
npm install
cp .env.example .env
# apri .env e incolla la password per le app in EMAIL_PASSWORD
npm run test-connection   # verifica che le credenziali funzionino
```

Il file `.env` è ignorato da git: le credenziali non vengono mai committate.

## Registrazione in Claude Code

Il file `.mcp.json` nella radice del repository registra già il server per
chi apre questo progetto con Claude Code. In alternativa, manualmente:

```bash
claude mcp add email-scuole -- node /percorso/assoluto/sito-interest/mcp-email/index.js
```

Per Claude Desktop, aggiungi a `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "email-scuole": {
      "command": "node",
      "args": ["/percorso/assoluto/sito-interest/mcp-email/index.js"]
    }
  }
}
```

## Uso

Una volta registrato, basta chiedere a Claude, ad esempio:

> Manda una mail a nome.cognome@esempio.it con oggetto "Convenzione scuole"
> e allega il PDF della brochure.

## Configurazione (variabili d'ambiente o `.env`)

| Variabile | Default | Note |
|-----------|---------|------|
| `EMAIL_USER` | `scuole@buildinterest.it` | Mittente |
| `EMAIL_PASSWORD` | — | **Obbligatoria**: password per le app |
| `SMTP_HOST` | `smtp.gmail.com` | |
| `SMTP_PORT` | `465` | TLS implicito |
| `EMAIL_FROM_NAME` | `Interest — Scuole` | Nome visualizzato |
