import { gruppiSlot } from '../slots';
import type { Ability, Categoria, Character } from '../data/types';
import { TABELLE } from '../data/abilities';

/** Speciali del foglio dello staff, come etichette */
export function etichetteSpeciali(a: Ability): string[] {
  return [a.segreta && 'Segreta', a.riacquistabile && 'Riacquistabile', a.temporanea && 'Temporanea', a.limitata && 'Limitata'].filter(Boolean) as string[];
}

/** Tabella speciale di un'abilità (es. Linfa Eterea, Robustezza Arcana): la prima riga è l'intestazione */
export function TabellaAbilita({ nome }: { nome: string }) {
  const t = TABELLE.find((x) => x.nome === nome);
  if (!t) return null;
  // la prima riga fa da intestazione solo se ha più colonne piene (altrimenti è un sottotitolo, es. "Generati di Odino")
  const conTesta = t.righe[0]?.filter(Boolean).length > 1;
  const testa = conTesta ? t.righe[0] : null;
  const righe = conTesta ? t.righe.slice(1) : t.righe;
  const larghezza = Math.max(...t.righe.map((r) => r.length));
  return (
    <div className="ab-tabella">
      <h4>{t.nome}</h4>
      <div className="tab-scroll">
        <table>
          {testa && <thead><tr>{Array.from({ length: larghezza }, (_, i) => <th key={i}>{testa[i] ?? ''}</th>)}</tr></thead>}
          <tbody>
            {righe.map((r, i) => {
              const piene = r.filter(Boolean).length;
              // riga con una sola cella piena: sottotitolo (es. "Carattere Melanconico")
              if (piene === 1) return <tr key={i} className="sotto"><td colSpan={larghezza}>{r.find(Boolean)}</td></tr>;
              return <tr key={i}>{Array.from({ length: larghezza }, (_, j) => <td key={j}>{r[j] ?? ''}</td>)}</tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Dettaglio di un'abilità per il giocatore (descrizione, codice, speciali, tabelle) */
export function DettaglioAbilita({ a }: { a: Ability }) {
  const spec = etichetteSpeciali(a);
  return (
    <>
      <p className="ab-descr">{a.descrizione || 'Descrizione non ancora inserita dallo staff.'}</p>
      {(a.codice || spec.length > 0) && (
        <p className="ab-meta">
          {a.codice && <span className="codice">{a.codice}</span>}
          {spec.map((x) => <span key={x} className="badge">{x}</span>)}
        </p>
      )}
      {(a.tabelle ?? []).map((t) => <TabellaAbilita key={t} nome={t} />)}
    </>
  );
}

const CAT: { id: Categoria; nome: string; slot: string }[] = [
  { id: 'fisico', nome: 'Fisiche e di combattimento', slot: 'Fisico' },
  { id: 'mentale', nome: 'Mentali e di conoscenza', slot: 'Mentale' },
  { id: 'sovrannaturale', nome: 'Sovrannaturali', slot: 'Sovrannaturale' },
];

export function AbilitaTab({ pg, catalog }: { pg: Character; catalog: Ability[] }) {
  const find = (id: string) => catalog.find((a) => a.id === id);
  const owned = pg.abilita.map((id) => find(id) ?? ({ id, nome: id, categoria: 'mentale', tipo: 'avanzata', descrizione: '' } as Ability));

  return (
    <div className="page">
      <h1 style={{ fontSize: '2rem' }}>Abilità</h1>

      <section aria-labelledby="slot-title">
        <h2 id="slot-title" className="section-title">In apprendimento</h2>
        <div className="slot-list">
          {gruppiSlot(pg.slot).map((g) => {
            const s = g.slot;
            const etichetta = `Slot ${g.cats.map((id) => CAT.find((c) => c.id === id)!.slot).join(' + ')}`;
            if (!s) return (
              <div key={g.cats[0]} className="slot empty">
                <div className="slot-head"><span className="slot-cat">{etichetta}</span></div>
                <span>Libero</span>
              </div>
            );
            const nome = find(s.abilita)?.nome ?? s.abilita;
            const mancano = Math.max(0, s.eventiTotali - s.eventiSvolti);
            return (
              <div key={g.cats[0]} className={`slot${g.cats.length > 1 ? ' multi' : ''}`}>
                <div className="slot-head">
                  <span className="slot-name">{nome}</span>
                  {g.cats.length > 1
                    ? <span className="slot-chips">{g.cats.map((id) => <span key={id} className="slot-chip">{CAT.find((c) => c.id === id)!.slot}</span>)}</span>
                    : <span className="slot-cat">{etichetta}</span>}
                </div>
                {g.cats.length > 1 && <p className="slot-note">Occupa {g.cats.length === 2 ? 'due' : 'tre'} slot finché non è appresa</p>}
                <div className="progress" aria-label={`${s.eventiSvolti} eventi su ${s.eventiTotali}`}>
                  {Array.from({ length: s.eventiTotali }, (_, i) => <span key={i} className={i < s.eventiSvolti ? 'done' : ''} />)}
                </div>
                <dl className="facts">
                  <dt>Mancano</dt><dd>{mancano === 0 ? 'Appresa dal prossimo evento' : mancano === 1 ? '1 evento' : `${mancano} eventi`}</dd>
                  <dt>Insegnante</dt><dd>{s.insegnante || '—'}</dd>
                  <dt>Iniziata</dt><dd>{s.eventoInizio || '—'}</dd>
                </dl>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="ab-title">
        <h2 id="ab-title" className="section-title">Apprese</h2>
        {CAT.map((c) => {
          // le riacquistabili possedute più volte compaiono una volta sola, con "×N"
          const list = owned.filter((a, i) => a.categoria === c.id && owned.findIndex((x) => x.id === a.id) === i);
          const volte = (id: string) => pg.abilita.filter((x) => x === id).length;
          if (!list.length) return null;
          return (
            <div key={c.id} className="ab-group">
              <h3>{c.nome}</h3>
              {list.map((a) => (
                <details key={a.id} className="ab">
                  <summary><span>{a.nome}{volte(a.id) > 1 && <span className="volte">×{volte(a.id)}</span>}</span>{a.tipo === 'avanzata' && <span className="badge">avanzata</span>}</summary>
                  <DettaglioAbilita a={a} />
                </details>
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}

