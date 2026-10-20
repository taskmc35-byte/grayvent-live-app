import { useState } from 'react';
import type { Character, Spell } from '../data/types';
import type { ScelteDovute } from '../scelte';
import { SpellCard } from './PoteriTab';

/** Avviso compatto (Scheda e Poteri) quando ci sono incantesimi o miracoli da scegliere */
export function AvvisoScelta({ dovute, onApri }: { dovute: ScelteDovute; onApri: () => void }) {
  const n = dovute.gruppi.reduce((s, g) => s + g.quanti, 0);
  const miracoli = dovute.gruppi.every((g) => g.tipo === 'miracolo');
  if (n > 0) return (
    <button className="scelta-avviso" onClick={onApri}>
      <strong>Hai {n} {miracoli ? (n === 1 ? 'miracolo' : 'miracoli') : (n === 1 ? 'incantesimo' : 'incantesimi')} da scegliere</strong>
      <span>Tocca per scegliere</span>
    </button>
  );
  const manca = [...dovute.mancaDivinita.map((a) => `${a}: manca la divinità`), ...dovute.mancaElemento.map((a) => `${a}: manca l’elemento`)];
  if (manca.length) return <p className="scelta-avviso info">{manca.join('. ')}. Chiedi allo staff di completare la scheda, poi potrai scegliere i tuoi poteri.</p>;
  return null;
}

/** Schermata di scelta: per ogni gruppo si spuntano esattamente N voci, poi si conferma (scelta definitiva) */
export function SceltaIncantesimi({ pg, dovute, onConferma, onChiudi }: {
  pg: Character; dovute: ScelteDovute; onConferma: (ids: string[]) => Promise<void>; onChiudi: () => void;
}) {
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [dettaglio, setDettaglio] = useState<Spell | null>(null);
  const [conferma, setConferma] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const completi = dovute.gruppi.every((g) => (sel[g.chiave]?.length ?? 0) === g.quanti);
  const scelti = dovute.gruppi.flatMap((g) => (sel[g.chiave] ?? []).map((id) => g.opzioni.find((s) => s.id === id)!));
  const tocca = (k: string, id: string, max: number) => setSel((s) => {
    const cur = s[k] ?? [];
    if (cur.includes(id)) return { ...s, [k]: cur.filter((x) => x !== id) };
    if (max === 1) return { ...s, [k]: [id] };
    if (cur.length >= max) return s;
    return { ...s, [k]: [...cur, id] };
  });

  return (
    <div className="scelta-overlay" role="dialog" aria-modal="true" aria-label="Scegli i tuoi poteri">
      <div className="scelta page">
        {!conferma ? (<>
          <h1 style={{ fontSize: '1.8rem' }}>Scegli i tuoi poteri</h1>
          <p className="hint">Tocca il nome per leggere l’effetto, la casella per sceglierlo. La scelta è definitiva.</p>
          {dovute.gruppi.map((g) => {
            const n = sel[g.chiave]?.length ?? 0;
            return (
              <fieldset key={g.chiave} className="fs scelta-gruppo">
                <legend>{g.titolo}</legend>
                <p className="hint">Da {g.da.join(', ')}: scegline {g.quanti}. <b className={n === g.quanti ? 'gold' : ''}>{n} / {g.quanti}</b></p>
                {g.opzioni.map((s) => {
                  const on = (sel[g.chiave] ?? []).includes(s.id);
                  const pieno = !on && n >= g.quanti && g.quanti > 1;
                  return (
                    <div key={s.id} className={`scelta-voce${on ? ' on' : ''}${pieno ? ' off' : ''}`}>
                      <label className="check">
                        <input type="checkbox" checked={on} disabled={pieno} onChange={() => tocca(g.chiave, s.id, g.quanti)} aria-label={`Scegli ${s.nome}`} />
                        <span>{s.nome}</span>
                      </label>
                      <button type="button" className="link" onClick={() => setDettaglio(s)}>Leggi</button>
                    </div>
                  );
                })}
              </fieldset>
            );
          })}
          <div className="scelta-azioni">
            <button className="btn ghost" onClick={onChiudi}>Più tardi</button>
            <button className="btn primary" disabled={!completi} onClick={() => { setErr(''); setConferma(true); }}>Conferma la scelta</button>
          </div>
        </>) : (<>
          <h1 style={{ fontSize: '1.8rem' }}>Confermi?</h1>
          <p>Stai per aggiungere alla tua scheda:</p>
          <ul className="scelta-riepilogo">
            {scelti.map((s) => <li key={s.id}><strong>{s.nome}</strong> <span className="hint">{dovute.gruppi.find((g) => g.opzioni.includes(s))?.titolo}</span></li>)}
          </ul>
          <p className="scelta-attenzione">Dopo la conferma la scelta non si può più cambiare.</p>
          {err && <p className="error">{err}</p>}
          <div className="scelta-azioni">
            <button className="btn ghost" disabled={busy} onClick={() => setConferma(false)}>Torna indietro</button>
            <button className="btn primary" disabled={busy} onClick={async () => {
              setBusy(true); setErr('');
              try { await onConferma(scelti.map((s) => s.id)); } catch (e) { setErr((e as Error).message); setBusy(false); }
            }}>{busy ? 'Salvo…' : 'Sì, confermo'}</button>
          </div>
        </>)}
      </div>
      {dettaglio && <SpellCard s={dettaglio} pg={pg} onClose={() => setDettaglio(null)} />}
    </div>
  );
}
