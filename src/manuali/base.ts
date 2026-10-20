import type { Manuale } from '../data/types';

/** I manuali inclusi nell'app (cartella public/manuali). Lo staff può sostituirne il PDF, rinominarli o nasconderli. */
export const MANUALI_BASE: Manuale[] = [
  { id: 'manuale-giocatore.pdf', nome: 'Manuale del Giocatore', descrizione: 'Regolamento, combattimento e chiamate', sigla: 'G', ordine: 1, nascosto: false, base: true },
  { id: 'creazione-personaggio.pdf', nome: 'Creazione del Personaggio', descrizione: 'Razze, abilità di base e apprendimento', sigla: 'C', ordine: 2, nascosto: false, base: true },
  { id: 'manuale-misteri.pdf', nome: 'Manuale dei Misteri', descrizione: 'Magia, miracoli, alchimia e rune', sigla: 'M', ordine: 3, nascosto: false, base: true },
  { id: 'incantesimi-miracoli.pdf', nome: 'Incantesimi e Miracoli', descrizione: 'Dispense dei poteri minori', sigla: 'I', ordine: 4, nascosto: false, base: true },
  { id: 'manuale-ambientazione.pdf', nome: 'Manuale di Ambientazione', descrizione: 'Storia, regni, leggi e religioni', sigla: 'A', ordine: 5, nascosto: false, base: true },
];

/** Unisce i manuali di base con le modifiche/aggiunte salvate dallo staff */
export function unisciManuali(salvati: Manuale[]): Manuale[] {
  const byId = new Map(MANUALI_BASE.map((m) => [m.id, m]));
  for (const s of salvati) byId.set(s.id, { ...(byId.get(s.id) ?? {}), ...s, base: MANUALI_BASE.some((b) => b.id === s.id) });
  return [...byId.values()].sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome));
}
