import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { DomandaStaff, FonteManuale } from '../data/types';
import { dataOra } from './MissiveTab';

type Msg =
  | { ruolo: 'utente'; testo: string }
  | { ruolo: 'bot'; testo: string; fonti: FonteManuale[]; domanda: string; esito?: 'si' | 'scrivi' | 'inviato' }
  | { ruolo: 'errore'; testo: string };

// la conversazione resta finché l'app è aperta, anche cambiando sezione
let memoria: Msg[] = [];

const ESEMPI = [
  'Quanti PF ha un Mezzo Gigante?',
  'Come funziona l’apprendimento di una nuova abilità?',
  'Posso combattere con due armi in armatura di piastre?',
];

export function ChiediTab({ onApri }: { onApri: (f: FonteManuale) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>(memoria);
  const [testo, setTesto] = useState('');
  const [busy, setBusy] = useState(false);
  const [rimaste, setRimaste] = useState<number | undefined>();
  const [domande, setDomande] = useState<DomandaStaff[]>([]);
  const fondo = useRef<HTMLDivElement>(null);

  const aggiorna = (m: Msg[]) => { memoria = m; setMsgs(m); };
  const ricaricaDomande = () => api.myQuestions().then(setDomande).catch(() => setDomande([]));
  useEffect(() => { ricaricaDomande(); }, []);
  useEffect(() => { fondo.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs.length, busy]);

  const invia = async (q: string) => {
    q = q.trim();
    if (!q || busy) return;
    const storia = msgs.filter((m) => m.ruolo !== 'errore').slice(-6).map((m) => ({ ruolo: m.ruolo as 'utente' | 'bot', testo: m.testo }));
    const conDomanda: Msg[] = [...msgs.map((m) => (m.ruolo === 'bot' && !m.esito ? { ...m, esito: 'si' as const } : m)), { ruolo: 'utente', testo: q }];
    aggiorna(conDomanda); setTesto(''); setBusy(true);
    try {
      const r = await api.chiedi(q, storia);
      setRimaste(r.rimaste);
      aggiorna([...conDomanda, { ruolo: 'bot', testo: r.risposta, fonti: r.fonti ?? [], domanda: q }]);
    } catch (e) {
      aggiorna([...conDomanda, { ruolo: 'errore', testo: (e as Error).message }]);
    } finally { setBusy(false); }
  };

  const esito = (i: number, e: 'si' | 'scrivi' | 'inviato') =>
    aggiorna(msgs.map((m, j) => (j === i && m.ruolo === 'bot' ? { ...m, esito: e } : m)));
  const ultimoBot = msgs.map((m) => m.ruolo).lastIndexOf('bot');
  const risposteNuove = domande.filter((d) => d.stato === 'risposta').length;

  return (
    <div className="chat-page">
      <div className="chat-scroll">
      {domande.length > 0 && (
        <details className="dom-staff" open={risposteNuove > 0 && msgs.length === 0}>
          <summary>Le tue domande allo staff <span className="hint">({domande.length}{risposteNuove ? `, ${risposteNuove} con risposta` : ''})</span></summary>
          {domande.map((d) => (
            <div key={d.id} className="dom-item">
              <p className="dom-q">{d.domanda}</p>
              {d.messaggio && <p className="hint">{d.messaggio}</p>}
              {d.risposta
                ? <div className="dom-r"><span className="tag">Risposta dello staff{d.rispostaIl ? `, ${dataOra(d.rispostaIl)}` : ''}</span><p>{d.risposta}</p></div>
                : <p className="hint">In attesa di risposta (inviata {dataOra(d.creata)})</p>}
            </div>
          ))}
        </details>
      )}

      <div className="chat" aria-live="polite">
        {msgs.length === 0 && (
          <div className="chat-empty">
            <p>Fai una domanda sulle regole o sul mondo di Grayvent: la risposta arriva dai manuali, con manuale e pagina.</p>
            <div className="chips">
              {ESEMPI.map((e) => <button key={e} className="chip" onClick={() => invia(e)}>{e}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => m.ruolo === 'utente' ? (
          <div key={i} className="bubble me">{m.testo}</div>
        ) : m.ruolo === 'errore' ? (
          <div key={i} className="bubble err">{m.testo}</div>
        ) : (
          <div key={i} className="bubble bot">
            <div className="bot-text">{m.testo}</div>
            {m.fonti.length > 0 && (
              <div className="fonti">
                {dedup(m.fonti).map((f) => (
                  <button key={f.manuale + f.pagina} className="fonte" onClick={() => onApri(f)}>{f.titolo}, pag. {f.pagina}</button>
                ))}
              </div>
            )}
            <p className="bot-note">In caso di dubbio decidono i Master.</p>
            {i === ultimoBot && !busy && <Esito m={m} onSi={() => esito(i, 'si')} onScrivi={() => esito(i, 'scrivi')}
              onAnnulla={() => aggiorna(msgs.map((x, j) => (j === i && x.ruolo === 'bot' ? { ...x, esito: undefined } : x)))}
              onInviato={() => { esito(i, 'inviato'); ricaricaDomande(); }} />}
          </div>
        ))}
        {busy && <Attesa />}
        <div ref={fondo} />
      </div>
      </div>

      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); invia(testo); }}>
        <textarea value={testo} rows={1} maxLength={1000} placeholder="Scrivi la tua domanda…" aria-label="La tua domanda"
          onChange={(e) => setTesto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); invia(testo); } }} />
        <button className="btn primary" disabled={busy || testo.trim().length < 3} aria-label="Invia la domanda">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12l16-8-6 16-2.5-6.5z" /></svg>
        </button>
      </form>
      {rimaste !== undefined && rimaste <= 5 && <p className="hint chat-limit">Domande rimaste oggi: {rimaste}</p>}
    </div>
  );
}

