import { describe, expect, it } from 'vitest';
import { checkCreation, removeWithDependents, missingPrereq } from './creation';
import { ALL_ABILITIES } from './data/abilities';
import { RACES } from './data/races';
const R = (id: string) => RACES.find((r) => r.id === id);
const cat = ALL_ABILITIES;

describe('Creazione', () => {
  it('conteggio PC e avanzo in Talento/Astri', () => {
    const c = checkCreation(['armi-corte', 'armi-medie', 'sviluppo-fisico-1'], R('umano-nord'), cat); // 0+1+9 = 10
    expect([c.spesi, c.restanti, c.usiTalento, c.astriOro]).toEqual([10, 15, 3, 0]);
    const d = checkCreation(['armi-corte', 'armi-medie', 'scudo'], R('umano-nord'), cat); // 4 -> 21 = 4 talenti + 1 astro
    expect([d.usiTalento, d.astriOro]).toEqual([4, 1]);
  });
  it('prerequisiti', () => {
    const owned = new Set(['armi-corte']);
    expect(missingPrereq(cat.find((a) => a.id === 'armi-due-mani')!, owned, cat)).toEqual(['Armi Medie', 'Sviluppo Fisico 1']);
    expect(missingPrereq(cat.find((a) => a.id === 'armatura-completa')!, owned, cat)).toEqual(['un’Armatura']);
    expect(missingPrereq(cat.find((a) => a.id === 'linguaggio-arcano')!, new Set(['leggere-scrivere']), cat)).toEqual([]);
  });
  it('un solo potere sovrannaturale', () => {
    const c = checkCreation(['contare', 'leggere-scrivere', 'legame-divino-1'], R('umano-nord'), cat);
    expect(c.bloccate.get('dono-arcano-1')).toMatch(/altro potere/);
  });
  it('razza: vietate e obbligatorie', () => {
    const n = checkCreation(['leggere-scrivere', 'linguaggio-arcano'], R('nano'), cat);
    expect(n.bloccate.get('conoscenze-magiche')).toMatch(/razza/);
    expect(checkCreation([], R('umano-centrale'), cat).errori.join()).toMatch(/Contare/);
  });
  it('togliere a catena', () => {
    expect(removeWithDependents(['armi-corte', 'armi-medie', 'armi-lancio'], 'armi-corte', cat)).toEqual([]);
  });
  it('sforamento budget', () => {
    expect(checkCreation(['armi-tiro', 'sviluppo-fisico-1', 'contare', 'leggere-scrivere', 'conoscenze-magiche', 'linguaggio-arcano'], R('umano-nord'), cat).errori[0]).toMatch(/superato/);
  });
});
