// Elementi della magia arcana. Un mago può averne più di uno (anche tutti): il primo è quello principale.
import type { Character } from './data/types';

/** Elementi con incantesimi propri */
export const ELEMENTI_CON_INCANTESIMI = ['Fuoco', 'Acqua', 'Terra', 'Aria', 'Luce', 'Ombra'];
/** Energia Pura: unione di tutti gli elementi, senza incantesimi propri */
export const ENERGIA_PURA = 'Energia Pura';
export const TUTTI_GLI_ELEMENTI = [...ELEMENTI_CON_INCANTESIMI, ENERGIA_PURA];

/** Tutti gli elementi del personaggio, il principale per primo */
export function elementiDi(c: Pick<Character, 'elemento' | 'altriElementi'>): string[] {
  return [...new Set([c.elemento, ...(c.altriElementi ?? [])].filter(Boolean) as string[])];
}
