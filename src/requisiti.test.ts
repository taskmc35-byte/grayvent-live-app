import { describe, expect, it } from 'vitest';
import { ALL_ABILITIES as cat } from './data/abilities';
import { motivoRequisiti, motivoTitolo, prerequisitiMancanti, titoliDelCatalogo, titoliRichiesti } from './requisiti';
import type { Ability } from './data/types';

const ab = (id: string) => cat.find((a) => a.id === id)!;
const per = (titolo: string) => ({ titolo } as Ability);

describe('Requisiti', () => {
  it('titoli: "," servono tutti, "/" ne basta uno', () => {
    expect(titoliRichiesti(per('Bravi/Mastini'))).toEqual([['Bravi'], ['Mastini']]);
    expect(titoliRichiesti(per('Demone Maggiore, Fedele di Surtur'))).toEqual([['Demone Maggiore', 'Fedele di Surtur']]);
    const c = { razza: 'dannato', titoli: ['Demone Maggiore'] };
    expect(motivoTitolo(per('Demone Maggiore, Fedele di Surtur'), c)).toMatch(/Fedele di Surtur/);
    expect(motivoTitolo(per('Demone Maggiore, Fedele di Surtur'), { ...c, titoli: ['Demone Maggiore', 'fedele di surtur'] })).toBeNull();
    expect(motivoTitolo(per('Bravi/Mastini'), { razza: 'nano', titoli: ['Mastini'] })).toBeNull();
  });
  it('Fyrd e la razza valgono da sé', () => {
    expect(motivoTitolo(ab('armi-medie'), { razza: 'alf' })).toBeNull();
    const nano = cat.find((a) => a.titolo === 'Nano')!;
    expect(motivoTitolo(nano, { razza: 'nano' })).toBeNull();
    expect(motivoTitolo(nano, { razza: 'alf' })).toMatch(/Nano/);
  });
  it('Sephira minima', () => {
    expect(motivoRequisiti(ab('legame-divino-3'), { razza: 'alf', titoli: ['Carica nella Cattedrale'], sephire: 5 })).toMatch(/Sephira 6/);
    expect(motivoRequisiti(ab('legame-divino-3'), { razza: 'alf', titoli: ['Carica nella Cattedrale'], sephire: 6 })).toBeNull();
  });
  it('prerequisiti: vale qualsiasi variante con lo stesso nome', () => {
    const sf3 = ab('legame-divino-3');
    expect(prerequisitiMancanti(sf3, ['legame-divino-1'], cat)).toEqual(['Legame Divino Maggiore']);
    expect(prerequisitiMancanti(sf3, ['legame-divino-2'], cat)).toEqual([]);
  });
  it('elenco titoli per lo staff', () => {
    const t = titoliDelCatalogo(cat);
    expect(t).toContain('Mistagogo');
    expect(t).toContain('Fyrd');
  });
});
