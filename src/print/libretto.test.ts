import { expect, it } from 'vitest';
import { costruisciPagine, creaPdf } from './libretto';
import { DEMO_CHARACTERS } from '../data/demo';
import { ALL_ABILITIES } from '../data/abilities';
import SPELLS from '../data/spells.json';
import type { Spell } from '../data/types';

it('libretto: identità, razza, note, 3 tabelle abilità, gruppi di miracoli, addestramenti', () => {
  const aisha = DEMO_CHARACTERS[2];
  // Aisha ha miracoli del Padre e Generici: 2 pagine di miracoli
  expect(costruisciPagine(aisha, ALL_ABILITIES, SPELLS as Spell[])).toHaveLength(3 + 3 + 2 + 1);
  expect(creaPdf(aisha, ALL_ABILITIES, SPELLS as Spell[]).getNumberOfPages()).toBe(2);
});
