# Da riaggiungere al sito

Cose rimosse di proposito, da rimettere quando il resto è a posto.

## 5x1000 — blocco nel footer

**Rimosso l'8 agosto 2026**: appesantiva troppo il footer, che era già carico.

Cosa c'era, pronto da recuperare:

- Titolo: **"Il tuo 5x1000 non ti costa niente."**
- Testo: "Firma nel riquadro delle associazioni di promozione sociale e scrivi il nostro codice fiscale: è una quota di tasse che paghi comunque."
- Pulsante bianco col codice fiscale **18028181008** e l'etichetta "Copia": cliccandolo copiava il numero negli appunti e la scritta diventava "Copiato" per due secondi. Con fallback per i browser che bloccano la copia automatica (selezionava il numero).

**Dove rimetterlo**: probabilmente non nel footer ma in una sezione sua, o dentro la futura pagina "Sostienici". Il codice fiscale deve restare copiabile con un click: è il gesto che non costa nulla al donatore e va reso il più semplice possibile.

Il CSS delle classi `.foot__5x`, `.foot__5x-t`, `.foot__5x-d`, `.cf`, `.cf__n`, `.cf__a` e la relativa funzione JavaScript sono stati rimossi da `index.html`: vanno riscritti.

## Numeri di impatto (51 scuole, 4.845 studenti, 8,52/10, 46,5%)

**Rimossi l'8 agosto 2026** prima dall'hero e poi dal footer.

Restano validi e verificati (fonte: Impact Report luglio 2026, A.S. 2025/26). Da usare nella futura pagina "Impatto" o dentro "Cosa facciamo", non come fascia isolata.
