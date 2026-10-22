import type { Race } from './types';

// Fonte: Manuale di Creazione del Personaggio v1.0, sezione "Razze giocabili"
export const RACES: Race[] = [
  {
    id: 'umano-nord', nome: 'Umano', origine: 'Feudo Nord',
    dei: 'Madre della Vita, Spada della Giustizia, Skadi, Thor, Baldr, Angrboda, Njord', longevita: '80 anni',
    bonusNome: 'Coraggio',
    bonus: 'Può dichiarare “IMMUNE! Terrore!” all’Effetto Mentale “Terrore!”.',
    malus: 'Subisce 1 danno aggiuntivo quando è bersaglio di una chiamata con il Caratterizzatore “Tuono!”.',
  },
  {
    id: 'umano-centrale', nome: 'Umano', origine: 'Feudo Centrale',
    dei: 'Madre della Vita, Spada della Giustizia, Padre dell’Oblio, Forsety, Heimdall', longevita: '80 anni',
    bonusNome: 'Benedizione Minore',
    bonus: 'Può usare 1 volta al Giorno di Gioco un Miracolo Minore, senza spendere PP, scelto a caso dai Master in creazione. Non impedisce l’apprendimento di altri Poteri Sovrannaturali.',
    malus: 'In aggiunta a una chiamata con l’Effetto Fisico “Dolore!” subisce “FATO! SHOCK!”.',
    abilitaObbligatorie: ['contare', 'leggere-scrivere'],
  },
  {
    id: 'umano-acquaviva', nome: 'Umano', origine: 'Feudo Acqua Viva',
    dei: 'Frigga, Freyr, Bragi e Idunn, Loky, Njordr, Hodr, Vali', longevita: '90 anni',
    bonusNome: 'Risorse 1',
    bonus: 'Ottiene il 100% in più della rendita standard (consegnata a inizio evento) una volta a evento.',
    malus: 'Subisce 1 danno aggiuntivo quando è bersaglio di una chiamata con il Caratterizzatore “Fuoco!”.',
  },
  {
    id: 'umano-cieli', nome: 'Umano', origine: 'Feudo dei Cieli',
    dei: 'Freya, Frigga, Bragi e Idun, Loky, Heimdall, Madre della Vita', longevita: '100 anni',
    bonusNome: 'Percezione Sovrannaturale',
    bonus: 'Avverte il potere dell’energia su Midgard, ne riconosce fonti, intensità e natura. Tenendo un oggetto in mano per 30 secondi ne conosce i poteri (foglio OG e codici).',
    malus: 'Subisce 1 danno aggiuntivo quando è bersaglio di una chiamata con il Caratterizzatore “Pietra!”.',
  },
  {
    id: 'umano-fiamma', nome: 'Umano', origine: 'Feudo Fiamma Ardente',
    dei: 'Baldr, Tyr, Vali, Padre dell’Oblio, Spada della Giustizia, Skadi', longevita: '80 anni',
    bonusNome: 'Combattente Esperto',
    bonus: 'Ottiene un Punto Armatura aggiuntivo in ogni locazione in cui indossa un’armatura. Va riparato come un normale PA.',
    malus: 'Subisce 1 danno aggiuntivo quando è bersaglio di una chiamata con il Caratterizzatore “Gelo!”.',
    effetti: { paSeArmato: 1 },
  },
  {
    id: 'nano', nome: 'Nano', origine: 'Regno Aureo',
    dei: 'Eitiri, Spada della Giustizia', longevita: '200 anni',
    bonusNome: 'Immunità Congenita Minore',
    bonus: 'Può dichiarare “IMMUNE!” a un qualsiasi Incantesimo Arcano Minore 2 volte per Giorno di Gioco.',
    malus: 'Non può apprendere “Armi in Asta”, “Conoscenze Magiche”, “Dono/Studio Arcano Minore”.',
    abilitaVietate: ['armi-asta', 'conoscenze-magiche', 'dono-arcano-1', 'studio-arcano-1'],
  },
  {
    id: 'alf', nome: 'Alf', origine: 'Raghen, Foreste di Luce',
    dei: 'Madre della Vita, Freya', longevita: '1000 anni',
    bonusNome: 'Talento 2',
    bonus: 'Può ridurre di un evento la durata di un apprendimento di un’abilità avanzata appena iniziato (minimo 1 evento), da attivare al termine dell’evento in cui è iniziato. Cumulabile con “Talento 1”. Non vale per le Abilità Base.',
    malus: '−1 PF durante la notte, dal tramonto all’alba.',
    effetti: { malusNotte: true },
  },
  {
    id: 'vinteralf', nome: 'Vinteralf', origine: 'Catene montuose a sud delle Raghen',
    dei: 'Madre della Vita, Skadi', longevita: '700 anni',
    bonusNome: 'Talento 2',
    bonus: 'Può ridurre di un evento la durata di un apprendimento di un’abilità avanzata appena iniziato (minimo 1 evento), da attivare al termine dell’evento in cui è iniziato. Cumulabile con “Talento 1”. Non vale per le Abilità Base.',
    malus: '−1 PF durante la notte, dal tramonto all’alba.',
    effetti: { malusNotte: true },
    abilitaObbligatorie: ['conoscenza-erboristica'],
  },
  {
    id: 'mezzelfo', nome: 'Mezz’Elfo', origine: 'Halvalf / Halvinteralf', longevita: '75 anni',
    bonusNome: 'Sangue misto',
    bonus: 'In base al Fato, i bonus di una razza Elfica o di una razza Umana.',
    malus: 'In base al Fato, i malus di una razza Elfica o di una razza Umana.',
    ereditaDaScelta: true,
  },
  {
    id: 'benedetto', nome: 'Benedetto', longevita: '75 anni',
    bonusNome: 'Sangue angelico',
    bonus: 'Può aggiungere il Caratterizzatore “Luce!” con l’arma da mischia del Braccio Principale.',
    malus: 'Subisce 1 danno aggiuntivo quando è bersaglio di una chiamata con il Caratterizzatore “Ombra!”.',
  },
  {
    id: 'dannato', nome: 'Dannato', longevita: '75 anni',
    bonusNome: 'Sangue demoniaco',
    bonus: 'Può aggiungere il Caratterizzatore “Ombra!” con l’arma da mischia del Braccio Principale.',
    malus: 'Subisce 1 danno aggiuntivo quando è bersaglio di una chiamata con il Caratterizzatore “Luce!”.',
  },
  {
    id: 'mezzorco', nome: 'Mezz’Orco', origine: 'Feudo Acqua Viva',
    dei: 'Padre dell’Oblio, Cernunnus, Tyr, Skadi, Njord', longevita: '50 anni',
    bonusNome: 'Coraggio',
    bonus: 'Può dichiarare “IMMUNE! Terrore!” all’Effetto Mentale “Terrore!”.',
    malus: 'Subisce anche “FATO! Furia!” quando è bersaglio di una chiamata con il Caratterizzatore “Fuoco!”.',
  },
  {
    id: 'mezzogigante', nome: 'Mezzo Gigante', origine: 'Feudo Nord',
    dei: 'Thor, Baldr, Odino', longevita: '120 anni',
    bonusNome: 'Temprato dalla Vita',
    bonus: 'Ottiene un Punto Ferita aggiuntivo in tutte le locazioni.',
    malus: 'Ad ogni Incantesimo subito aggiunge 1 danno al tronco, anche se l’effetto non è aggressivo.',
    effetti: { pf: 1 },
    abilitaObbligatorie: ['linguaggio-runico'],
  },
  // Razze che non si scelgono in creazione. Bonus e malus da completare con lo staff.
  ...([
    ['senza-fato', 'Senza Fato', undefined, 'gioco'],
    ['blotbeast-lupo', 'Blotbeast', 'Lupo', 'gioco'],
    ['blotbeast-orso', 'Blotbeast', 'Orso', 'gioco'],
    ['svartalf', 'Svartalf', undefined, 'png'],
    ['orco', 'Orco', undefined, 'png'],
    ['goblin', 'Goblin', undefined, 'png'],
    ['draconis', 'Draconis', undefined, 'png'],
  ] as const).map(([id, nome, origine, soloStaff]): Race => ({ id, nome, origine, soloStaff, bonusNome: '', bonus: 'Dettagli in arrivo dallo staff.', malus: 'Dettagli in arrivo dallo staff.' })),
];

export const raceById = (id?: string) => RACES.find((r) => r.id === id);
export const raceLabel = (r?: Race) => (r ? (['Umano', 'Blotbeast'].includes(r.nome) && r.origine ? `${r.nome}, ${r.origine}` : r.nome) : '—');
/** razze che il giocatore può scegliere in creazione */
export const RAZZE_CREAZIONE = RACES.filter((r) => !r.soloStaff);
