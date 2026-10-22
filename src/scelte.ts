import type { Ability, Character, Spell } from './data/types';
import { astroOf, DEI_MINORI } from './data/deities';
import { ALL_ABILITIES } from './data/abilities';

/*
 * Incantesimi e miracoli che il giocatore sceglie da solo quando ottiene un'abilità di potere:
 *   Legame Divino (ogni livello)  -> 2 Miracoli Generici + 2 dell'Astro della propria divinità, di quel livello
 *   Conoscenze Magiche            -> 2 Incantesimi Minori del proprio Elemento
 *   Studio Arcano (ogni livello)  -> 2 Incantesimi del proprio Elemento + 2 di Sintesi, di quel livello
 *                                    (Studio Arcano Minore con Conoscenze Magiche: solo i 2 di Sintesi, gli elementali restano)
 * Si calcola quanti ne servono per gruppo e quanti il personaggio ne ha già: la differenza è da scegliere.
 * Un gruppo senza incantesimi nell'app non viene chiesto. Segreti, Master e quelli non apprendibili non sono tra le opzioni.
 * Le abilità si riconoscono dalla via di potere e dal nome, così valgono anche le varianti di professione
 * (es. Legame Divino Estremo delle Professioni Segrete) e quelle razziali (Legame Divino Minore (Surtur)).
 */

export const LIVELLI = ['Minore', 'Maggiore', 'Estremo', 'Assoluto', 'Puro'] as const;
export const ELEMENTI = ['Fuoco', 'Acqua', 'Terra', 'Aria', 'Luce', 'Ombra'];

/** si può scegliere: non segreto, non Master, non segnato dallo staff come non apprendibile */
export const sceglibile = (s: Spell) => !s.segreto && !s.master && !/NON APPRENDIBILE/i.test(s.notaStaff ?? '');

export interface GruppoScelta {
  chiave: string;            // tipo|scuola|livello
  tipo: Spell['tipo']; scuola: string; livello: string;
  titolo: string;            // es. "Miracoli Generici Minori"
  da: string[];              // abilità che li danno
  quanti: number;            // da scegliere adesso
  opzioni: Spell[];          // tra cui scegliere (esclusi quelli già conosciuti)
}
export interface ScelteDovute { gruppi: GruppoScelta[]; mancaDivinita: string[]; mancaElemento: string[] }

const LIV_PLURALE: Record<string, string> = { Minore: 'Minori', Maggiore: 'Maggiori', Estremo: 'Estremi', Assoluto: 'Assoluti', Puro: 'Puri' };
const SCUOLA_TIT: Record<string, string> = {
  Generico: 'Generici', Madre: 'della Madre', Padre: 'del Padre', Spada: 'della Spada', Odino: 'di Odino', Surtur: 'di Surtur', Morte: 'della Morte',
  Fuoco: 'del Fuoco', Acqua: 'dell’Acqua', Terra: 'della Terra', Aria: 'dell’Aria', Luce: 'della Luce', Ombra: 'dell’Ombra', Sintesi: 'di Sintesi',
};
const titoloGruppo = (tipo: Spell['tipo'], scuola: string, livello: string) =>
  `${tipo === 'miracolo' ? 'Miracoli' : 'Incantesimi'} ${LIV_PLURALE[livello] ?? livello} ${SCUOLA_TIT[scuola] ?? scuola}`;

export function scelteDovute(pg: Character, spells: Spell[], catalog: Ability[] = ALL_ABILITIES): ScelteDovute {
  const req = new Map<string, { tipo: Spell['tipo']; scuola: string; livello: string; n: number; da: string[] }>();
  const mancaDivinita: string[] = [], mancaElemento: string[] = [];
  const add = (tipo: Spell['tipo'], scuola: string, livello: string, n: number, da: string) => {
    const k = `${tipo}|${scuola}|${livello}`;
    const r = req.get(k) ?? { tipo, scuola, livello, n: 0, da: [] };
    r.n += n; if (!r.da.includes(da)) r.da.push(da); req.set(k, r);
  };
  const minore = DEI_MINORI.find((d) => d.toLowerCase() === (pg.divinita ?? '').trim().toLowerCase());
  const scuolaDio = astroOf(pg.divinita) ?? minore ?? null;
  const el = pg.elemento && ELEMENTI.includes(pg.elemento) ? pg.elemento : null;
  const mie = pg.abilita.map((id) => catalog.find((a) => a.id === id)).filter(Boolean) as Ability[];
  const haConoscenze = pg.abilita.includes('conoscenze-magiche');
  const fatti = new Set<string>(); // stessa abilità in più varianti: conta una volta

  for (const a of mie) {
    const p = a.effetti?.potere;
    if (!p) continue;
    const liv = LIVELLI[p.livello - 1];
    if (p.via === 'sacerdote' && /^Legame Divino/.test(a.nome)) {
      const fisso = a.nome.match(/\((Odino|Surtur|Morte)\)/)?.[1]; // varianti razziali legate a un dio
      const dio = fisso ?? scuolaDio;
      const k = `ld|${p.livello}|${dio}`;
      if (fatti.has(k)) continue; fatti.add(k);
      add('miracolo', 'Generico', liv, 2, a.nome);
      if (dio) add('miracolo', dio, liv, 2, a.nome); else mancaDivinita.push(a.nome);
    } else if (a.id === 'conoscenze-magiche') {
      if (fatti.has('cm')) continue; fatti.add('cm');
      if (el) add('incantesimo', el, 'Minore', 2, a.nome); else mancaElemento.push(a.nome);
    } else if (p.via === 'mago' && /^Studio Arcano/.test(a.nome)) {
      const k = `sa|${p.livello}`;
      if (fatti.has(k)) continue; fatti.add(k);
      add('incantesimo', 'Sintesi', liv, 2, a.nome);
      if (p.livello === 1 && haConoscenze) continue; // mantiene gli elementali di Conoscenze Magiche
      if (el) add('incantesimo', el, liv, 2, a.nome); else if (!mancaElemento.includes(a.nome)) mancaElemento.push(a.nome);
    }
  }

  const noti = new Set(pg.incantesimi);
  const gruppi: GruppoScelta[] = [];
  for (const [chiave, r] of req) {
    const delGruppo = spells.filter((s) => s.tipo === r.tipo && s.scuola === r.scuola && s.livello === r.livello && sceglibile(s));
    if (!delGruppo.length) continue; // livello non ancora nell'app
    const gia = delGruppo.filter((s) => noti.has(s.id)).length;
    const opzioni = delGruppo.filter((s) => !noti.has(s.id));
    const quanti = Math.min(r.n - gia, opzioni.length);
    if (quanti > 0) gruppi.push({ chiave, tipo: r.tipo, scuola: r.scuola, livello: r.livello, titolo: titoloGruppo(r.tipo, r.scuola, r.livello), da: r.da, quanti, opzioni });
  }
  return { gruppi, mancaDivinita, mancaElemento };
}
