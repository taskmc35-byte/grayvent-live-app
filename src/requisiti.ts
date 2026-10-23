// Requisiti di apprendimento delle abilità: titolo/carica, Sephira e abilità richieste (foglio Abilità dello staff)
import type { Ability, Character } from './data/types';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[’`]/g, "'").replace(/'\s+/g, "'").replace(/hystrix/g, 'histrix').replace(/\s+/g, ' ').trim();

/** Titolo che la razza dà da sé (come scritto nel foglio dello staff) */
const TITOLO_RAZZA: Record<string, string> = {
  'umano-nord': 'Umano Feudo Nord', 'umano-centrale': 'Umano Feudo Centrale', 'umano-acquaviva': 'Umano Feudo Acqua Viva',
  'umano-cieli': 'Umano Feudo Dei Cieli', 'umano-fiamma': 'Umano Feudo Fiamma Ardente', nano: 'Nano', alf: 'Alf',
  vinteralf: 'Vinteralf', mezzorco: "Mezz'Orchi", mezzogigante: 'Mezzo Giganti', benedetto: 'Benedetto', dannato: 'Dannato',
  'senza-fato': 'Senza Fato', 'blotbeast-lupo': 'Blotbeast Lupo', 'blotbeast-orso': 'Blotbeast Orso',
};

/** Titoli che ogni personaggio ha senza che lo staff li assegni: Fyrd e quello della razza */
export function titoliAutomatici(c: Pick<Character, 'razza' | 'razza2'>): string[] {
  return ['Fyrd', ...[c.razza, c.razza2].filter((r): r is string => !!r && !!TITOLO_RAZZA[r]).map((r) => TITOLO_RAZZA[r])];
}
export const titoliDi = (c: Pick<Character, 'razza' | 'razza2' | 'titoli'>) => [...titoliAutomatici(c), ...(c.titoli ?? [])];

/** Il titolo richiesto, come alternative ("/") di gruppi di titoli tutti necessari (",") */
export function titoliRichiesti(a: Pick<Ability, 'titolo'>): string[][] {
  return (a.titolo ?? '').split('/').map((alt) => alt.split(',').map((x) => x.trim()).filter(Boolean)).filter((g) => g.length);
}

/** Tutti i titoli citati nel catalogo: li propone il campo Titoli dello staff */
export function titoliDelCatalogo(catalog: Ability[]): string[] {
  const set = new Map<string, string>();
  for (const a of catalog) for (const g of titoliRichiesti(a)) for (const t of g) if (!set.has(norm(t))) set.set(norm(t), t);
  return [...set.values()].sort((x, y) => x.localeCompare(y, 'it'));
}

export function motivoTitolo(a: Ability, c: Pick<Character, 'razza' | 'razza2' | 'titoli'>): string | null {
  const alt = titoliRichiesti(a);
  if (!alt.length) return null;
  const miei = new Set(titoliDi(c).map(norm));
  if (alt.some((g) => g.every((t) => miei.has(norm(t))))) return null;
  return `Richiede il titolo ${alt.map((g) => g.join(' e ')).join(' oppure ')}`;
}

export function motivoSephira(a: Ability, c: Pick<Character, 'sephire'>): string | null {
  return a.sephira && (c.sephire ?? 0) < a.sephira ? `Richiede Sephira ${a.sephira}` : null;
}

/**
 * Abilità richieste che mancano. Una stessa abilità può comparire più volte nel catalogo (una per professione):
 * basta averne una qualsiasi con quel nome. Le parti che non sono nomi di abilità (es. "7 Miracoli Minori") si ignorano.
 */
export function prerequisitiMancanti(a: Ability, owned: Iterable<string>, catalog: Ability[]): string[] {
  if (!a.prerequisiti) return [];
  const mie = new Set<string>();
  const ids = new Set(owned);
  for (const x of catalog) if (ids.has(x.id)) mie.add(norm(x.nome));
  const esistenti = new Set(catalog.map((x) => norm(x.nome)));
  if (/armatura di cuoio (in su|o superiore)/i.test(a.prerequisiti)) {
    return ['armatura di cuoio', 'armatura di cuoio lavorato', 'armatura ad anelli', 'armatura di piastre'].some((n) => mie.has(n)) ? [] : ['un’Armatura'];
  }
  return a.prerequisiti.split(/,|\n/).map((p) => p.trim()).filter((p) => {
    const n = norm(p);
    return esistenti.has(n) && !mie.has(n);
  });
}

/** Perché lo staff non può assegnare l'abilità a questo personaggio (titolo o Sephira), oppure null */
export function motivoRequisiti(a: Ability, c: Pick<Character, 'razza' | 'razza2' | 'titoli' | 'sephire'>): string | null {
  return motivoTitolo(a, c) ?? motivoSephira(a, c);
}
