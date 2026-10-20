-- =====================================================================
-- Grayvent Live App: chatbot "Chiedi ai manuali" + domande allo staff
-- Da eseguire nell'SQL Editor di Supabase DOPO schema.sql (e dopo notifiche.sql, se usi gli avvisi email).
-- Si può rieseguire.
--
-- Come funziona: i testi dei manuali stanno nella tabella manuali_parti (li carica lo staff dall'app,
-- pulsante "Aggiorna il chatbot"). A ogni domanda il database cerca i passaggi più pertinenti
-- (ricerca in italiano) e li manda a Gemini, che risponde solo in base a quelli.
-- La chiave di Gemini resta nel database: l'app e i giocatori non la vedono mai.
-- =====================================================================

create extension if not exists http with schema extensions;

-- ---------- testi dei manuali ----------
create table if not exists public.manuali_parti (
  id bigserial primary key,
  manuale text not null,          -- nome del file
  titolo text not null,           -- nome leggibile del manuale
  pagina int not null,
  testo text not null,
  tsv tsvector generated always as (to_tsvector('italian', titolo || ' ' || testo)) stored
);
create index if not exists manuali_parti_tsv on public.manuali_parti using gin (tsv);
create index if not exists manuali_parti_manuale on public.manuali_parti (manuale);
alter table public.manuali_parti enable row level security;
drop policy if exists mp_sel on public.manuali_parti;
create policy mp_sel on public.manuali_parti for select using (auth.uid() is not null);
drop policy if exists mp_ins on public.manuali_parti;
create policy mp_ins on public.manuali_parti for insert with check (public.is_staff());
drop policy if exists mp_del on public.manuali_parti;
create policy mp_del on public.manuali_parti for delete using (public.is_staff());

-- ---------- impostazioni private dell'AI ----------
create schema if not exists privato;
revoke all on schema privato from public, anon, authenticated;
create table if not exists privato.ai_config (
  id int primary key default 1 check (id = 1),
  gemini_api_key text,
  modello text not null default 'gemini-2.5-flash',
  limite_giornaliero int not null default 30      -- domande per giocatore nelle ultime 24 ore
);
insert into privato.ai_config (id) values (1) on conflict (id) do nothing;
revoke all on privato.ai_config from public, anon, authenticated;

-- ---------- registro delle domande (serve per il limite giornaliero) ----------
create table if not exists public.chat_log (
  id bigserial primary key,
  utente uuid not null references public.profili(id) on delete cascade,
  domanda text not null,
  risposta text,
  creata_il timestamptz not null default now()
);
create index if not exists chat_log_utente on public.chat_log (utente, creata_il);
alter table public.chat_log enable row level security;
drop policy if exists cl_sel on public.chat_log;
create policy cl_sel on public.chat_log for select using (utente = auth.uid() or public.is_staff());

-- ---------- domande allo staff (quando la risposta del chatbot non basta) ----------
create table if not exists public.domande_staff (
  id uuid primary key default gen_random_uuid(),
  utente uuid not null references public.profili(id) on delete cascade,
  domanda text not null,
  risposta_bot text,
  messaggio text,
  stato text not null default 'aperta' check (stato in ('aperta', 'risposta')),
  risposta text,
  risposta_il timestamptz,
  creata_il timestamptz not null default now()
);
alter table public.domande_staff enable row level security;
drop policy if exists ds_sel on public.domande_staff;
create policy ds_sel on public.domande_staff for select using (utente = auth.uid() or public.is_staff());
drop policy if exists ds_ins on public.domande_staff;
create policy ds_ins on public.domande_staff for insert with check (utente = auth.uid() and stato = 'aperta' and risposta is null);
drop policy if exists ds_upd on public.domande_staff;
create policy ds_upd on public.domande_staff for update using (public.is_staff()) with check (public.is_staff());

