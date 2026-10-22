import { useEffect, useMemo, useRef, useState } from 'react';
import type { Ability, Categoria, Character, Spell } from '../data/types';
import { TABELLE } from '../data/abilities';
import { creaIndice, cercaScritto, nomeVoce, suggerimenti, trovaNelTesto, type Voce } from '../cartellino';
import { DettaglioAbilita } from './AbilitaTab';
import { DettaglioPotere } from './PoteriTab';
import { etichettaScuola } from '../poteri';
import { useIndietro } from '../indietro';

/** Evento globale che apre il lettore di cartellini (come la chat) */
export const APRI_CARTELLINO = 'grayvent:apri-cartellino';
export const apriCartellino = () => window.dispatchEvent(new Event(APRI_CARTELLINO));

const CAT: Record<Categoria, string> = { fisico: 'Fisico', mentale: 'Mentale', sovrannaturale: 'Spirituale' };

/** Montato una volta nell'app: si apre con apriCartellino() */
export function LettoreCartellino(props: { catalog: Ability[]; spells: Spell[]; pg?: Character; staff?: boolean }) {
  const [aperto, setAperto] = useState(false);
  useEffect(() => {
    const apri = () => setAperto(true);
    window.addEventListener(APRI_CARTELLINO, apri);
    return () => window.removeEventListener(APRI_CARTELLINO, apri);
  }, []);
  if (!aperto) return null;
  return <Pannello {...props} onClose={() => setAperto(false)} />;
}

