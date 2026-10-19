// Manuale di Ambientazione, "Le Religioni": i Semi Dei appartengono al Pantheon di un Astro.
export type Astro = 'Madre' | 'Spada' | 'Padre';
export const PANTHEON: { astro: Astro; nome: string; semiDei: string[] }[] = [
  { astro: 'Madre', nome: 'Madre della Vita', semiDei: ['Frigga', 'Bragi e Idun', 'Freya', 'Freyr', 'Cernunnus', 'Baldr'] },
  { astro: 'Spada', nome: 'Spada della Giustizia', semiDei: ['Heimdall', 'Forsety', 'Thor', 'Skadi', 'Eitiri', 'Tyr'] },
  { astro: 'Padre', nome: 'Padre dell’Oblio', semiDei: ['Hel', 'Vàli', 'Angrboda', 'Njordr', 'Loky', 'Hodr'] },
];
export const DEI_MINORI = ['Odino', 'Surtur', 'Morte'];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Astro a capo del Pantheon della divinità indicata (Astro stesso o Semi Dio) */
export function astroOf(divinita?: string): Astro | null {
  if (!divinita) return null;
  const d = norm(divinita);
  for (const p of PANTHEON) {
    if (d === norm(p.nome) || d.startsWith(norm(p.astro))) return p.astro;
    if (p.semiDei.some((s) => norm(s) === d)) return p.astro;
  }
  return null;
}
