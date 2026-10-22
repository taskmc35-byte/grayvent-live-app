import { useState } from 'react';
import type { Character } from '../data/types';
import { raceById, raceLabel } from '../data/races';
import { FotoPg } from './FotoPg';
import { BottomSheet } from './Sheet';

const nome = (p: Character) => `${p.nome} ${p.cognome}`.trim();

/** Scelta del PNG per lo staff: pochi come pulsanti con il volto, tanti in un elenco con ricerca */
export function SceltaPng({ pgs, attivo, onScegli }: { pgs: Character[]; attivo: Character; onScegli: (id: string) => void }) {
  const [aperto, setAperto] = useState(false);
  const [q, setQ] = useState('');
  if (pgs.length <= 4) {
    return (
      <div className="scegli-pg">
        <span className="scegli-pg-tit" id="scegli-pg">PNG</span>
        <div className="pg-chips" role="radiogroup" aria-labelledby="scegli-pg">
          {pgs.map((p) => (
            <button key={p.id} role="radio" aria-checked={p.id === attivo.id} className={`pg-chip${p.id === attivo.id ? ' on' : ''}`} onClick={() => onScegli(p.id)}>
              <FotoPg c={p} size={34} /><span>{nome(p)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  const f = q.trim().toLowerCase();
  const elenco = [...pgs].sort((a, b) => nome(a).localeCompare(nome(b), 'it'))
    .filter((p) => !f || `${nome(p)} ${raceLabel(raceById(p.razza))} ${p.professione ?? ''}`.toLowerCase().includes(f));
  return (
    <div className="scegli-pg">
      <button className="pg-attivo" onClick={() => { setQ(''); setAperto(true); }} aria-label={`PNG: ${nome(attivo)}. Cambia PNG`}>
        <FotoPg c={attivo} size={38} />
        <span className="pg-attivo-testo"><small>PNG ({pgs.length})</small><strong>{nome(attivo)}</strong></span>
        <span className="pg-attivo-cambia">Cambia</span>
      </button>
      {aperto && (
        <BottomSheet onClose={() => setAperto(false)} label="Scegli il PNG">
          <h2>I tuoi PNG</h2>
          <input className="search" type="search" placeholder="Cerca per nome, razza o professione" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca PNG" />
          <div className="pg-griglia">
            {elenco.map((p) => (
              <button key={p.id} className={`pg-card${p.id === attivo.id ? ' on' : ''}`} onClick={() => { onScegli(p.id); setAperto(false); }}>
                <FotoPg c={p} size={64} />
                <strong>{nome(p)}</strong>
                <small>{raceLabel(raceById(p.razza))}</small>
              </button>
            ))}
            {!elenco.length && <p className="hint">Nessun PNG trovato.</p>}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
