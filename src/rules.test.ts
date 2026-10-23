import { describe, expect, it } from 'vitest';
import { compute, POWER_TABLE } from './rules';
import { ALL_ABILITIES } from './data/abilities';
import { RACES } from './data/races';
import type { Character, LocId } from './data/types';

type A = Character['equipaggiamento'][LocId]['armatura'];
const eq = (a: Partial<Record<LocId, A>>, completa = false) => {
  const out = { completa } as Character['equipaggiamento'];
  for (const id of ['tronco', 'braccioDx', 'braccioSx', 'gambaDx', 'gambaSx'] as LocId[]) out[id] = { armatura: a[id] ?? 'nessuna' };
  return out;
};
const tutto = (t: A): Partial<Record<LocId, A>> => ({ tronco: t, braccioDx: t, braccioSx: t, gambaDx: t, gambaSx: t });
const pg = (p: Partial<Character>): Character => ({
  id: 't', giocatore: '', nome: 'T', cognome: '', provenienza: '', razza: 'umano-nord', professione: '', sephire: 1,
  abilita: [], slot: {}, incantesimi: [], equipaggiamento: eq({}), ...p,
});
const run = (c: Character) => compute(c, ALL_ABILITIES, RACES);

describe('PF', () => {
  it('base 2 in ogni locazione', () => expect(run(pg({})).locazioni.map((l) => l.pf)).toEqual([2, 2, 2, 2, 2]));
  it('Sviluppo Fisico 1 + Mezzo Gigante = 4', () =>
    expect(run(pg({ razza: 'mezzogigante', abilita: ['sviluppo-fisico-1'] })).pfBase).toBe(4));
  it('Alf: nota notturna', () => expect(run(pg({ razza: 'alf' })).note[0]).toMatch(/notte/));
  it('Mezz’Elfo eredita dalla razza scelta', () =>
    expect(run(pg({ razza: 'mezzelfo', razzaEreditata: 'vinteralf' })).note[0]).toMatch(/notte/));
});

describe('PA', () => {
  it('armatura senza abilità = 0 con avviso', () => {
    const r = run(pg({ equipaggiamento: eq({ tronco: 'anelli' }) }));
    expect(r.locazioni[0].pa).toBe(0);
    expect(r.avvisi.length).toBe(1);
  });
  it('armature per locazione', () => {
    const r = run(pg({ abilita: ['armatura-cuoio', 'armatura-cuoio-lavorato', 'armatura-anelli'], equipaggiamento: eq({ tronco: 'anelli', braccioDx: 'cuoio' }) }));
    expect(r.locazioni.map((l) => l.pa)).toEqual([3, 1, 0, 0, 0]);
  });
  it('Armatura Completa: +1 ovunque se armato su tutto il corpo e dichiarata', () => {
    const r = run(pg({ abilita: ['armatura-cuoio', 'armatura-completa'], equipaggiamento: eq(tutto('cuoio'), true) }));
    expect(r.locazioni.map((l) => l.pa)).toEqual([2, 2, 2, 2, 2]);
  });
  it('Armatura Completa: non si attiva se manca una locazione', () => {
    const r = run(pg({ abilita: ['armatura-cuoio', 'armatura-completa'], equipaggiamento: eq({ ...tutto('cuoio'), gambaSx: 'nessuna' }, true) }));
    expect(r.completaPossibile).toBe(false);
    expect(r.locazioni.map((l) => l.pa)).toEqual([1, 1, 1, 1, 0]);
  });
  it('Armatura Completa: non conta senza abilità o se non dichiarata', () => {
    expect(run(pg({ abilita: ['armatura-cuoio'], equipaggiamento: eq(tutto('cuoio'), true) })).locazioni[0].pa).toBe(1);
    expect(run(pg({ abilita: ['armatura-cuoio', 'armatura-completa'], equipaggiamento: eq(tutto('cuoio'), false) })).locazioni[0].pa).toBe(1);
  });
  it('Fiamma Ardente: +1 solo dove indossa l’armatura', () => {
    const r = run(pg({ razza: 'umano-fiamma', abilita: ['armatura-cuoio'], equipaggiamento: eq({ tronco: 'cuoio', gambaSx: 'cuoio' }) }));
    expect(r.locazioni.map((l) => l.pa)).toEqual([2, 0, 0, 0, 2]);
  });
  it('Fiamma Ardente non armato: nessun bonus', () =>
    expect(run(pg({ razza: 'umano-fiamma' })).locazioni.every((l) => l.pa === 0)).toBe(true));
});

