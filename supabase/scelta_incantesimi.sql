-- =====================================================================
-- Grayvent Live App: il giocatore sceglie incantesimi e miracoli
-- (Legame Divino, Conoscenze Magiche, Studio Arcano). Da eseguire nell'SQL Editor di Supabase. Si può rieseguire.
--
-- La scelta è definitiva: il giocatore può solo AGGIUNGERE incantesimi alla propria scheda approvata,
-- mai toglierli o cambiarli. Ogni scelta resta registrata nella scheda (dati -> scelte_incantesimi)
-- con data e incantesimi, così lo staff può controllarla. Correzioni: le fa lo staff dalla scheda.
-- =====================================================================

create or replace function public.scegli_incantesimi(p_id uuid, p_ids text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.personaggi;
  attuali jsonb;
  nuovi text[];
begin
  select * into r from public.personaggi where id = p_id for update;
  if not found or r.proprietario is distinct from auth.uid() then raise exception 'Personaggio non trovato'; end if;
  if r.stato <> 'approvato' then raise exception 'La scheda non è ancora approvata'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 or array_length(p_ids, 1) > 8 then raise exception 'Numero di incantesimi non valido'; end if;
  if exists (select 1 from unnest(p_ids) x where x !~ '^[a-z0-9-]{1,80}$') then raise exception 'Incantesimo non valido'; end if;

  attuali := coalesce(r.dati->'incantesimi', '[]'::jsonb);
  select array_agg(distinct x) into nuovi from unnest(p_ids) x where not attuali ? x;
  if nuovi is null then return; end if;

  update public.personaggi set
    dati = jsonb_set(
             jsonb_set(dati, '{incantesimi}', attuali || to_jsonb(nuovi)),
             '{scelte_incantesimi}',
             coalesce(dati->'scelte_incantesimi', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('data', now(), 'incantesimi', to_jsonb(nuovi)))),
    aggiornato_il = now()
  where id = p_id;
end $$;

revoke all on function public.scegli_incantesimi(uuid, text[]) from public, anon;
grant execute on function public.scegli_incantesimi(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------
-- Avviso via email al giocatore quando ottiene Conoscenze Magiche, Studio Arcano o Legame Divino (qualsiasi livello):
-- sull'app può scegliere i suoi incantesimi o miracoli. Parte quando lo staff aggiunge l'abilità a una scheda approvata,
-- oppure quando approva una scheda che le ha già. Richiede notifiche.sql (se manca, non parte nulla).
-- ---------------------------------------------------------------------
create or replace function privato.nome_potere(id text) returns text language sql immutable as $$
  select case
    when id = 'conoscenze-magiche' then 'Conoscenze Magiche'
    when id ~ '^studio-arcano-[1-4]$' then 'Studio Arcano ' || (array['Minore','Maggiore','Estremo','Assoluto'])[right(id, 1)::int]
    when id ~ '^legame-divino-[1-4]$' then 'Legame Divino ' || (array['Minore','Maggiore','Estremo','Assoluto'])[right(id, 1)::int]
  end;
$$;

create or replace function privato.avviso_scelta_incantesimi() returns trigger
language plpgsql security definer set search_path = privato, public as $$
declare
  p public.profili;
  nuove text[];
  nome_pg text := trim(coalesce(new.dati->>'nome', '') || ' ' || coalesce(new.dati->>'cognome', ''));
  miracoli boolean;
  incantesimi boolean;
  cosa text;
begin
  if new.stato <> 'approvato' or new.proprietario is null then return new; end if;
  select array_agg(x) into nuove
  from jsonb_array_elements_text(coalesce(new.dati->'abilita', '[]'::jsonb)) x
  where privato.nome_potere(x) is not null
    and (old.stato is distinct from 'approvato' or not coalesce(old.dati->'abilita', '[]'::jsonb) ? x);
  if nuove is null then return new; end if;

  select * into p from public.profili where id = new.proprietario;
  miracoli := exists (select 1 from unnest(nuove) x where x like 'legame-divino-%');
  incantesimi := exists (select 1 from unnest(nuove) x where x not like 'legame-divino-%');
  cosa := case when miracoli and incantesimi then 'i tuoi incantesimi e miracoli' when miracoli then 'i tuoi miracoli' else 'i tuoi incantesimi' end;

  perform privato.invia_email(p.email,
    'Puoi scegliere ' || cosa,
    'Scegli ' || cosa,
    '<p>' || privato.h(coalesce(split_part(p.nome, ' ', 1), '')) || ', <b>' || privato.h(nome_pg) || '</b> ha ottenuto: '
    || privato.h((select string_agg(privato.nome_potere(x), ', ') from unnest(nuove) x)) || '.</p>'
    || '<p>Apri l’app: nella Scheda trovi l’avviso per scegliere ' || cosa || '. Leggi bene gli effetti prima di confermare, perché la scelta è definitiva.</p>');
  return new;
exception when undefined_function or undefined_table then
  return new; -- avvisi email non installati
end $$;

-- il nome fa partire questa email dopo quella di approvazione (i trigger vanno in ordine alfabetico)
drop trigger if exists avviso_scelta_incantesimi on public.personaggi;
drop trigger if exists avviso_scheda_poteri on public.personaggi;
create trigger avviso_scheda_poteri after update of dati, stato on public.personaggi
  for each row execute function privato.avviso_scelta_incantesimi();
