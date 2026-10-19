import type { Categoria, Character, SlotApprendimento } from './data/types';

export const CATEGORIE: Categoria[] = ['fisico', 'mentale', 'sovrannaturale'];

/** Stessa abilità iniziata nello stesso momento = un unico apprendimento su più slot (abilità multi-disciplina) */
const stesso = (a: SlotApprendimento, b: SlotApprendimento) => a.abilita === b.abilita && a.eventoInizio === b.eventoInizio;

/** Raggruppa gli slot occupati dalla stessa abilità in un'unica voce */
export function gruppiSlot(slot: Character['slot']) {
  const out: { cats: Categoria[]; slot?: SlotApprendimento }[] = [];
  for (const c of CATEGORIE) {
    const s = slot[c];
    const g = s && out.find((x) => x.slot && stesso(x.slot, s));
    if (g) g.cats.push(c); else out.push({ cats: [c], slot: s });
  }
  return out;
}
