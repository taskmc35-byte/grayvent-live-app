// Regole della creazione del personaggio (Manuale di Creazione del Personaggio)
import type { Ability, Race } from './data/types';
import { prerequisitiMancanti } from './requisiti';

export const BUDGET_PC = 25;
/** Talento 1 non si sceglie: lo generano i PC avanzati (a gruppi di 5) */
export const NON_SELEZIONABILI = new Set(['talento-1']);
/** Poteri sovrannaturali incompatibili tra loro */
export const SOVRANNATURALI = ['conoscenze-magiche', 'dono-arcano-1', 'legame-divino-1'];
export const BG_CARATTERI = 10000; // limite deciso dallo staff (circa due fogli A4)

export const SPUNTI_BG = [
  'Artisti', 'Bambini Abbandonati', 'Beduini', 'Briganti', 'Bruma', 'Circensi', 'Corpi Essiccati', 'Deserto', 'Dispersi in viaggi',
  'Esperimenti Chirurgici', 'Festa in Maschera', 'Malavita', 'Malocchio', 'Menomazioni', 'Mercato Nero', 'Misteri del Mare', 'Monaci',
  'Naufragio', 'Navi', 'Nobiltà', 'Nomadi', 'Occhi Persi', 'Omicidi Strani', 'Oppressione', 'Orfani', 'Patti Strani', 'Pestaggi', 'Pirati',
  'Rapimenti', 'Ricatto', 'Sangue Angelico', 'Sangue Demoniaco', 'Schiavitù', 'Sete di avventura', 'Setta', 'Sparizioni', 'Stelle',
  'Streghe', 'Tempeste', 'Tesori Nascosti', 'Torture', 'Truffe', 'Vendetta per una morte', 'Venti Forti', 'Zingari',
];

export function creationAbilities(catalog: Ability[]) {
  return catalog.filter((a) => a.tipo === 'base' && !a.segreta && !NON_SELEZIONABILI.has(a.id));
}

/** Prerequisiti mancanti (nomi), letti dal testo dei prerequisiti */
export function missingPrereq(a: Ability, owned: Set<string>, catalog: Ability[]): string[] {
  return prerequisitiMancanti(a, owned, catalog);
}

export interface CreationCheck {
  spesi: number;
  restanti: number;
  usiTalento: number;
  astriOro: number;
  errori: string[];
  bloccate: Map<string, string>; // id -> motivo per cui non si può prendere
}

export function checkCreation(sel: string[], race: Race | undefined, catalog: Ability[]): CreationCheck {
  const owned = new Set(sel);
  const list = creationAbilities(catalog);
  const spesi = sel.reduce((s, id) => s + (catalog.find((a) => a.id === id)?.pc ?? 0), 0);
  const restanti = BUDGET_PC - spesi;
  const errori: string[] = [];
  if (restanti < 0) errori.push(`Hai superato i ${BUDGET_PC} PC di ${-restanti}.`);
  const vietate = new Set(race?.abilitaVietate ?? []);
  const supSel = SOVRANNATURALI.filter((id) => owned.has(id));
  if (supSel.length > 1) errori.push('Puoi scegliere un solo potere sovrannaturale tra Conoscenze Magiche, Dono Arcano Minore e Legame Divino Minore.');
  for (const id of race?.abilitaObbligatorie ?? []) {
    if (!owned.has(id)) errori.push(`La razza richiede l’abilità ${catalog.find((a) => a.id === id)?.nome ?? id}.`);
  }
  for (const id of sel) {
    const a = catalog.find((x) => x.id === id);
    if (!a) continue;
    if (vietate.has(id)) errori.push(`${a.nome} non è disponibile per la tua razza.`);
    const miss = missingPrereq(a, owned, catalog);
    if (miss.length) errori.push(`${a.nome} richiede ${miss.join(', ')}.`);
  }
  const bloccate = new Map<string, string>();
  for (const a of list) {
    if (owned.has(a.id)) continue;
    if (vietate.has(a.id)) { bloccate.set(a.id, 'Non disponibile per la tua razza'); continue; }
    const miss = missingPrereq(a, owned, catalog);
    if (miss.length) { bloccate.set(a.id, `Richiede ${miss.join(', ')}`); continue; }
    if (SOVRANNATURALI.includes(a.id) && supSel.length) { bloccate.set(a.id, 'Hai già scelto un altro potere sovrannaturale'); continue; }
    if ((a.pc ?? 0) > restanti) bloccate.set(a.id, `Costa ${a.pc} PC, te ne restano ${Math.max(0, restanti)}`);
  }
  const r = Math.max(0, restanti);
  return { spesi, restanti, usiTalento: Math.floor(r / 5), astriOro: r % 5, errori, bloccate };
}

/** Togliendo un'abilità tolgo anche quelle che la richiedevano (a catena) */
export function removeWithDependents(sel: string[], id: string, catalog: Ability[]): string[] {
  let cur = sel.filter((x) => x !== id);
  let changed = true;
  while (changed) {
    changed = false;
    const owned = new Set(cur);
    for (const x of cur) {
      const a = catalog.find((c) => c.id === x);
      if (a && missingPrereq(a, owned, catalog).length) { cur = cur.filter((y) => y !== x); changed = true; break; }
    }
  }
  return cur;
}