function Pannello({ catalog, spells, pg, staff, onClose }: { catalog: Ability[]; spells: Spell[]; pg?: Character; staff?: boolean; onClose: () => void }) {
  const idx = useMemo(() => creaIndice(catalog, spells, TABELLE), [catalog, spells]);
  const [q, setQ] = useState('');
  const [trovate, setTrovate] = useState<Voce[] | null>(null); // dalla foto
  const [scelta, setScelta] = useState<Voce | null>(null);
  const [lettura, setLettura] = useState<number | null>(null);
  const [errore, setErrore] = useState('');
  const [letto, setLetto] = useState(''); // testo letto, mostrato se non trova codici
  const [forse, setForse] = useState<Voce[]>([]); // codici quasi letti (es. scrittura a mano)
  const [tentativo, setTentativo] = useState(0);
  const [ultima, setUltima] = useState<{ file: File; url: string } | null>(null); // per toccare il codice nella foto
  useEffect(() => () => { if (ultima) URL.revokeObjectURL(ultima.url); }, [ultima]);
  const foto = useRef<HTMLInputElement>(null);
  const galleria = useRef<HTMLInputElement>(null);
  useIndietro(true, () => (scelta ? setScelta(null) : onClose()));

  const scritte = q.trim() ? cercaScritto(idx, q) : [];

  const prova = async (file: File, zona?: { x: number; y: number }) => {
    setErrore(''); setTrovate(null); setScelta(null); setLettura(0); setLetto(''); setForse([]);
    try {
      const { leggiFoto, PASSATE, passateZona } = await import('../ocr');
      const passate = zona ? passateZona(zona.x, zona.y) : PASSATE;
      let voci: Voce[] = [];
      const testi: string[] = [];
      // più tentativi: normale, solo codici, a pezzi, bianco e nero, foto girata
      for (const [i, pass] of passate.entries()) {
        setTentativo(i + 1); setLettura(0);
        const t = await leggiFoto(file, (p) => setLettura(p), pass);
        testi.push(t);
        voci = trovaNelTesto(idx, t);
        if (voci.length) break;
      }
      setLetto(voci.length ? '' : testi.map((t) => t.trim()).filter(Boolean).slice(0, 4).join('\n—\n'));
      setForse(voci.length ? [] : suggerimenti(idx, testi.join('\n')));
      setTrovate(voci);
      if (voci.length === 1) setScelta(voci[0]);
    } catch {
      setErrore('Non riesco a leggere la foto: controlla la connessione (la prima lettura scarica il motore di riconoscimento) e riprova, oppure scrivi il codice.');
    } finally {
      setLettura(null);
    }
  };

  const leggi = async (file?: File) => {
    if (foto.current) foto.current.value = '';
    if (galleria.current) galleria.current.value = '';
    if (!file) return;
    setUltima({ file, url: URL.createObjectURL(file) });
    await prova(file);
  };

  const tocca = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!ultima || lettura !== null) return;
    const r = e.currentTarget.getBoundingClientRect();
    prova(ultima.file, { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };

  return (
    <div className="cartellino" role="dialog" aria-modal="true" aria-label="Leggi un cartellino">
      <div className="page">
        <div className="cart-head">
          {scelta
            ? <button className="link" onClick={() => setScelta(null)}>Torna alla ricerca</button>
            : <button className="link" onClick={onClose}>Chiudi</button>}
        </div>

        {scelta ? <DettaglioVoce v={scelta} catalog={catalog} pg={pg} staff={staff} /> : (
          <>
            <h1>Leggi un cartellino</h1>
            <p className="hint">Fotografa il cartellino di un’abilità, di un incantesimo o di un oggetto: l’app riconosce il codice e ti mostra tutte le informazioni.</p>

            <div className="cart-azioni">
              <button className="btn primary block" disabled={lettura !== null} onClick={() => foto.current?.click()}>
                <IconaFoto /> Fotografa il cartellino
              </button>
              <button className="btn ghost block" disabled={lettura !== null} onClick={() => galleria.current?.click()}>Scegli una foto già scattata</button>
              <input ref={foto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => leggi(e.target.files?.[0])} />
              <input ref={galleria} type="file" accept="image/*" hidden onChange={(e) => leggi(e.target.files?.[0])} />
              <p className="hint">Consiglio: inquadra da vicino il codice, con buona luce e il cartellino dritto.</p>
            </div>

            {lettura !== null && (
              <div className="cart-lettura" role="status">
                <span>Sto leggendo il cartellino…{tentativo > 1 ? ` (tentativo ${tentativo})` : ''}</span>
                <div className="cart-barra"><span style={{ width: `${Math.round(lettura * 100)}%` }} /></div>
              </div>
            )}
            {errore && <p className="error" role="alert">{errore}</p>}
            {trovate && trovate.length === 0 && (
              <div className="notice">
                <p style={{ margin: 0 }}>{forse.length ? 'Non sono sicuro di aver letto bene il codice.' : 'Non ho trovato nessun codice nella foto. Riprova più da vicino, dritto e senza riflessi, oppure scrivilo qui sotto.'}</p>
                {forse.length > 0 && <ElencoVoci titolo="Forse è uno di questi" voci={forse} onScegli={setScelta} />}
                {ultima && (
                  <div className="cart-tocca">
                    <p>Tocca nella foto il punto dove si trova il codice: lo leggo da vicino.</p>
                    <img src={ultima.url} alt="Foto del cartellino" onClick={tocca} />
                  </div>
                )}
                {letto && <details className="cart-letto"><summary>Cosa sono riuscito a leggere</summary><pre>{letto}</pre></details>}
              </div>
            )}
            {trovate && trovate.length > 1 && <ElencoVoci titolo="Codici trovati nella foto" voci={trovate} onScegli={setScelta} />}

            <div className="field cart-codice">
              <label htmlFor="cart-q">Oppure scrivi il codice</label>
              <input id="cart-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Es. R4CF.WCV oppure C6PK" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
              <span className="hint">Va bene anche senza punto o in minuscolo. Puoi cercare anche per nome.</span>
            </div>
            {q.trim() && (scritte.length ? <ElencoVoci voci={scritte} onScegli={setScelta} /> : <p className="hint">Nessun codice corrisponde.</p>)}
          </>
        )}
      </div>
    </div>
  );
}

