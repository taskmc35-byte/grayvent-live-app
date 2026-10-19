import type { Ability } from './types';

// Abilità di Base: Manuale di Creazione del Personaggio v1.0 (PC = punti creazione, TdA = eventi di apprendimento)
export const BASE_ABILITIES: Ability[] = [
  // Fisiche e di combattimento
  { id: 'armi-corte', nome: 'Armi Corte', categoria: 'fisico', tipo: 'base', pc: 0, tda: 0,
    descrizione: 'Può usare armi da mischia lunghe fino a 50 cm con il Braccio Principale. L’arma dichiara “Singolo!”, sostituibile con “Singolo! Stordito!”.' },
  { id: 'armi-medie', nome: 'Armi Medie', categoria: 'fisico', tipo: 'base', pc: 1, tda: 1, prerequisiti: 'Armi Corte',
    descrizione: 'Può usare armi da mischia lunghe fino a 110 cm con il Braccio Principale. L’arma dichiara “Singolo!”, sostituibile con “Singolo! Stordito!”.' },
  { id: 'armi-due-mani', nome: 'Armi a Due Mani', categoria: 'fisico', tipo: 'base', pc: 5, tda: 2, prerequisiti: 'Armi Medie, Sviluppo Fisico 1',
    descrizione: 'Può usare armi da mischia tra 110 e 190 cm con entrambe le mani. L’arma dichiara “Doppio!”, sostituibile con “Singolo! Stordito!”.' },
  { id: 'armi-asta', nome: 'Armi in Asta', categoria: 'fisico', tipo: 'base', pc: 3, tda: 2, prerequisiti: 'Armi a Due Mani',
    descrizione: 'Può usare armi da mischia tra 190 e 230 cm con entrambe le mani. L’arma dichiara “Doppio!”, sostituibile con “Singolo! Stordito!”.' },
  { id: 'armi-lancio', nome: 'Armi da Lancio', categoria: 'fisico', tipo: 'base', pc: 2, tda: 1, prerequisiti: 'Armi Corte',
    descrizione: 'Può lanciare armi corte prive di anima rigida con il Braccio Principale. L’arma dichiara “Singolo!”. Vietato lanciare a meno di 3 metri, mirare a volto o inguine, o lanciare al buio.' },
  { id: 'armi-tiro', nome: 'Armi da Tiro', categoria: 'fisico', tipo: 'base', pc: 8, tda: 2,
    descrizione: 'Può usare archi e balestre senza rocchetti fino a 30 libbre. I dardi dichiarano “Singolo!” più la Chiamata Speciale “DIRETTO!”. Vietato tirare a meno di 5 metri, mirare a volto o inguine, o tirare al buio.' },
  { id: 'scudo', nome: 'Scudo', categoria: 'fisico', tipo: 'base', pc: 3, tda: 1,
    descrizione: 'Può usare uno scudo alto e largo al massimo 80 cm. Lo scudo può essere distrutto solo da “Crash!” o “DISINTEGRAZIONE!”.' },
  { id: 'armatura-cuoio', nome: 'Armatura di Cuoio', categoria: 'fisico', tipo: 'base', pc: 4, tda: 1,
    descrizione: 'Può indossare un’armatura semplice di cuoio, cuoio leggero (sotto i 3 mm), ecopelle o foam. Fornisce 1 PA nelle locazioni coperte almeno al 50%, a giudizio dei Master in segreteria.',
    effetti: { armatura: 'cuoio' } },
  { id: 'armatura-cuoio-lavorato', nome: 'Armatura di Cuoio Lavorato', categoria: 'fisico', tipo: 'base', pc: 2, tda: 1, prerequisiti: 'Armatura di Cuoio',
    descrizione: 'Può indossare un’armatura di pelle o cuoio spesso (oltre 3 mm), a più strati o fittamente borchiata. Fornisce 2 PA nelle locazioni coperte almeno al 50%.',
    effetti: { armatura: 'cuoioLavorato' } },
  { id: 'armatura-anelli', nome: 'Armatura ad Anelli', categoria: 'fisico', tipo: 'base', pc: 2, tda: 1, prerequisiti: 'Armatura di Cuoio Lavorato',
    descrizione: 'Può indossare un’armatura ad anelli o di placche di cuoio molto spesse o borchiate. Fornisce 3 PA nelle locazioni coperte almeno al 50%. Impedisce l’uso di qualsiasi Magia Arcana.',
    effetti: { armatura: 'anelli' } },
  { id: 'armatura-piastre', nome: 'Armatura di Piastre', categoria: 'fisico', tipo: 'base', pc: 2, tda: 2, prerequisiti: 'Armatura ad Anelli',
    descrizione: 'Può indossare un’armatura con placche metalliche (spallacci, gorgiera, schinieri, bracciali) o placche di cuoio molto pesanti. Fornisce 4 PA nelle locazioni coperte almeno al 50%. Impedisce la Magia Arcana e il combattimento con due armi.',
    effetti: { armatura: 'piastre' } },
  { id: 'armatura-completa', nome: 'Armatura Completa', categoria: 'fisico', tipo: 'base', pc: 3, tda: 1, prerequisiti: 'Armatura di Cuoio o superiore',
    descrizione: 'Aggiunge 1 PA a tutte le locazioni se l’armatura indossata copre almeno l’80% del corpo, a giudizio dei Master in segreteria.',
    effetti: { completa: true } },
  { id: 'sviluppo-fisico-1', nome: 'Sviluppo Fisico 1', categoria: 'fisico', tipo: 'base', pc: 9, tda: 2,
    descrizione: 'Ottiene 1 Punto Ferita aggiuntivo in tutte le locazioni.', effetti: { pf: 1 } },

  // Mentali e di conoscenza
  { id: 'contare', nome: 'Contare', categoria: 'mentale', tipo: 'base', pc: 1, tda: 1,
    descrizione: 'Sa contare e fare calcoli complessi. Senza questa abilità conta solo fino a 10 e non sa fare calcoli.' },
  { id: 'leggere-scrivere', nome: 'Leggere & Scrivere', categoria: 'mentale', tipo: 'base', pc: 1, tda: 1,
    descrizione: 'Sa leggere e scrivere la lingua comune di Midgard.' },
  { id: 'stabilizzare', nome: 'Stabilizzare', categoria: 'mentale', tipo: 'base', pc: 2, tda: 1,
    descrizione: 'Stabilizza una creatura morente assistendola per 30 secondi e legando una benda bianca alla locazione ferita. Il conteggio di morte si ferma e riprende solo se la stabilizzazione viene interrotta o la locazione subisce altri danni.' },
  { id: 'conoscenza-erboristica', nome: 'Conoscenza Erboristica', categoria: 'mentale', tipo: 'base', pc: 4, tda: 2,
    descrizione: 'Identifica, tramite foglio OG, le proprietà degli ingredienti naturali e delle piante più comuni di Midgard. Sa riconoscerli, valutarli e raccoglierli, ma non conservarli.' },
  { id: 'conoscenza-metallurgica', nome: 'Conoscenza Metallurgica', categoria: 'mentale', tipo: 'base', pc: 4, tda: 2,
    descrizione: 'Identifica, tramite foglio OG, le proprietà di metalli e leghe più comuni. Sa riconoscerli e valutarli, ma non trovarli in natura né raccoglierli.' },
  { id: 'valutare-1', nome: 'Valutare 1', categoria: 'mentale', tipo: 'base', pc: 2, tda: 1, prerequisiti: 'Contare',
    descrizione: 'Tenendo un oggetto tra le mani per 30 secondi sa se il suo valore effettivo è superiore o inferiore alla stima sul cartellino (foglio OG e codici).' },
  { id: 'ambidestria', nome: 'Ambidestria', categoria: 'mentale', tipo: 'base', pc: 4, tda: 2,
    descrizione: 'Può svolgere con la mano secondaria le azioni limitate alla mano principale (lanciare incantesimi, miracoli, cerchi, rune, usare un’arma). Non estende le abilità del Braccio Principale al Braccio Secondario.' },

  // Sovrannaturali e capacità speciali
  { id: 'linguaggio-arcano', nome: 'Linguaggio Arcano', categoria: 'sovrannaturale', tipo: 'base', pc: 2, tda: 1, prerequisiti: 'Leggere & Scrivere',
    descrizione: 'Sa leggere e scrivere il Linguaggio Arcano.' },
  { id: 'linguaggio-runico', nome: 'Linguaggio Runico', categoria: 'sovrannaturale', tipo: 'base', pc: 2, tda: 1, prerequisiti: 'Leggere & Scrivere',
    descrizione: 'Sa leggere e scrivere il Linguaggio Divino di Odino e Surtur e può approfondire lo studio delle Rune.' },
  { id: 'percezione-sovrannaturale', nome: 'Percezione Sovrannaturale', categoria: 'sovrannaturale', tipo: 'base', pc: 4, tda: null, soloCreazione: true,
    descrizione: 'Avverte il potere dell’energia su Midgard, ne riconosce fonti, intensità e natura. Tenendo un oggetto in mano per 30 secondi ne conosce i poteri (foglio OG e codici).' },
  { id: 'conoscenze-magiche', nome: 'Conoscenze Magiche', categoria: 'sovrannaturale', tipo: 'base', pc: 10, tda: 2, prerequisiti: 'Linguaggio Arcano',
    descrizione: 'Apprende 2 Incantesimi Minori casuali dell’Elemento scelto, lanciabili solo tramite Catalizzatore (in creazione si riceve un Catalizzatore Impuro). Ottiene 3 Punti Potere. Non compatibile con Legame Divino Minore, Dono Arcano Minore, Conoscenza Alchemica Minore e 3^ Aett.',
    effetti: { potere: { via: 'mago', livello: 1 } } },
  { id: 'dono-arcano-1', nome: 'Dono Arcano Minore', categoria: 'sovrannaturale', tipo: 'base', pc: 13, tda: null, prerequisiti: 'Contare, Leggere & Scrivere', soloCreazione: true,
    descrizione: 'Usa in modo innato 3 Incantesimi Minori casuali dell’Elemento scelto, di cui uno potenziato a caso. Non compatibile con Legame Divino Minore, Conoscenze Magiche, Studio Arcano Minore, Conoscenza Alchemica Minore e 3^ Aett.',
    effetti: { potere: { via: 'stregone', livello: 1 } } },
  { id: 'legame-divino-1', nome: 'Legame Divino Minore', categoria: 'sovrannaturale', tipo: 'base', pc: 10, tda: 2, prerequisiti: 'Contare, Leggere & Scrivere',
    descrizione: 'È Sacerdote della Divinità a cui è devoto (per le Semi Divinità si fa riferimento all’Astro del Pantheon). Accede a 4 Miracoli Minori: 2 dell’Astro e 2 Generici. Non compatibile con Conoscenze Magiche, Studio Arcano Minore, Dono Arcano Minore, Conoscenza Alchemica Minore e 3^ Aett.',
    effetti: { potere: { via: 'sacerdote', livello: 1 } } },
  { id: 'talento-1', nome: 'Talento 1', categoria: 'mentale', tipo: 'base', pc: 5, tda: null, soloCreazione: true,
    descrizione: 'Monouso. Riduce di uno il numero di eventi per apprendere un’abilità avanzata (minimo 1 evento). Non cumulabile con altri usi né con Talento 2. Va segnalato all’inizio dell’apprendimento.' },
];

