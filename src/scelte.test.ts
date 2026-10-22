import { expect, it } from 'vitest';
import { scelteDovute } from './scelte';
import SPELLS from './data/spells.json';
import type { Character, Spell } from './data/types';
const S = SPELLS as Spell[];
const pg = (p: Partial<Character>) => ({ abilita: [], incantesimi: [], ...p }) as Character;

it('sacerdote: 2 generici + 2 del proprio Astro', () => {
  const r = scelteDovute(pg({ abilita: ['legame-divino-1'], divinita: 'Thor' }), S);
  expect(r.gruppi.map((g) => [g.titolo, g.quanti])).toEqual([['Miracoli Minori Generici', 2], ['Miracoli Minori della Spada', 2]]);
  const gen = S.filter((s) => s.scuola === 'Generico').slice(0, 2).map((s) => s.id);
  expect(scelteDovute(pg({ abilita: ['legame-divino-1'], divinita: 'Thor', incantesimi: gen }), S).gruppi.map((g) => g.titolo)).toEqual(['Miracoli Minori della Spada']);
});
it('sacerdote senza divinità: lo segnala', () => {
  expect(scelteDovute(pg({ abilita: ['legame-divino-1'] }), S).mancaDivinita).toHaveLength(1);
});
it('mago: Conoscenze Magiche 2 elementali, Studio Arcano Minore aggiunge 2 di Sintesi', () => {
  expect(scelteDovute(pg({ abilita: ['conoscenze-magiche'], elemento: 'Fuoco' }), S).gruppi.map((g) => [g.titolo, g.quanti])).toEqual([['Incantesimi Minori del Fuoco', 2]]);
  expect(scelteDovute(pg({ abilita: ['conoscenze-magiche', 'studio-arcano-1'], elemento: 'Fuoco' }), S).gruppi.map((g) => [g.titolo, g.quanti]))
    .toEqual([['Incantesimi Minori del Fuoco', 2], ['Incantesimi Minori di Sintesi', 2]]);
  expect(scelteDovute(pg({ abilita: ['studio-arcano-1'], elemento: 'Aria' }), S).gruppi).toHaveLength(2);
});
it('Dono Arcano resta allo staff', () => {
  expect(scelteDovute(pg({ abilita: ['dono-arcano-1'], elemento: 'Fuoco' }), S).gruppi).toHaveLength(0);
});
it('livelli superiori e varianti di professione contano una volta sola', () => {
  const r = scelteDovute(pg({ abilita: ['legame-divino-1', 'legame-divino-2', 'legame-divino-3', 'legame-divino-3-1vfb'], divinita: 'Hel' }), S);
  expect(r.gruppi.map((g) => [g.titolo, g.quanti])).toEqual([
    ['Miracoli Minori Generici', 2], ['Miracoli Minori del Padre', 2], ['Miracoli Maggiori Generici', 2], ['Miracoli Maggiori del Padre', 2],
    ['Miracoli Estremi Generici', 2], ['Miracoli Estremi del Padre', 2]]);
});
it('dei minori e varianti razziali usano i miracoli del proprio dio; esclusi segreti e Master', () => {
  const r = scelteDovute(pg({ abilita: ['legame-divino-1'], divinita: 'Odino' }), S);
  expect(r.gruppi.map((g) => g.titolo)).toEqual(['Miracoli Minori Generici', 'Miracoli Minori di Odino']);
  const sur = scelteDovute(pg({ abilita: ['legame-divino-1-3ewk'] }), S);
  expect(sur.mancaDivinita).toHaveLength(0);
  expect(sur.gruppi.map((g) => g.titolo)).toContain('Miracoli Minori di Surtur');
  for (const g of r.gruppi) expect(g.opzioni.every((s) => !s.segreto && !s.master)).toBe(true);
});
it('mago di Luce: elementali della Luce', () => {
  expect(scelteDovute(pg({ abilita: ['conoscenze-magiche'], elemento: 'Luce' }), S).gruppi.map((g) => g.titolo)).toEqual(['Incantesimi Minori della Luce']);
});
it('mago con più elementi: sceglie tra gli incantesimi di tutti i suoi elementi; Energia Pura non ne ha', () => {
  const r = scelteDovute(pg({ abilita: ['conoscenze-magiche'], elemento: 'Fuoco', altriElementi: ['Aria', 'Energia Pura'] }), S);
  expect(r.gruppi.map((g) => g.titolo)).toEqual(['Incantesimi Minori del Fuoco o dell’Aria']);
  expect(new Set(r.gruppi[0].opzioni.map((s) => s.scuola))).toEqual(new Set(['Fuoco', 'Aria']));
  const ep = scelteDovute(pg({ abilita: ['conoscenze-magiche'], elemento: 'Energia Pura' }), S);
  expect([ep.gruppi.length, ep.mancaElemento.length]).toEqual([0, 0]);
});
