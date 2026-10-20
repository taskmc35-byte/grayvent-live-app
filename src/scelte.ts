import type { Character, Spell } from './data/types';
import { astroOf } from './data/deities';

/*
 * Incantesimi e miracoli che il giocatore sceglie da solo quando ottiene un'abilità di potere:
 *   Legame Divino (ogni livello)  -> 2 Miracoli Generici + 2 dell'Astro della propria divinità, di quel livello
 *   Conoscenze Magiche            -> 2 Incantesimi Minori del proprio Elemento
 *   Studio Arcano (ogni livello)  -> 2 Incantesimi del proprio Elemento + 2 di Sintesi, di quel livello
 *                                    (Studio Arcano Minore con Conoscenze Magiche: solo i 2 di Sintesi, gli elementali restano)
 * Si calcola quanti ne servono per gruppo e quanti il personaggio ne ha già: la differenza è da scegliere.
 * Un gruppo senza incantesimi nell'app (es. livelli Maggiori non ancora inseriti) non viene chiesto.
 */

export const LIVELLI = ['Minore', 'Maggiore', 'Estremo', 'Assoluto'] as const;

export interface GruppoScelta {
  chiave: string;            // tipo|scuola|livello
  tipo: Spell['tipo']; scuola: string; livello: string;
  titolo: string;            // es. "Miracoli Generici Minori"
  da: string[];              // abilità che li danno
  quanti: number;            // da scegliere adesso
  opzioni: Spell[];          // tra cui scegliere (esclusi quelli già conosciuti)
}
export interface ScelteDovute { gruppi: GruppoScelta[]; mancaDivinita: string[]; mancaElemento: string[] }

const LIV_PLURALE: Record<string, string> = { Minore: 'Minori', Maggiore: 'Maggiori', Estremo: 'Estremi', Assoluto: 'Assoluti' };
const SCUOLA_TIT: Record<string, string> = {
  Generico: 'Generici', Madre: 'della Madre', Padre: 'del Padre', Spada: 'della Spada',
  Fuoco: 'del Fuoco', Acqua: 'dell’Acqua', Terra: 'della Terra', Aria: 'dell’Aria', Sintesi: 'di Sintesi',
};
const titoloGruppo = (tipo: Spell['tipo'], scuola: string, livello: string) =>
  `${tipo === 'miracolo' ? 'Miracoli' : 'Incantesimi'} ${LIV_PLURALE[livello] ?? livello} ${SCUOLA_TIT[scuola] ?? scuola}`;

export function scelteDovute(pg: Character, spells: Spell[], nomeAbilita: (id: string) => string = (id) => id): ScelteDovute {
  const ab = new Set(pg.abilita);
  const req = new Map<string, { tipo: Spell['tipo']; scuola: string; livello: string; n: number; da: string[] }>();
  const mancaDivinita: string[] = [], mancaElemento: string[] = [];
  const add = (tipo: Spell['tipo'], scuola: string, livello: string, n: number, da: string) => {
    const k = `${tipo}|${scuola}|${livello}`;
    const r = req.get(k) ?? { tipo, scuola, livello, n: 0, da: [] };
    r.n += n; if (!r.da.includes(da)) r.da.push(da); req.set(k, r);
  };
  const astro = astroOf(pg.divinita);
  const el = pg.elemento && ['Fuoco', 'Acqua', 'Terra', 'Aria'].includes(pg.elemento) ? pg.elemento : null;

  LIVELLI.forEach((liv, i) => {
    const id = `legame-divino-${i + 1}`;
    if (ab.has(id)) {
      const nome = nomeAbilita(id);
      add('miracolo', 'Generico', liv, 2, nome);
      if (astro) add('miracolo', astro, liv, 2, nome); else mancaDivinita.push(nome);
    }
  });
  if (ab.has('conoscenze-magiche')) {
    const nome = nomeAbilita('conoscenze-magiche');
    if (el) add('incantesimo', el, 'Minore', 2, nome); else mancaElemento.push(nome);
  }
  LIVELLI.forEach((liv, i) => {
    const id = `studio-arcano-${i + 1}`;
    if (!ab.has(id)) return;
    const nome = nomeAbilita(id);
    add('incantesimo', 'Sintesi', liv, 2, nome);
    if (i === 0 && ab.has('conoscenze-magiche')) return; // mantiene gli elementali di Conoscenze Magiche
    if (el) add('incantesimo', el, liv, 2, nome); else if (!mancaElemento.includes(nome)) mancaElemento.push(nome);
  });

  const noti = new Set(pg.incantesimi);
  const gruppi: GruppoScelta[] = [];
  for (const [chiave, r] of req) {
    const delGruppo = spells.filter((s) => s.tipo === r.tipo && s.scuola === r.scuola && s.livello === r.livello);
    if (!delGruppo.length) continue; // livello non ancora nell'app
    const gia = delGruppo.filter((s) => noti.has(s.id)).length;
    const opzioni = delGruppo.filter((s) => !noti.has(s.id));
    const quanti = Math.min(r.n - gia, opzioni.length);
    if (quanti > 0) gruppi.push({ chiave, tipo: r.tipo, scuola: r.scuola, livello: r.livello, titolo: titoloGruppo(r.tipo, r.scuola, r.livello), da: r.da, quanti, opzioni });
  }
  return { gruppi, mancaDivinita, mancaElemento };
}