// Livelli successivi delle vie sovrannaturali citati nel Manuale dei Misteri.
// PC/TdA e prerequisiti non sono nei manuali: li completa lo staff dal pannello.
const LIV = ['Minore', 'Maggiore', 'Estremo', 'Assoluto'] as const;
const adv = (id: string, nome: string, via: 'mago' | 'stregone' | 'sacerdote' | 'alchimista' | 'runista', livello: 1 | 2 | 3 | 4, descrizione: string): Ability => ({
  id, nome, categoria: 'sovrannaturale', tipo: 'avanzata', pc: null, tda: null, descrizione, effetti: { potere: { via, livello } },
});

export const ADVANCED_ABILITIES: Ability[] = [
  ...LIV.map((l, i) => adv(`studio-arcano-${i + 1}`, `Studio Arcano ${l}`, 'mago', (i + 1) as 1 | 2 | 3 | 4,
    i === 0
      ? 'Sceglie un Elemento, ottiene 2 Incantesimi Elementali Minori casuali, sceglie 2 Incantesimi di Sintesi Minori e ottiene 3 Punti Potere. Chi ha già Conoscenze Magiche mantiene Elemento, incantesimi e PP.'
      : `Accede agli Incantesimi di livello ${l}: 2 Elementali casuali e 2 di Sintesi a scelta.`)),
  ...LIV.slice(1, 3).map((l, i) => adv(`dono-arcano-${i + 2}`, `Dono Arcano ${l}`, 'stregone', (i + 2) as 2 | 3,
    `Accede agli Incantesimi di livello ${l}: 3 Elementali casuali, di cui uno potenziato a scelta del giocatore.`)),
  ...LIV.slice(1).map((l, i) => adv(`legame-divino-${i + 2}`, `Legame Divino ${l}`, 'sacerdote', (i + 2) as 2 | 3 | 4,
    `Accede ai Miracoli di livello ${l}: 2 dell’Astro e 2 Generici a scelta.`)),
  ...LIV.map((l, i) => adv(`alchimia-${i + 1}`, `Conoscenza Alchemica ${l}`, 'alchimista', (i + 1) as 1 | 2 | 3 | 4,
    `Apprende 2 Cerchi Alchemici di livello ${l} della scuola prescelta.`)),
  adv('aett-3', '3^ Aett', 'runista', 1, 'Conosce i simboli della 3^ Aett (Rune di livello Minore).'),
  adv('aett-2', '2^ Aett', 'runista', 2, 'Conosce i simboli della 2^ Aett (Rune di livello Maggiore).'),
  adv('aett-1', '1^ Aett', 'runista', 3, 'Conosce i simboli della 1^ Aett (Rune di livello Estremo).'),
  adv('efaett', 'Efaett', 'runista', 4, 'Conosce i simboli dell’Efaett (Rune di livello Assoluto).'),
];

export const ALL_ABILITIES: Ability[] = [...BASE_ABILITIES, ...ADVANCED_ABILITIES];
