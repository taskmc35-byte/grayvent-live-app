import { useEffect, useState } from 'react';
import { attivaPush, disattivaPush, statoPush, type StatoPush } from '../push';

const CHIUSO = 'gv-push-invito-chiuso';
const letto = () => { try { return localStorage.getItem(CHIUSO) === '1'; } catch { return false; } };

function useStato() {
  const [stato, setStato] = useState<StatoPush | null>(null);
  const aggiorna = () => statoPush().then(setStato).catch(() => setStato('non-supportate'));
  useEffect(() => { aggiorna(); }, []);
  return { stato, aggiorna };
}

/** Invito gentile, una volta sola: compare solo se le notifiche si possono attivare e sono spente */
export function InvitoNotifiche({ onToast }: { onToast: (t: string) => void }) {
  const { stato, aggiorna } = useStato();
  const [chiuso, setChiuso] = useState(letto);
  const [busy, setBusy] = useState(false);
  const visibile = !chiuso && stato === 'spente';
  // la Scheda si adatta all'altezza dello schermo: le dico che lo spazio sopra è cambiato
  useEffect(() => { window.dispatchEvent(new Event('gv-layout')); }, [visibile]);
  if (!visibile) return null;
  const chiudi = () => { try { localStorage.setItem(CHIUSO, '1'); } catch { /* niente */ } setChiuso(true); };
  return (
    <div className="push-invito" role="region" aria-label="Notifiche">
      <span className="push-campana" aria-hidden="true"><Campana /></span>
      <div className="push-testo">
        <strong>Ricevi gli avvisi sul telefono</strong>
        <span>Missive, scheda approvata, nuovi eventi: una notifica appena succede.</span>
        <div className="push-azioni">
          <button className="btn primary" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await attivaPush(); onToast('Notifiche attivate'); chiudi(); } catch (e) { onToast((e as Error).message); } finally { setBusy(false); aggiorna(); }
          }}>{busy ? 'Attivo…' : 'Attiva'}</button>
          <button className="btn ghost" onClick={chiudi}>Non ora</button>
        </div>
      </div>
    </div>
  );
}

/** Interruttore fisso per accendere o spegnere le notifiche su questo dispositivo */
export function InterruttoreNotifiche({ onToast }: { onToast: (t: string) => void }) {
  const { stato, aggiorna } = useStato();
  const [busy, setBusy] = useState(false);
  if (stato === null) return null;
  const attive = stato === 'attive';
  const nota: Record<StatoPush, string> = {
    attive: 'Attive su questo dispositivo.',
    spente: 'Spente su questo dispositivo.',
    bloccate: 'Bloccate: riattivale dalle impostazioni del telefono o del browser per questo sito, poi torna qui.',
    'non-supportate': 'Questo browser non supporta le notifiche. Su Android usa l’app installata o Chrome.',
    'ios-home': 'Su iPhone le notifiche funzionano solo con l’app aggiunta alla schermata Home: in Safari tocca Condividi → Aggiungi alla schermata Home, poi apri l’app da lì.',
    prova: 'Nella versione di prova le notifiche non vengono inviate.',
  };
  return (
    <div className="push-riga">
      <span className="push-campana piccola" aria-hidden="true"><Campana /></span>
      <div className="push-testo">
        <strong>Notifiche sul telefono</strong>
        <span>{nota[stato]}</span>
      </div>
      {(stato === 'attive' || stato === 'spente') && (
        <button role="switch" aria-checked={attive} aria-label="Notifiche sul telefono" className={`interruttore${attive ? ' on' : ''}`} disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              if (attive) { await disattivaPush(); onToast('Notifiche spente'); }
              else { await attivaPush(); onToast('Notifiche attivate'); }
            } catch (e) { onToast((e as Error).message); } finally { setBusy(false); aggiorna(); }
          }}><span /></button>
      )}
    </div>
  );
}

const Campana = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" />
  </svg>
);
