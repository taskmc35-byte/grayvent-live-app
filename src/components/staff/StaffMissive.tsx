import { useEffect, useState } from 'react';
import { api, IMPOSTAZIONI_DEFAULT } from '../../api';
import type { DomandaStaff, Evento, Impostazioni, Missiva, MissivaStaff } from '../../data/types';
import type { StaffCharacter } from '../../api';
import { TIPI, dataOra } from '../MissiveTab';
import { useIndietro } from '../../indietro';

type Filtro = 'da_leggere' | 'tutte' | 'domande' | 'addebiti' | 'spedite';

export function StaffMissive({ onToast, onCount }: { onToast: (t: string) => void; onCount?: (n: number) => void }) {
  const [list, setList] = useState<Missiva[]>([]);
  const [eventi, setEventi] = useState<Evento[]>([]);
  const [imp, setImp] = useState<Impostazioni>(IMPOSTAZIONI_DEFAULT);
  const [filtro, setFiltro] = useState<Filtro>('da_leggere');
  const [aperta, setAperta] = useState<Missiva | null>(null);
  const [domande, setDomande] = useState<DomandaStaff[]>([]);
  const [domanda, setDomanda] = useState<DomandaStaff | null>(null);
  const [scrivi, setScrivi] = useState(false);
  const [spedite, setSpedite] = useState<MissivaStaff[]>([]);
  const [spedita, setSpedita] = useState<MissivaStaff | null>(null);
  useIndietro(!!aperta, () => setAperta(null));
  useIndietro(!!domanda, () => setDomanda(null));
  useIndietro(scrivi, () => setScrivi(false));
  useIndietro(!!spedita, () => setSpedita(null));
  const reloadSpedite = () => api.allStaffLetters().then(setSpedite).catch(() => setSpedite([]));
  useEffect(() => { reloadSpedite(); }, []);
  const reload = async () => {
    const [l, e, s, q] = await Promise.all([api.allLetters(), api.events(), api.settings(), api.allQuestions().catch(() => [])]);
    setList(l); setEventi(e); setImp(s); setDomande(q);
    onCount?.(l.filter((m) => m.stato === 'inviata').length + q.filter((d) => d.stato === 'aperta').length);
  };
  useEffect(() => { reload(); }, []);

  if (scrivi) return <ScriviMissiva onCancel={() => setScrivi(false)}
    onSent={async (n) => { setScrivi(false); onToast(n === 1 ? 'Missiva spedita' : `${n} missive spedite`); setFiltro('spedite'); await reloadSpedite(); }} />;
  if (spedita) return (
    <div className="page">
      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setSpedita(null)}>Torna alle missive</button>
      <article className="letter">
        <span className="tag">Spedita dallo staff, {dataOra(spedita.inviata)}</span>
        <h2>A {spedita.destinatario}</h2>
        <p className="letter-body">{spedita.testo}</p>
        <p className="letter-sign">{spedita.mittente}</p>
      </article>
      <p className="hint">{spedita.letta ? `Letta dal giocatore il ${dataOra(spedita.letta)}.` : 'Il giocatore non l’ha ancora aperta.'}</p>
    </div>
  );
  if (domanda) return <Domanda d={domanda} onBack={() => setDomanda(null)}
    onReply={async (t) => { await api.replyQuestion(domanda.id, t); onToast('Risposta inviata'); setDomanda(null); await reload(); }} />;
  if (aperta) return <Lettera m={aperta} imp={imp} onBack={async () => { setAperta(null); await reload(); }}
    onReply={async (t) => { await api.replyLetter(aperta.id, t); onToast('Risposta inviata'); setAperta(null); await reload(); }} />;

  const oggi = new Date().toISOString().slice(0, 10);
  const ultimo = [...eventi].filter((e) => (e.dataFine || e.dataInizio) < oggi).pop();
  const daEvento = ultimo ? new Date((ultimo.dataFine || ultimo.dataInizio) + 'T23:59:59').toISOString() : '';
  const azzerati = imp.addebitiAzzeratiIl ?? '';
  const da = azzerati > daEvento ? azzerati : daEvento;
  const recenti = list.filter((m) => !da || m.inviata > da);
  const perPg = new Map<string, Missiva[]>();
  for (const m of recenti) perPg.set(m.mittente, [...(perPg.get(m.mittente) ?? []), m]);

  const vis = filtro === 'da_leggere' ? list.filter((m) => m.stato === 'inviata') : list;
  return (
    <div className="page">
      <div className="list-head">
        <h1>Missive</h1>
        <button className="btn primary" onClick={() => setScrivi(true)}>Scrivi</button>
      </div>
      <div className="seg seg-wrap" role="tablist">
        <button role="tab" aria-selected={filtro === 'da_leggere'} onClick={() => setFiltro('da_leggere')}>Nuove ({list.filter((m) => m.stato === 'inviata').length})</button>
        <button role="tab" aria-selected={filtro === 'tutte'} onClick={() => setFiltro('tutte')}>Tutte</button>
        <button role="tab" aria-selected={filtro === 'domande'} onClick={() => setFiltro('domande')}>Domande{domande.some((d) => d.stato === 'aperta') ? ` (${domande.filter((d) => d.stato === 'aperta').length})` : ''}</button>
        <button role="tab" aria-selected={filtro === 'addebiti'} onClick={() => setFiltro('addebiti')}>Addebiti</button>
        <button role="tab" aria-selected={filtro === 'spedite'} onClick={() => setFiltro('spedite')}>Spedite</button>
      </div>
      {filtro === 'spedite' ? (
        <section>
          <p className="hint">Missive scritte dallo staff ai personaggi. Il giocatore le riceve nell’app e per email, e non può rispondere.</p>
          {!spedite.length && <p className="hint">Nessuna missiva spedita dallo staff.</p>}
          {spedite.map((m) => (
            <button key={m.id} className="row-btn" onClick={() => setSpedita(m)}>
              <span>{m.mittente} a {m.destinatario}</span>
              <small>{dataOra(m.inviata)}, <b className={m.letta ? '' : 'gold'}>{m.letta ? 'letta' : 'non ancora letta'}</b></small>
            </button>
          ))}
        </section>
      ) : filtro === 'domande' ? (
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
          <p className="hint">Missive spedite {da === azzerati && azzerati ? `dopo l’azzeramento del ${dataOra(azzerati)}` : ultimo ? `dopo ${ultimo.titolo}` : 'finora'}, da scalare in Astri d’Argento all’inizio del prossimo evento. I costi si cambiano in Altro, Missive.</p>
          {!perPg.size && <p className="hint">Nessuna missiva da addebitare.</p>}
          {perPg.size > 0 && <Azzera onAzzera={async () => {
            const s = await api.settings();
            await api.saveSettings({ ...s, addebitiAzzeratiIl: new Date().toISOString() });
            await reload(); onToast('Addebiti azzerati');
          }} />}
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

/** Lo staff scrive una missiva (firmata da un PNG o da chi vuole) a uno o più personaggi in gioco */
function ScriviMissiva({ onCancel, onSent }: { onCancel: () => void; onSent: (n: number) => Promise<void> }) {
  const [pgs, setPgs] = useState<StaffCharacter[] | null>(null);
  const [scelti, setScelti] = useState<Set<string>>(new Set());
  const [cerca, setCerca] = useState('');
  const [mittente, setMittente] = useState('');
  const [testo, setTesto] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.allCharacters().then((l) => setPgs(l.filter((c) => c.attivo && c.stato === 'approvato' && c.proprietario)
      .sort((a, b) => `${a.nome} ${a.cognome}`.localeCompare(`${b.nome} ${b.cognome}`)))).catch(() => setPgs([]));
  }, []);
  const nome = (c: StaffCharacter) => `${c.nome} ${c.cognome}`.trim();
  const q = cerca.trim().toLowerCase();
  const vis = (pgs ?? []).filter((c) => !q || nome(c).toLowerCase().includes(q) || (c.giocatore ?? '').toLowerCase().includes(q));
  const tocca = (id: string) => setScelti((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mittente.trim()) { setErr('Scrivi chi firma la missiva.'); return; }
    if (!scelti.size) { setErr('Scegli almeno un destinatario.'); return; }
    if (!testo.trim()) { setErr('Scrivi il testo della missiva.'); return; }
    setBusy(true); setErr('');
    try {
      const dest = (pgs ?? []).filter((c) => scelti.has(c.id)).map((c) => ({ id: c.id, nome: nome(c) }));
      await api.sendStaffLetter(mittente.trim(), testo.trim(), dest);
      await onSent(dest.length);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <form className="page form" onSubmit={send}>
      <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={onCancel}>Annulla</button>
      <h1 style={{ fontSize: '1.9rem' }}>Missiva ai personaggi</h1>
      <div className="field"><label htmlFor="ms-mitt">Firmata da</label>
        <input id="ms-mitt" value={mittente} onChange={(e) => setMittente(e.target.value)} placeholder="Es. Jarl Raven, un messaggero, la Gilda dei Mercanti" />
      </div>
      <fieldset className="fs">
        <legend>Destinatari{scelti.size ? ` (${scelti.size})` : ''}</legend>
        <input type="search" className="search" value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca personaggio o giocatore" aria-label="Cerca personaggio o giocatore" />
        <div className="dest-list">
          {pgs === null && <p className="hint">Carico i personaggi…</p>}
          {pgs?.length === 0 && <p className="hint">Nessun personaggio approvato e in gioco.</p>}
          {vis.map((c) => (
            <label key={c.id} className="check">
              <input type="checkbox" checked={scelti.has(c.id)} onChange={() => tocca(c.id)} />
              <span>{nome(c)}{c.giocatore && <small className="hint"> ({c.giocatore})</small>}</span>
            </label>
          ))}
        </div>
        {(pgs?.length ?? 0) > 1 && (
          <div className="dest-azioni">
            <button type="button" className="link" onClick={() => setScelti(new Set([...scelti, ...vis.map((c) => c.id)]))}>Seleziona {q ? 'quelli trovati' : 'tutti'}</button>
            {scelti.size > 0 && <button type="button" className="link" onClick={() => setScelti(new Set())}>Togli tutti</button>}
          </div>
        )}
      </fieldset>
      <div className="field"><label htmlFor="ms-testo">Testo</label><textarea id="ms-testo" rows={10} value={testo} onChange={(e) => setTesto(e.target.value)} /></div>
      <p className="hint">Ogni personaggio riceve la sua copia nell’app e per email, con il testo completo. Non potrà rispondere dall’app.</p>
      {err && <p className="error">{err}</p>}
      <button className="btn primary block" disabled={busy}>{busy ? 'Spedisco…' : scelti.size > 1 ? `Spedisci a ${scelti.size} personaggi` : 'Spedisci'}</button>
    </form>
  );
}

/** Azzera gli addebiti di tutti: le missive restano, ma da adesso si ricomincia a contare */
function Azzera({ onAzzera }: { onAzzera: () => Promise<void> }) {
  const [conferma, setConferma] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!conferma) return <button className="btn ghost block" onClick={() => setConferma(true)}>Azzera tutti gli addebiti</button>;
  return (
    <div className="azzera-box">
      <p>Azzerare gli addebiti delle missive di tutti i personaggi? Le missive restano nell’archivio; da adesso il conteggio riparte da zero.</p>
      <div className="sheet-actions">
        <button className="btn ghost" disabled={busy} onClick={() => setConferma(false)}>Annulla</button>
        <button className="btn danger" disabled={busy} onClick={async () => { setBusy(true); try { await onAzzera(); } finally { setBusy(false); setConferma(false); } }}>{busy ? 'Azzero…' : 'Sì, azzera'}</button>
      </div>
    </div>
  );
}
