// Nomi e ordinamento di scuole e livelli di Incantesimi, Miracoli, Rune e Cerchi Alchemici
import type { Spell } from './data/types';

export const TIPI: { id: Spell['tipo']; nome: string }[] = [
  { id: 'incantesimo', nome: 'Incantesimi' }, { id: 'miracolo', nome: 'Miracoli' },
  { id: 'runa', nome: 'Rune' }, { id: 'cerchio', nome: 'Cerchi Alchemici' },
];

const ORDINE_SCUOLE = ['Fuoco', 'Acqua', 'Terra', 'Aria', 'Luce', 'Ombra', 'Sintesi', 'Generico', 'Madre', 'Spada', 'Padre',
  'Odino', 'Morte', 'Surtur', 'Centrale', 'Pura', 'Anima', 'Corpo', 'Scarlatta'];
export const ORDINE_LIVELLI = ['Minore', 'Maggiore', 'Estremo', 'Assoluto', 'Puro', 'Master', 'Proibito', '3^ Aett', '2^ Aett', '1^ Aett', 'Efaett'];

const DI: Record<string, string> = {
  Fuoco: 'del Fuoco', Acqua: 'dell’Acqua', Terra: 'della Terra', Aria: 'dell’Aria', Luce: 'della Luce', Ombra: 'dell’Ombra',
  Sintesi: 'di Sintesi', Generico: 'Generici', Madre: 'della Madre', Spada: 'della Spada', Padre: 'del Padre', Odino: 'di Odino',
  Morte: 'della Morte', Surtur: 'di Surtur', Centrale: 'del Feudo Centrale', Pura: 'della Via Pura', Anima: 'dell’Anima',
  Corpo: 'del Corpo', Scarlatta: 'Scarlatti',
};

/** es. "Incantesimi del Fuoco", "Miracoli Generici", "Rune di Odino", "Cerchi dell’Anima" */
export function etichettaScuola(tipo: Spell['tipo'], scuola: string) {
  const t = { incantesimo: 'Incantesimi', miracolo: 'Miracoli', runa: 'Rune', cerchio: 'Cerchi' }[tipo];
  return `${t} ${DI[scuola] ?? scuola}`;
}

const pos = (arr: string[], x: string) => { const i = arr.indexOf(x); return i < 0 ? arr.length : i; };
export function ordinaPoteri(a: Spell, b: Spell) {
  return pos(TIPI.map((t) => t.id), a.tipo) - pos(TIPI.map((t) => t.id), b.tipo)
    || pos(ORDINE_SCUOLE, a.scuola) - pos(ORDINE_SCUOLE, b.scuola)
    || pos(ORDINE_LIVELLI, a.livello) - pos(ORDINE_LIVELLI, b.livello)
    || a.nome.localeCompare(b.nome, 'it');
}

/** Raggruppa per tipo + scuola, nell'ordine dei manuali */
export function gruppiPoteri(list: Spell[]): { chiave: string; tipo: Spell['tipo']; scuola: string; titolo: string; poteri: Spell[] }[] {
  const out = new Map<string, { chiave: string; tipo: Spell['tipo']; scuola: string; titolo: string; poteri: Spell[] }>();
  for (const s of [...list].sort(ordinaPoteri)) {
    const k = `${s.tipo}|${s.scuola}`;
    if (!out.has(k)) out.set(k, { chiave: k, tipo: s.tipo, scuola: s.scuola, titolo: etichettaScuola(s.tipo, s.scuola), poteri: [] });
    out.get(k)!.poteri.push(s);
  }
  return [...out.values()];
}
