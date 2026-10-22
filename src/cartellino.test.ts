import { describe, expect, it } from 'vitest';
import { ALL_ABILITIES, TABELLE } from './data/abilities';
import S from './data/spells.json';
import type { Spell } from './data/types';
import { cercaCodice, cercaScritto, creaIndice, nomeVoce, trovaNelTesto } from './cartellino';

const idx = creaIndice(ALL_ABILITIES, S as Spell[], TABELLE);

describe('Cartellini', () => {
  it('codice scritto a mano: minuscole, senza punto, con spazi', () => {
    expect(cercaCodice(idx, 'C6PK').map(nomeVoce)).toEqual(['Armi Corte']);
    expect(cercaCodice(idx, 'r4cf.wcv').map(nomeVoce)).toEqual(['Dardo di Fuoco']);
    expect(cercaCodice(idx, 'R4CF WCV').map(nomeVoce)).toEqual(['Dardo di Fuoco']);
    expect(cercaCodice(idx, 'r4cfwcv').map(nomeVoce)).toEqual(['Dardo di Fuoco']);
  });
  it('errori tipici della lettura: O/0, I/1, S/5', () => {
    expect(cercaCodice(idx, 'R4CF.WCV'.replace('4', '4')).length).toBe(1);
    expect(cercaCodice(idx, 'C6PK'.replace('6', 'G')).map(nomeVoce)).toEqual(['Armi Corte']);
  });
  it('codici delle tabelle speciali', () => {
    const v = cercaCodice(idx, 'T9PL.YT');
    expect(v).toHaveLength(1);
    expect(v[0].tipo).toBe('tabella');
    expect(nomeVoce(v[0])).toBe('Linfa Eterea, Carattere Melanconico');
  });
  it('testo di una foto: trova i codici tra le altre scritte', () => {
    const testo = 'GRAYVENT\nDardo di Fuoco\nArcano - Minore\nCodice: R4CF . WCV\nScudo C6PK';
    expect(trovaNelTesto(idx, testo).map(nomeVoce).sort()).toEqual(['Armi Corte', 'Dardo di Fuoco']);
    expect(trovaNelTesto(idx, 'R4CF WCV').map(nomeVoce)).toEqual(['Dardo di Fuoco']);
    expect(trovaNelTesto(idx, 'nessun codice qui, solo PAROLE LUNGHE')).toEqual([]);
  });
  it('ricerca per nome o inizio del codice', () => {
    expect(cercaScritto(idx, 'dardo di fuoco').map(nomeVoce)).toContain('Dardo di Fuoco');
    expect(cercaScritto(idx, 'R4CF').length).toBeGreaterThan(5);
  });
});

describe('Cartellini: errori di lettura reali', () => {
  it('4 letto come A', () => {
    expect(trovaNelTesto(idx, 'Dardo di Fuoco\nRACF.WCV').map(nomeVoce)).toEqual(['Dardo di Fuoco']);
  });
  it('codice illeggibile: riconosce il nome stampato', () => {
    expect(new Set(trovaNelTesto(idx, 'Dardo di Fuoco\nIncantesimo Arcano - Fuoco\n??').map(nomeVoce))).toEqual(new Set(['Dardo di Fuoco']));
  });
});
it('parole normali non diventano codici (ALLA non è 4LIA)', () => {
  expect(trovaNelTesto(idx, 'infligge alla locazione vitale\nRACF.WCV').map(nomeVoce)).toEqual(['Dardo di Fuoco']);
});
it('cartellino oggetto reale: titolo "Runa 3^ Aett Odino" + nome', () => {
  const testo = 'Runa 3” Aett Odino\n"INGUZ"\nValore Medio 1000\nOgg. Sovrannaturali\nValutare 2\nE4319V | 64XA14 | O4D9E6 | WV3s17\nvtilizzi/Eventi | | \\ NV VV VVVV\n';
  expect(trovaNelTesto(idx, testo).map((v) => v.codice)).toEqual(['R2HG.EAG']);
});
it('scritto a mano: 8 letto come S (SWEA) è solo un suggerimento, non un risultato sicuro', async () => {
  const { suggerimenti } = await import('./cartellino');
  expect(trovaNelTesto(idx, 'aD\n>\npa.\nSWEA')).toEqual([]);
  expect(suggerimenti(idx, 'aD\n>\npa.\nSWEA').map((v) => v.codice)).toContain('8WEA');
});
it('suggerimenti: WEA (8 non letto) propone 8WEA', async () => {
  const { suggerimenti } = await import('./cartellino');
  expect(suggerimenti(idx, '\\/ FA\nWEA').map((v) => v.codice)).toContain('8WEA');
});
