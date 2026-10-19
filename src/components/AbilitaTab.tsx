import { gruppiSlot } from '../slots';
import type { Ability, Categoria, Character } from '../data/types';

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
          const list = owned.filter((a) => a.categoria === c.id);
          if (!list.length) return null;
          return (
            <div key={c.id} className="ab-group">
              <h3>{c.nome}</h3>
              {list.map((a) => (
                <details key={a.id} className="ab">
                  <summary><span>{a.nome}</span>{a.tipo === 'avanzata' && <span className="badge">avanzata</span>}</summary>
                  <p>{a.descrizione || 'Descrizione non ancora inserita dallo staff.'}</p>
                </details>
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}

