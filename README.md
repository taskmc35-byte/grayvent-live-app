# Grayvent Live App

Web app per i giocatori di Grayvent Live: scheda del personaggio (PF, PA e Punti Potere calcolati), abilità, poteri,
eventi e iscrizioni, missive ai PNG, taccuino e manuali. Pannello staff per approvare le schede, gestire eventi,
missive, abilità, account e stampare il libretto in PDF.

Senza le variabili Supabase l'app parte in **modalità prova** (dati di esempio salvati solo nel browser).

## Messa online

1. **Supabase** (database e account): crea un progetto gratuito su supabase.com.
   - SQL Editor → incolla ed esegui `supabase/schema.sql` (si può rieseguire senza danni).
   - Authentication → URL Configuration → *Site URL* = l'indirizzo del sito (es. `https://grayvent.netlify.app`).
   - Project Settings → API: copia *Project URL* e chiave *anon public*.
2. **Vercel o Netlify**: importa questo repository; il build è già configurato (`npm run build`, cartella `dist`).
   Aggiungi le variabili d'ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, poi pubblica.
3. **Avvisi email**: esegui anche `supabase/notifiche.sql`, poi inserisci chiave Brevo e mittente (istruzioni in fondo al file).
4. **Manuali caricati dallo staff**: esegui `supabase/manuali.sql`.
5. **Benedizioni e maledizioni**: esegui `supabase/benedizioni.sql`. **Missive dello staff ai personaggi**: esegui `supabase/missive_staff.sql` (dopo `notifiche.sql`). **Scelta di incantesimi e miracoli** (Legame Divino, Conoscenze Magiche, Studio Arcano) con avviso email: esegui `supabase/scelta_incantesimi.sql` (dopo `notifiche.sql`). **Email ai giocatori per ogni nuovo evento**: esegui `supabase/avviso_eventi.sql` (dopo `notifiche.sql`). **Immagine banner degli eventi**: esegui `supabase/eventi_banner.sql`. **Notifiche push**: esegui `supabase/push.sql` (dopo `notifiche.sql`) e pubblica la Edge Function `supabase/functions/push/index.ts` con nome `push` e "Verify JWT" disattivato.
6. **Chatbot dei manuali**: esegui `supabase/chatbot.sql`, inserisci la chiave di Gemini (istruzioni in fondo al file), poi dal pannello staff (Altro → Manuali) premi "Aggiorna il chatbot".
7. **Primo account staff**: registrati dall'app, poi in Supabase (SQL Editor) esegui la riga in fondo a `schema.sql`
   con la tua email per diventare staff.

## Sviluppo

```
npm install
npm run dev      # sito in locale
npm test         # test delle regole (PF, PA, Punti Potere, creazione, incompatibilità, libretto)
```
