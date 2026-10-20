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
it('livelli non ancora inseriti non vengono chiesti; Dono Arcano resta allo staff', () => {
  expect(scelteDovute(pg({ abilita: ['legame-divino-2'], divinita: 'Thor' }), S).gruppi).toHaveLength(0);
  expect(scelteDovute(pg({ abilita: ['dono-arcano-1'], elemento: 'Fuoco' }), S).gruppi).toHaveLength(0);
});
