import { useEffect, useState } from 'react';
import { api, IMPOSTAZIONI_DEFAULT } from '../../api';
import type { DomandaStaff, Evento, Impostazioni, Missiva } from '../../data/types';
import { TIPI, dataOra } from '../MissiveTab';

type Filtro = 'da_leggere' | 'tutte' | 'domande' | 'addebiti';

export function StaffMissive({ onToast, onCount }: { onToast: (t: string) => void; onCount?: (n: number) => void }) {
  const [list, setList] = useState<Missiva[]>([]);
  const [eventi, setEventi] = useState<Evento[]>([]);
  const [imp, setImp] = useState<Impostazioni>(IMPOSTAZIONI_DEFAULT);
  const [filtro, setFiltro] = useState<Filtro>('da_leggere');
  const [aperta, setAperta] = useState<Missiva | null>(null);
  const [domande, setDomande] = useState<DomandaStaff[]>([]);
  const [domanda, setDomanda] = useState<DomandaStaff | null>(null);
  const reload = async () => {
    const [l, e, s, q] = await Promise.all([api.allLetters(), api.events(), api.settings(), api.allQuestions().catch(() => [])]);
    setList(l); setEventi(e); setImp(s); setDomande(q);
    onCount?.(l.filter((m) => m.stato === 'inviata').length + q.filter((d) => d.stato === 'aperta').length);
  };
  useEffect(() => { reload(); }, []);

  if (domanda) return <Domanda d={domanda} onBack={() => setDomanda(null)}
    onReply={async (t) => { await api.replyQuestion(domanda.id, t); onToast('Risposta inviata'); setDomanda(null); await reload(); }} />;
  if (aperta) return <Lettera m={aperta} imp={imp} onBack={async () => { setAperta(null); await reload(); }}
    onReply={async (t) => { await api.replyLetter(aperta.id, t); onToast('Risposta inviata'); setAperta(null); await reload(); }} />;

  const oggi = new Date().toISOString().slice(0, 10);
  const ultimo = [...eventi].filter((e) => (e.dataFine || e.dataInizio) < oggi).pop();
  const da = ultimo ? (ultimo.dataFine || ultimo.dataInizio) + 'T23:59:59' : '';
  const recenti = list.filter((m) => !da || m.inviata > da);
  const perPg = new Map<string, Missiva[]>();
  for (const m of recenti) perPg.set(m.mittente, [...(perPg.get(m.mittente) ?? []), m]);

  const vis = filtro === 'da_leggere' ? list.filter((m) => m.stato === 'inviata') : list;
  return (
    <div className="page">
      <h1>Missive</h1>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={filtro === 'da_leggere'} onClick={() => setFiltro('da_leggere')}>Nuove ({list.filter((m) => m.stato === 'inviata').length})</button>
        <button role="tab" aria-selected={filtro === 'tutte'} onClick={() => setFiltro('tutte')}>Tutte</button>
        <button role="tab" aria-selected={filtro === 'domande'} onClick={() => setFiltro('domande')}>Domande{domande.some((d) => d.stato === 'aperta') ? ` (${domande.filter((d) => d.stato === 'aperta').length})` : ''}</button>
        <button role="tab" aria-selected={filtro === 'addebiti'} onClick={() => setFiltro('addebiti')}>Addebiti</button>
      </div>
      {filtro === 'domande' ? (
        <section>
          <p className="hint">Domande dei giocatori che non hanno trovato risposta nel chatbot dei manuali. La risposta arriva al giocatore nell’app e per email.</p>
          {!domande.length && <p className="hint">Nessuna domanda ricevuta.</p>}
          {domande.map((d) => (
            <button key={d.id} className="row-btn" onClick={() => setDomanda(d)}>
              <span>{d.domanda}</span>
              <small>{dataOra(d.creata)}, <b className={d.stato === 'aperta' ? 'gold' : ''}>{d.stato === 'aperta' ? 'da rispondere' : 'risposta inviata'}</b></small>
            </button>
          ))}
        </section>
      ) : filtro === 'addebiti' ? (
        <section>
          <p className="hint">Missive spedite {ultimo ? `dopo ${ultimo.titolo}` : 'finora'}, da scalare in Astri d’Argento all’inizio del prossimo evento. I costi si cambiano in Altro, Missive.</p>
          {!perPg.size && <p className="hint">Nessuna missiva da addebitare.</p>}
          {[...perPg.entries()].map(([pg, ms]) => {
            const tot = ms.reduce((s, m) => s + (imp.missive[m.tipo]?.costo ?? 0), 0);
            const conta = TIPI.map((t) => ({ t, n: ms.filter((m) => m.tipo === t.id).length })).filter((x) => x.n);
            return (
              <div key={pg} className="acc-row">
                <div><strong>{pg}</strong><small>{conta.map((x) => `${x.n} ${x.t.nome.toLowerCase()}`).join(', ')}</small></div>
                <strong className="gold">{tot.toLocaleString('it-IT')} AA</strong>
              </div>
            );
          })}
        </section>
      ) : (
        <div>
          {!vis.length && <p className="hint">{filtro === 'da_leggere' ? 'Nessuna missiva nuova.' : 'Nessuna missiva ricevuta.'}</p>}
          {vis.map((m) => (
            <button key={m.id} className="row-btn" onClick={async () => { await api.markLetterRead(m.id); setAperta(m); }}>
              <span>{m.mittente} a {m.destinatario}</span>
              <small>{TIPI.find((t) => t.id === m.tipo)?.nome}, {dataOra(m.inviata)}{m.stato === 'inviata' ? ', nuova' : m.stato === 'risposta' ? ', risposta inviata' : ''}{imp.missive[m.tipo]?.rispostaApp && m.stato !== 'risposta' ? ', attende risposta' : ''}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Lettera({ m, imp, onBack, onReply }: { m: Missiva; imp: Impostazioni; onBack: () => void; onReply: (t: string) => Promise<void> }) {
  const puoRispondere = !!imp.missive[m.tipo]?.rispostaApp;
  const nomeTipo = TIPI.find((t) => t.id === m.tipo)?.nome ?? m.tipo;
  const [testo, setTesto] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="page">
      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={onBack}>Torna alle missive</button>
      <article className="letter">
        <span className="tag">{nomeTipo}, {dataOra(m.inviata)}</span>
        <h2>A {m.destinatario}</h2>
        <p className="letter-body">{m.testo}</p>
        <p className="letter-sign">{m.mittente}</p>
      </article>
      {m.risposta && (
        <article className="letter reply"><span className="tag">Risposta inviata</span><p className="letter-body">{m.risposta}</p></article>
      )}
      {puoRispondere && !m.risposta && (
        <form className="form" onSubmit={async (e) => { e.preventDefault(); if (!testo.trim()) return; setBusy(true); try { await onReply(testo.trim()); } finally { setBusy(false); } }}>
          <div className="field"><label htmlFor="rep">Risposta di {m.destinatario}</label><textarea id="rep" rows={8} value={testo} onChange={(e) => setTesto(e.target.value)} /></div>
          <button className="btn primary block" disabled={busy || !testo.trim()}>{busy ? 'Invio…' : 'Invia la risposta'}</button>
        </form>
      )}
      {!puoRispondere && <p className="hint">A questo tipo di lettera ({nomeTipo.toLowerCase()}) si risponde fuori dall’app, come da regolamento.</p>}
    </div>
  );
}

export function ImpostazioniMissive({ onToast }: { onToast: (t: string) => void }) {
  const [imp, setImp] = useState<Impostazioni | null>(null);
  useEffect(() => { api.settings().then(setImp); }, []);
  if (!imp) return null;
  return (
    <form className="form" onSubmit={async (e) => { e.preventDefault(); await api.saveSettings(imp); onToast('Impostazioni salvate'); }}>
      <p className="hint">Costo in Astri d’Argento, descrizione e possibilità di risposta dall’app per ogni tipo di lettera. Il giocatore vede costo e descrizione quando scrive.</p>
      {TIPI.map((t) => (
        <fieldset key={t.id} className="fs">
          <legend>{t.nome}</legend>
          <div className="field"><label htmlFor={`c-${t.id}`}>Costo (AA)</label>
            <input id={`c-${t.id}`} type="number" min={0} value={imp.missive[t.id].costo} onChange={(e) => setImp({ ...imp, missive: { ...imp.missive, [t.id]: { ...imp.missive[t.id], costo: Number(e.target.value) || 0 } } })} />
          </div>
          <div className="field"><label htmlFor={`d-${t.id}`}>Descrizione</label>
            <textarea rows={2} id={`d-${t.id}`} value={imp.missive[t.id].descrizione} onChange={(e) => setImp({ ...imp, missive: { ...imp.missive, [t.id]: { ...imp.missive[t.id], descrizione: e.target.value } } })} />
          </div>
          <label className="check"><input type="checkbox" checked={imp.missive[t.id].rispostaApp} onChange={(e) => setImp({ ...imp, missive: { ...imp.missive, [t.id]: { ...imp.missive[t.id], rispostaApp: e.target.checked } } })} /><span>Lo staff può rispondere dall’app</span></label>
        </fieldset>
      ))}
      <button className="btn primary block">Salva impostazioni</button>
    </form>
  );
}

function Domanda({ d, onBack, onReply }: { d: DomandaStaff; onBack: () => void; onReply: (t: string) => Promise<void> }) {
  const [testo, setTesto] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="page">
      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={onBack}>Torna alle domande</button>
      <article className="letter">
        <span className="tag">Domanda allo staff, {dataOra(d.creata)}</span>
        <h2 style={{ fontSize: '1.4rem' }}>{d.domanda}</h2>
        {d.messaggio && <p className="letter-body">{d.messaggio}</p>}
        {d.rispostaBot && (<><span className="tag">Risposta del chatbot (non soddisfacente)</span><p className="letter-body hint">{d.rispostaBot}</p></>)}
      </article>
      {d.risposta ? (
        <article className="letter reply"><span className="tag">Risposta inviata{d.rispostaIl ? `, ${dataOra(d.rispostaIl)}` : ''}</span><p className="letter-body">{d.risposta}</p></article>
      ) : (
        <div className="form">
          <div className="field"><label htmlFor="dom-r">Risposta</label><textarea id="dom-r" rows={6} value={testo} onChange={(e) => setTesto(e.target.value)} /></div>
          {err && <p className="error">{err}</p>}
          <button className="btn primary block" disabled={busy || !testo.trim()} onClick={async () => {
            setBusy(true); setErr('');
            try { await onReply(testo.trim()); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
          }}>{busy ? 'Invio…' : 'Invia la risposta'}</button>
        </div>
      )}
    </div>
  );
}