-- ---------- la domanda al chatbot ----------
create or replace function public.chiedi_manuali(p_domanda text, p_storia jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, privato as $$
declare
  v_utente uuid := auth.uid();
  cfg privato.ai_config;
  v_usate int;
  v_cerca text;
  v_query tsquery;
  v_contesto text;
  v_fonti jsonb;
  v_contents jsonb := '[]'::jsonb;
  v_turno jsonb;
  v_resp extensions.http_response;
  v_testo text;
  v_istruzioni text := 'Sei l''assistente delle regole di Grayvent Live, un gioco di ruolo dal vivo (LARP). '
    || 'Rispondi in italiano, in modo chiaro e conciso, basandoti ESCLUSIVAMENTE sugli estratti dei manuali che ti vengono forniti. '
    || 'Se gli estratti non contengono la risposta, dillo apertamente e suggerisci di chiedere allo staff: non inventare mai regole, numeri o eccezioni. '
    || 'Quando usi un''informazione, indica tra parentesi manuale e pagina, per esempio (Manuale del Giocatore, pag. 12). '
    || 'Usa testo semplice: al massimo elenchi puntati con il trattino. Rispondi solo a domande sul gioco Grayvent.';
begin
  if v_utente is null then raise exception 'Accedi per usare il chatbot.'; end if;
  p_domanda := trim(coalesce(p_domanda, ''));
  if length(p_domanda) < 3 then raise exception 'Scrivi una domanda un po'' più lunga.'; end if;
  if length(p_domanda) > 1000 then raise exception 'La domanda è troppo lunga (massimo 1000 caratteri).'; end if;

  select * into cfg from privato.ai_config where id = 1;
  if cfg.gemini_api_key is null then raise exception 'Il chatbot non è ancora attivo: lo staff deve completare la configurazione.'; end if;

  select count(*) into v_usate from public.chat_log where utente = v_utente and creata_il > now() - interval '24 hours';
  if v_usate >= cfg.limite_giornaliero then
    raise exception 'Hai raggiunto il limite di % domande al giorno. Riprova domani oppure contatta lo staff.', cfg.limite_giornaliero;
  end if;

  -- ricerca: parole della domanda (e della domanda precedente, per le richieste di chiarimento), in OR
  v_cerca := p_domanda || ' ' || coalesce((
    select e->>'testo' from jsonb_array_elements(p_storia) with ordinality as t(e, i)
    where e->>'ruolo' = 'utente' order by i desc limit 1), '');
  select to_tsquery('simple', string_agg(quote_literal(lexeme), ' | '))
    into v_query from unnest(to_tsvector('italian', v_cerca));

  if v_query is not null then
    select string_agg(format(E'[%s, pag. %s]\n%s', titolo, pagina, testo), E'\n\n---\n\n' order by rank desc),
           jsonb_agg(jsonb_build_object('manuale', manuale, 'titolo', titolo, 'pagina', pagina) order by rank desc)
      into v_contesto, v_fonti
      from (
        select manuale, titolo, pagina, testo, ts_rank_cd(tsv, v_query) as rank
        from public.manuali_parti where tsv @@ v_query
        order by rank desc limit 8
      ) t;
  end if;

  if v_contesto is null then
    if not exists (select 1 from public.manuali_parti) then
      raise exception 'Il chatbot non ha ancora i testi dei manuali: lo staff deve premere "Aggiorna il chatbot".';
    end if;
    v_contesto := '(Nessun passaggio dei manuali sembra pertinente a questa domanda.)';
    v_fonti := '[]'::jsonb;
  end if;

  -- ultimi scambi della conversazione, per capire le domande di seguito
  for v_turno in select e from jsonb_array_elements(p_storia) e offset greatest(jsonb_array_length(p_storia) - 6, 0) loop
    v_contents := v_contents || jsonb_build_array(jsonb_build_object(
      'role', case when v_turno->>'ruolo' = 'utente' then 'user' else 'model' end,
      'parts', jsonb_build_array(jsonb_build_object('text', left(coalesce(v_turno->>'testo', ''), 2000)))));
  end loop;
  v_contents := v_contents || jsonb_build_array(jsonb_build_object('role', 'user', 'parts', jsonb_build_array(jsonb_build_object(
    'text', E'Estratti dei manuali di Grayvent:\n\n' || v_contesto || E'\n\n===\n\nDomanda del giocatore: ' || p_domanda))));

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '40');
  -- la chiave va nell'intestazione x-goog-api-key: funziona sia con le chiavi AIza... sia con quelle nuove AQ....
  select * into v_resp from extensions.http((
    'POST',
    'https://generativelanguage.googleapis.com/v1beta/models/' || cfg.modello || ':generateContent',
    array[extensions.http_header('x-goog-api-key', cfg.gemini_api_key)],
    'application/json',
    jsonb_build_object(
      'systemInstruction', jsonb_build_object('parts', jsonb_build_array(jsonb_build_object('text', v_istruzioni))),
      'contents', v_contents,
      'generationConfig', jsonb_build_object('temperature', 0.2, 'maxOutputTokens', 1024)
    )::text
  )::extensions.http_request);

  if v_resp.status = 429 then
    raise exception 'Il chatbot ha ricevuto troppe domande in poco tempo. Riprova tra qualche minuto.';
  elsif v_resp.status <> 200 then
    raise warning 'Gemini % : %', v_resp.status, left(v_resp.content, 500);
    raise exception 'Il chatbot al momento non risponde (errore %). Riprova più tardi.', v_resp.status;
  end if;

  v_testo := (v_resp.content::jsonb) #>> '{candidates,0,content,parts,0,text}';
  if coalesce(v_testo, '') = '' then
    v_testo := 'Non sono riuscito a formulare una risposta. Prova a riformulare la domanda oppure contatta lo staff.';
  end if;

  insert into public.chat_log (utente, domanda, risposta) values (v_utente, p_domanda, v_testo);
  return jsonb_build_object('risposta', v_testo, 'fonti', v_fonti,
    'rimaste', greatest(cfg.limite_giornaliero - v_usate - 1, 0));