function Esito({ m, onSi, onScrivi, onAnnulla, onInviato }: {
  m: Extract<Msg, { ruolo: 'bot' }>; onSi: () => void; onScrivi: () => void; onAnnulla: () => void; onInviato: () => void;
}) {
  const [nota, setNota] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (m.esito === 'si') return null;
  if (m.esito === 'inviato') return <p className="esito ok">Domanda inviata allo staff: la risposta arriverà qui e per email.</p>;
  if (m.esito === 'scrivi') return (
    <div className="esito">
      <label htmlFor="nota-staff" className="flabel">Vuoi aggiungere qualcosa per lo staff? (facoltativo)</label>
      <textarea id="nota-staff" rows={3} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Es. il caso preciso che ti interessa" />
      {err && <p className="error">{err}</p>}
      <div className="esito-btns">
        <button className="btn ghost" onClick={onAnnulla} disabled={busy}>Annulla</button>
        <button className="btn primary" disabled={busy} onClick={async () => {
          setBusy(true); setErr('');
          try { await api.askStaff({ domanda: m.domanda, rispostaBot: m.testo, messaggio: nota.trim() || undefined }); onInviato(); }
          catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
        }}>{busy ? 'Invio…' : 'Invia allo staff'}</button>
      </div>
    </div>
  );
  return (
    <div className="esito">
      <p>Hai ottenuto la risposta che stavi cercando?</p>
      <div className="esito-btns">
        <button className="btn ghost" onClick={onSi}>Sì</button>
        <button className="btn ghost" onClick={onScrivi}>No, contatta lo staff</button>
      </div>
    </div>
  );
}

const dedup = (f: FonteManuale[]) => f.filter((x, i) => f.findIndex((y) => y.manuale === x.manuale && y.pagina === x.pagina) === i).slice(0, 5);

/** Messaggio di attesa che cambia col passare dei secondi, così si capisce che il chatbot sta lavorando */
function Attesa() {
  const [s, setS] = useState(0);
  useEffect(() => { const t = setInterval(() => setS((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const testo = s < 4 ? 'Sto consultando i manuali…' : s < 10 ? 'Sto leggendo i passaggi giusti…' : s < 20 ? 'Sto scrivendo la risposta…' : 'Ci vuole un po’ più del solito, quasi fatto…';
  return <div className="bubble bot typing" role="status" aria-label={testo}><span /><span /><span /> <em>{testo}</em></div>;
}
