-- =====================================================================
-- Grayvent Live App: notifiche push sui telefoni
-- Da eseguire nell'SQL Editor di Supabase DOPO notifiche.sql. Si può rieseguire.
-- Ogni avviso che parte per email (schede, missive, iscrizioni, domande, poteri, nuovi eventi) arriva anche
-- come notifica push a chi l'ha attivata nell'app. Le notifiche le spedisce la Edge Function "push".
-- =====================================================================
create extension if not exists pg_net;
create schema if not exists privato;

-- chiavi del servizio push: le crea da sola la Edge Function al primo uso
create table if not exists privato.push_config (
  id int primary key default 1 check (id = 1),
  pubblica text,
  privata jsonb,
  soggetto text not null default 'mailto:taskmc35@googlemail.com',
  funzione_url text not null default 'https://nequaofnfpizncveywum.supabase.co/functions/v1/push'
);
insert into privato.push_config (id) values (1) on conflict (id) do nothing;
revoke all on privato.push_config from public, anon, authenticated;

create or replace function public.push_config_leggi() returns jsonb
language sql stable security definer set search_path = privato as $$
  select jsonb_build_object('pubblica', pubblica, 'privata', privata, 'soggetto', soggetto) from privato.push_config where id = 1;
$$;
revoke all on function public.push_config_leggi() from public, anon, authenticated;
grant execute on function public.push_config_leggi() to service_role;

create or replace function public.push_config_salva(p_pubblica text, p_privata jsonb) returns void
language sql security definer set search_path = privato as $$
  update privato.push_config set pubblica = p_pubblica, privata = p_privata where id = 1 and pubblica is null;
$$;
revoke all on function public.push_config_salva(text, jsonb) from public, anon, authenticated;
grant execute on function public.push_config_salva(text, jsonb) to service_role;

-- chiave pubblica per l'app (non è un segreto)
create or replace function public.push_chiave() returns text
language sql stable security definer set search_path = privato as $$
  select pubblica from privato.push_config where id = 1;
$$;
grant execute on function public.push_chiave() to authenticated;

-- telefoni iscritti alle notifiche
create table if not exists public.push_iscrizioni (
  id uuid primary key default gen_random_uuid(),
  utente uuid not null references public.profili(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  creata_il timestamptz not null default now()
);
alter table public.push_iscrizioni enable row level security;
drop policy if exists push_sel on public.push_iscrizioni;
create policy push_sel on public.push_iscrizioni for select using (utente = auth.uid());

create or replace function public.push_iscrivi(p_endpoint text, p_p256dh text, p_auth text) returns void
language sql security definer set search_path = public as $$
  insert into public.push_iscrizioni (utente, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set utente = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, creata_il = now();
$$;
create or replace function public.push_disiscrivi(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_iscrizioni where endpoint = p_endpoint and utente = auth.uid();
$$;
revoke all on function public.push_iscrivi(text, text, text) from public, anon;
revoke all on function public.push_disiscrivi(text) from public, anon;
grant execute on function public.push_iscrivi(text, text, text) to authenticated;
grant execute on function public.push_disiscrivi(text) to authenticated;

-- coda delle notifiche (la legge solo la Edge Function)
create table if not exists public.notifiche_push (
  id uuid primary key default gen_random_uuid(),
  utenti uuid[] not null,
  titolo text not null,
  testo text,
  url text,
  creata_il timestamptz not null default now(),
  inviata_il timestamptz,
  inviate int
);
alter table public.notifiche_push enable row level security;

-- da un'email in partenza ricava a chi mandare la notifica (giocatore o tutto lo staff) e la mette in coda
create or replace function privato.accoda_push(dest text, oggetto text, corpo text) returns void
language plpgsql security definer set search_path = privato, public as $$
declare
  ids uuid[];
  nuovo uuid;
  c privato.push_config;
  testo text;
begin
  if coalesce(dest, '') = '' then return; end if;
  if lower(dest) = lower(coalesce(privato.staff_email(), '')) then
    select array_agg(id) into ids from public.profili where ruolo = 'staff';
  else
    select array_agg(id) into ids from public.profili where lower(email) = lower(dest);
  end if;
  if ids is null or not exists (select 1 from public.push_iscrizioni where utente = any(ids)) then return; end if;
  select * into c from privato.push_config where id = 1;
  testo := regexp_replace(coalesce(corpo, ''), '<br\s*/?>|</p>', ' ', 'gi');
  testo := regexp_replace(testo, '<[^>]+>', '', 'g');
  testo := replace(replace(replace(replace(replace(testo, '&rarr;', '→'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&amp;', '&');
  testo := left(btrim(regexp_replace(testo, '\s+', ' ', 'g')), 180);
  insert into public.notifiche_push (utenti, titolo, testo, url) values (ids, oggetto, testo, './') returning id into nuovo;
  perform net.http_post(url := c.funzione_url, body := jsonb_build_object('azione', 'invia', 'id', nuovo),
    headers := jsonb_build_object('content-type', 'application/json'));
exception when others then
  raise warning 'Notifica push non inviata: %', sqlerrm; -- non deve mai bloccare il salvataggio
end $$;

-- invio email: ora mette in coda anche la notifica push (stessa funzione di notifiche.sql, con una riga in più)
create or replace function privato.invia_email(dest text, oggetto text, titolo text, corpo text) returns void
language plpgsql security definer set search_path = privato, public as $$
declare c privato.email_config;
begin
  begin perform privato.accoda_push(dest, oggetto, corpo); exception when undefined_function then null; end;
  select * into c from privato.email_config where id = 1;
  if c.brevo_api_key is null or c.mittente_email is null or coalesce(dest, '') = '' then return; end if;
  perform net.http_post(
    url := 'https://api.brevo.com/v3/smtp/email',
    headers := jsonb_build_object('api-key', c.brevo_api_key, 'content-type', 'application/json', 'accept', 'application/json'),
    body := jsonb_build_object(
      'sender', jsonb_build_object('name', c.mittente_nome, 'email', c.mittente_email),
      'to', jsonb_build_array(jsonb_build_object('email', dest)),
      'subject', oggetto,
      'htmlContent', privato.email_html(titolo, corpo, c.sito)
    )
  );
exception when others then
  raise warning 'Email non inviata: %', sqlerrm;
end $$;
