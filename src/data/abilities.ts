import type { Ability, AbilityEffects } from './types';
import catalogo from './catalogo.json';
import tabelle from './tabelle.json';

/*
 * Catalogo completo delle abilità: database dello staff (scripts/importa_catalogo.py -> catalogo.json).
 * Gli id storici delle schede (armi-corte, legame-divino-1, studio-arcano-2, …) sono mantenuti dall'import.
 * Qui si aggiungono solo gli effetti che l'app calcola da sé (armature, PF, vie di potere).
 */
const EFFETTI: Record<string, AbilityEffects> = {
  'armatura-cuoio': { armatura: 'cuoio' },
  'armatura-cuoio-lavorato': { armatura: 'cuoioLavorato' },
  'armatura-anelli': { armatura: 'anelli' },
  'armatura-piastre': { armatura: 'piastre' },
  'armatura-completa': { completa: true },
};

export const ALL_ABILITIES: Ability[] = (catalogo as Ability[]).map((a) =>
  EFFETTI[a.id] ? { ...a, effetti: { ...a.effetti, ...EFFETTI[a.id] } } : a);
export const BASE_ABILITIES = ALL_ABILITIES.filter((a) => a.tipo === 'base');

export interface TabellaSpeciale { nome: string; righe: string[][] }
export const TABELLE = tabelle as TabellaSpeciale[];
