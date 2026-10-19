import type { Ability, ViaPotere } from './data/types';

/** Nome della via sovrannaturale come appare nei messaggi */
const NOME_VIA: Record<ViaPotere, string> = {
  mago: 'Magia Arcana studiata (Conoscenze Magiche / Studio Arcano)',
  stregone: 'Dono Arcano', sacerdote: 'Legame Divino', alchimista: 'Conoscenza Alchemica', runista: 'Aett (Rune)',
};

/**
 * Coppie di vie incompatibili, dal Manuale di Creazione (Conoscenze Magiche, Dono Arcano Minore, Legame Divino Minore).
 * Alchimia e Rune restano compatibili tra loro (confermato dallo staff).
 */
const INCOMPATIBILI: [ViaPotere, ViaPotere][] = [
  ['mago', 'stregone'], ['mago', 'sacerdote'], ['mago', 'alchimista'], ['mago', 'runista'],
  ['stregone', 'sacerdote'], ['stregone', 'alchimista'], ['stregone', 'runista'],
  ['sacerdote', 'alchimista'], ['sacerdote', 'runista'],
];
const incompatibili = (a: ViaPotere, b: ViaPotere) => INCOMPATIBILI.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** Se l'abilità non si può prendere per via di un potere già posseduto, restituisce il motivo */
export function motivoIncompatibile(a: Ability, owned: Iterable<string>, catalog: Ability[]): string | null {
  const via = a.effetti?.potere?.via;
  if (!via) return null;
  for (const id of owned) {
    if (id === a.id) continue;
    const altra = catalog.find((x) => x.id === id)?.effetti?.potere?.via;
    if (altra && altra !== via && incompatibili(via, altra)) return `Incompatibile con ${NOME_VIA[altra]}`;
  }
  return null;
}