end $$;

revoke all on function public.chiedi_manuali(text, jsonb) from public, anon;
grant execute on function public.chiedi_manuali(text, jsonb) to authenticated;

-- ---------- avvisi email per le domande allo staff (se notifiche.sql è installato) ----------
create or replace function privato.avviso_domanda() returns trigger
language plpgsql security definer set search_path = privato, public as $$
declare p public.profili;
begin
  select * into p from public.profili where id = new.utente;
  begin
    if tg_op = 'INSERT' then
      perform privato.invia_email(privato.staff_email(),
        'Domanda allo staff da ' || coalesce(p.nome, 'un giocatore'),
        'Nuova domanda allo staff',
        '<p><b>Domanda:</b> ' || privato.h(new.domanda) || '</p>'
        || case when coalesce(new.messaggio, '') <> '' then '<p><b>Messaggio:</b> ' || privato.h(new.messaggio) || '</p>' else '' end
        || case when coalesce(new.risposta_bot, '') <> '' then '<p style="color:#6f604e"><b>Risposta del chatbot (non soddisfacente):</b><br>' || privato.h(new.risposta_bot) || '</p>' else '' end
        || '<p style="color:#6f604e">Giocatore: ' || privato.h(coalesce(p.nome, '')) || ' (' || privato.h(coalesce(p.email, '')) || ')</p>'
        || '<p>Rispondi dal pannello staff, in Missive &rarr; Domande.</p>');
    elsif old.risposta is null and new.risposta is not null then
      perform privato.invia_email(p.email,
        'Lo staff ha risposto alla tua domanda',
        'Risposta dello staff',
        '<p><b>La tua domanda:</b> ' || privato.h(new.domanda) || '</p>'
        || '<p style="border-left:3px solid #8f3324;padding-left:10px">' || privato.h(new.risposta) || '</p>'
        || '<p style="color:#6f604e">La trovi anche nell’app, in Manuali &rarr; Chiedi.</p>');
    end if;
  exception when undefined_function then
    null; -- avvisi email non installati: nessun invio
  end;
  return new;
end $$;

drop trigger if exists avviso_domanda on public.domande_staff;
create trigger avviso_domanda after insert or update of risposta on public.domande_staff
  for each row execute function privato.avviso_domanda();

-- =====================================================================
-- ULTIMO PASSO: inserisci la chiave di Gemini (Google AI Studio) ed esegui.
-- update privato.ai_config set gemini_api_key = 'LA-TUA-CHIAVE';   -- inizia con AIza... oppure AQ....
--
-- Facoltativo:
-- update privato.ai_config set limite_giornaliero = 30;          -- domande al giorno per giocatore
-- update privato.ai_config set modello = 'gemini-2.5-flash';     -- modello di Gemini da usare
-- =====================================================================
