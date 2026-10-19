import type { Character, LocId, ArmorType } from './types';

const eq = (m: Partial<Record<LocId, ArmorType>>, completa = false): Character['equipaggiamento'] => {
  const ids: LocId[] = ['tronco', 'braccioDx', 'braccioSx', 'gambaDx', 'gambaSx'];
  return { ...Object.fromEntries(ids.map((id) => [id, { armatura: m[id] ?? 'nessuna' }])), completa } as Character['equipaggiamento'];
};

// Personaggi di esempio (dai BG d'esempio del Manuale di Creazione). Non sono schede reali.
export const DEMO_CHARACTERS: Character[] = [
  {
    id: 'demo-sigurd', giocatore: 'Giocatore di esempio 1',
    nome: 'Sigurd', cognome: 'Vreitsson', provenienza: 'Villaggi ai piedi delle montagne, Feudo Nord',
    razza: 'mezzogigante', professione: 'Accademia d’Arme', divinita: 'Thor', eta: 41, sephire: 3,
    abilita: ['armi-corte', 'armi-medie', 'sviluppo-fisico-1', 'armi-due-mani', 'leggere-scrivere', 'linguaggio-runico',
      'armatura-cuoio', 'armatura-cuoio-lavorato', 'armatura-anelli', 'armatura-completa', 'stabilizzare'],
    slot: {
      fisico: { abilita: 'armatura-piastre', eventiTotali: 2, eventiSvolti: 1, insegnante: 'Brann Occhiofermo (PG)', eventoInizio: 'Live di primavera 2026' },
    },
    incantesimi: [],
    equipaggiamento: eq({ tronco: 'anelli', braccioDx: 'cuoioLavorato', braccioSx: 'cuoioLavorato', gambaDx: 'cuoio', gambaSx: 'cuoio' }, true),
    note: 'Cerca notizie sul villaggio scomparso.',
  },
  {
    id: 'demo-lea', giocatore: 'Giocatore di esempio 2',
    nome: 'Lea', cognome: 'Wings', provenienza: 'Altopicco, Feudo dei Cieli',
    razza: 'umano-cieli', professione: 'Circolo Esoterico di Seidr', divinita: 'Freya', elemento: 'Aria', eta: 24, sephire: 2,
    abilita: ['armi-corte', 'contare', 'leggere-scrivere', 'linguaggio-arcano', 'conoscenze-magiche', 'studio-arcano-1', 'armatura-cuoio'],
    slot: {
      mentale: { abilita: 'valutare-1', eventiTotali: 2, eventiSvolti: 0, insegnante: 'Johnathan Mikhel (PG)', eventoInizio: 'Live d’estate 2026' },
      sovrannaturale: { abilita: 'studio-arcano-2', eventiTotali: 3, eventiSvolti: 1, insegnante: 'Maestra Ingrid (PNG)', eventoInizio: 'Live di primavera 2026' },
    },
    incantesimi: ['inc-aria-folata', 'inc-aria-scarica-elettrica', 'inc-sintesi-dardo-arcano', 'inc-sintesi-luce'],
    equipaggiamento: eq({ tronco: 'cuoio' }),
  },
  {
    id: 'demo-aisha', giocatore: 'Giocatore di esempio 3',
    nome: 'Aisha', cognome: 'della Tribù della Terra Rossa', provenienza: 'Deserto di Fiamma Ardente',
    razza: 'umano-fiamma', professione: 'Cattedrale del Padre dell’Oblio', divinita: 'Padre dell’Oblio', eta: 19, sephire: 1,
    abilita: ['armi-corte', 'armi-medie', 'contare', 'leggere-scrivere', 'legame-divino-1', 'stabilizzare', 'armatura-cuoio', 'armatura-cuoio-lavorato'],
    slot: {},
    incantesimi: ['mir-padre-dardo-del-padre', 'mir-padre-tocco-del-padre', 'mir-generico-lacci', 'mir-generico-robustezza-divina'],
    equipaggiamento: eq({ tronco: 'cuoioLavorato', braccioDx: 'cuoio', braccioSx: 'cuoio' }),
  },
];
