import { useEffect, useRef } from 'react';

/*
 * Tasto "indietro" del telefono (Android) e gesto indietro del browser.
 * Senza questo l'app non ha pagine nella cronologia e indietro la chiude.
 * Ogni schermata aperta sopra un'altra (scheda di dettaglio, modulo, foglio, manuale, chat, altra sezione)
 * si registra: indietro chiude l'ultima aperta. Dalla schermata principale, il primo indietro mostra
 * "Premi di nuovo indietro per uscire" e solo il secondo, entro 2 secondi, esce.
 */
type Voce = { id: number; chiudi: () => void };
const pila: Voce[] = [];
let prossimo = 1;
let daIgnorare = 0;
let avviato = false;
let ultimoAvviso = 0;
let avvisa: (t: string) => void = () => {};

export function impostaAvviso(fn: (t: string) => void) { avvisa = fn; }

function avvia() {
  if (avviato || typeof window === 'undefined') return;
  avviato = true;
  try { history.pushState({ gv: 'base' }, ''); } catch { return; }
  addEventListener('popstate', () => {
    if (daIgnorare > 0) { daIgnorare--; return; }
    const v = pila.pop();
    if (v) { v.chiudi(); return; }
    // schermata principale
    const ora = Date.now();
    if (ora - ultimoAvviso < 2000) { history.back(); return; } // secondo indietro: esce
    ultimoAvviso = ora;
    avvisa('Premi di nuovo indietro per uscire');
    history.pushState({ gv: 'base' }, '');
  });
}

/** Mentre `attivo` è vero, il tasto indietro chiama `chiudi` invece di uscire dall'app */
export function useIndietro(attivo: boolean, chiudi: () => void) {
  const rif = useRef(chiudi);
  rif.current = chiudi;
  useEffect(() => {
    if (!attivo) return;
    avvia();
    const voce: Voce = { id: prossimo++, chiudi: () => rif.current() };
    pila.push(voce);
    try { history.pushState({ gv: voce.id }, ''); } catch { /* niente */ }
    return () => {
      const i = pila.indexOf(voce);
      if (i >= 0) {
        // chiusa dall'app (pulsante, salvataggio): tolgo la sua voce dalla cronologia senza richiamare chiudi
        pila.splice(i, 1);
        daIgnorare++;
        history.back();
      }
    };
  }, [attivo]);
}

/** Da chiamare una volta all'avvio: prepara la cronologia anche se non c'è nessuna schermata aperta */
export function useIndietroBase(avviso: (t: string) => void) {
  useEffect(() => { impostaAvviso(avviso); avvia(); }, [avviso]);
}