describe('Punti Potere', () => {
  it('Legame Divino Minore = 3 PP, TdR 6 min', () => {
    const p = run(pg({ abilita: ['legame-divino-1'] })).potere[0];
    expect([p.qta, p.tdr]).toEqual([3, '6 min']);
  });
  it('Dono Arcano Minore = 2 PP', () => expect(run(pg({ abilita: ['dono-arcano-1'] })).potere[0].qta).toBe(2));
  it('Conoscenze Magiche + Studio Arcano Maggiore = 4 PP (livello più alto)', () =>
    expect(run(pg({ abilita: ['conoscenze-magiche', 'studio-arcano-1', 'studio-arcano-2'] })).potere).toHaveLength(1));
  it('mago in armatura ad anelli: avviso', () =>
    expect(run(pg({ abilita: ['conoscenze-magiche', 'armatura-cuoio', 'armatura-cuoio-lavorato', 'armatura-anelli'], equipaggiamento: eq({ tronco: 'anelli' }) })).avvisi[0]).toMatch(/Magia Arcana/));
});

import { astroOf } from './data/deities';
describe('Divinità', () => {
  it('Semi Dio -> Astro', () => { expect(astroOf('Freya')).toBe('Madre'); expect(astroOf('Thor')).toBe('Spada'); expect(astroOf('Vali')).toBe('Padre'); });
  it('Astro diretto', () => expect(astroOf('Padre dell’Oblio')).toBe('Padre'));
});

it("Mezz'Elfo: bonus e malus da razze diverse", async () => {
  const { effectiveRace, sangueTesto } = await import('./rules');
  const { RACES, raceLabel } = await import('./data/races');
  const c = { razza: 'mezzelfo', razzaEreditata: 'umano-fiamma', razzaMalus: 'alf' } as never;
  const r = effectiveRace(c, RACES);
  expect(r.bonusDa?.id).toBe('umano-fiamma');
  expect(r.malusDa?.id).toBe('alf');
  expect(sangueTesto(c, RACES, raceLabel)).toMatch(/^bonus da .*, malus da /);
  const stesso = effectiveRace({ razza: 'mezzelfo', razzaEreditata: 'alf' } as never, RACES);
  expect(stesso.malusDa?.id).toBe('alf');
});

it('Legame Divino Puro: 7 PP, recupero 2 minuti', () => {
  const p = POWER_TABLE.sacerdote.valori[4];
  expect([p.qta, p.tdr, p.tdrMax]).toEqual([7, '2 min', '14 min']);
});

it('Studio Arcano Puro e Conoscenza Alchemica Pura', () => {
  const m = POWER_TABLE.mago.valori[4];
  expect([m.qta, m.tdr, m.tdrMax]).toEqual([7, '2 min', '14 min']);
  expect(m.extra).toMatch(/Energia! Crash!/);
  expect(POWER_TABLE.alchimista.valori[4].qta).toBe(17);
});

it('Dono Arcano Assoluto come il Mago Assoluto', () => {
  const st = POWER_TABLE.stregone.valori[3], ma = POWER_TABLE.mago.valori[3];
  expect([st.qta, st.tdr, st.tdrMax]).toEqual([ma.qta, ma.tdr, ma.tdrMax]);
});

describe('abilità prese più volte', () => {
  it('Temprato dalla Vita riacquistato: ogni volta +1 PF (anche sopra il bonus del Mezzo Gigante)', () => {
    expect(run(pg({ abilita: ['temprato-dalla-vita-r5zl'] })).pfBase).toBe(3);
    expect(run(pg({ abilita: ['temprato-dalla-vita-r5zl', 'temprato-dalla-vita-r5zl', 'temprato-dalla-vita-r5zl'] })).pfBase).toBe(5);
    expect(run(pg({ razza: 'mezzogigante', abilita: ['temprato-dalla-vita-r5zl', 'temprato-dalla-vita-1kyk'] })).pfBase).toBe(5);
  });
  it('Combattente Esperto: +1 PA dove c’è armatura', () => {
    const base = run(pg({ abilita: ['armatura-cuoio'], equipaggiamento: eq({ tronco: 'cuoio' }) })).locazioni[0].pa;
    expect(run(pg({ abilita: ['armatura-cuoio', 'combattente-esperto-2igl'], equipaggiamento: eq({ tronco: 'cuoio' }) })).locazioni[0].pa).toBe(base + 1);
  });
});