function ElencoVoci({ titolo, voci, onScegli }: { titolo?: string; voci: Voce[]; onScegli: (v: Voce) => void }) {
  return (
    <div className="cart-elenco">
      {titolo && <h3 className="section-title">{titolo}</h3>}
      {voci.map((v) => (
        <button key={`${v.tipo}|${v.codice}`} className="row-btn" onClick={() => onScegli(v)}>
          <span>{nomeVoce(v)}</span>
          <small><span className="codice">{v.codice}</span> {v.tipo === 'abilita' ? 'Abilità' : v.tipo === 'potere' ? etichettaScuola(v.potere.tipo, v.potere.scuola) : 'Tabella speciale'}</small>
        </button>
      ))}
    </div>
  );
}

function DettaglioVoce({ v, catalog, pg, staff }: { v: Voce; catalog: Ability[]; pg?: Character; staff?: boolean }) {
  if (v.tipo === 'potere') return <div className="cart-dettaglio"><DettaglioPotere s={v.potere} pg={pg} staff={staff} /></div>;
  if (v.tipo === 'abilita') {
    const a = v.abilita;
    const tempi = Object.entries(a.tempi ?? {}).map(([k, t]) => `${CAT[k as Categoria]} ${t === 'NI' ? 'non insegnabile' : t === 0 ? 'senza tempo' : `${t} ${t === 1 ? 'evento' : 'eventi'}`}`);
    const posseduta = pg?.abilita.includes(a.id);
    return (
      <div className="cart-dettaglio">
        <span className="tag">Abilità {a.tipo === 'base' ? 'di base' : 'avanzata'}{posseduta ? ', la possiedi' : ''}</span>
        <h2>{a.nome}</h2>
        <DettaglioAbilita a={a} />
        <dl className="facts">
          {a.gruppo && (<><dt>Ramo</dt><dd>{a.gruppo}</dd></>)}
          {a.sephira != null && (<><dt>Sephira</dt><dd>{a.sephira}</dd></>)}
          {a.titolo && (<><dt>Titolo</dt><dd>{a.titolo}</dd></>)}
          {a.prerequisiti && (<><dt>Richiede</dt><dd>{a.prerequisiti}</dd></>)}
          {tempi.length > 0 && (<><dt>Apprendimento</dt><dd>{tempi.join(', ')}</dd></>)}
          {a.pc != null && (<><dt>Costo</dt><dd>{a.pc} PC in creazione</dd></>)}
          {staff && a.note && (<><dt>Nota staff</dt><dd className="ab-descr">{a.note}</dd></>)}
        </dl>
      </div>
    );
  }
  const collegate = catalog.filter((a) => a.tabelle?.includes(v.tabella.nome));
  // coppie etichetta/valore: la riga del codice, oppure la sua colonna se i codici stanno in una riga "Codice"
  const col = v.colonna;
  const coppie: [string, string][] = col != null
    ? v.tabella.righe.filter((r) => r !== v.riga && r !== v.intestazione && r[col]).map((r) => [r[0] || '—', r[col]])
    : v.riga.map((c, i) => [v.intestazione?.[i] || '—', c] as [string, string]).filter(([, c]) => c && c !== v.codice);
  return (
    <div className="cart-dettaglio">
      <span className="tag">Tabella speciale, codice {v.codice}</span>
      <h2>{v.tabella.nome}</h2>
      {(col != null ? v.intestazione?.[col] : v.sezione) && <p className="flavor">{col != null ? v.intestazione?.[col] : v.sezione}</p>}
      <dl className="facts">
        {coppie.map(([k, c], i) => <div key={i} style={{ display: 'contents' }}><dt>{k}</dt><dd>{c}</dd></div>)}
      </dl>
      {collegate.length > 0 && <p className="hint">Abilità: {collegate.map((a) => `${a.nome}${a.codice ? ` (${a.codice})` : ''}`).join(', ')}</p>}
    </div>
  );
}

export function IconaFoto() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="4" />
    </svg>
  );
}
