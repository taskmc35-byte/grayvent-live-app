-- Grayvent Live App: schema database per Supabase
-- Da incollare in Supabase > SQL Editor > New query > Run. Si può rieseguire senza perdere dati.

-- ============ PROFILI ============
create table if not exists public.profili (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text,
  ruolo text not null default 'giocatore' check (ruolo in ('giocatore','staff')),
  creato_il timestamptz default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profili where id = auth.uid() and ruolo = 'staff');
$$;

-- Crea il profilo a ogni nuovo account (registrazione o invito)
create or replace function public.nuovo_utente() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profili (id, email, nome) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', new.email))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.nuovo_utente();

-- ============ PERSONAGGI ============
create table if not exists public.personaggi (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid references public.profili(id) on delete set null,
  attivo boolean not null default true,
  stato text not null default 'approvato' check (stato in ('approvato','in_approvazione','da_rivedere')),
  nota_staff text,
  dati jsonb not null,
  equipaggiamento jsonb not null default '{}'::jsonb,
  aggiornato_il timestamptz default now()
);
alter table public.personaggi add column if not exists stato text not null default 'approvato';
alter table public.personaggi add column if not exists nota_staff text;

-- Catalogo abilità aggiunte o corrette dallo staff
create table if not exists public.abilita (
  id text primary key,
  dati jsonb not null,
  aggiornato_il timestamptz default now()
);

-- Il giocatore cambia SOLO l'equipaggiamento del proprio personaggio approvato
create or replace function public.salva_equipaggiamento(p_id uuid, p_eq jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.personaggi set equipaggiamento = p_eq, aggiornato_il = now()
  where id = p_id and (proprietario = auth.uid() or public.is_staff());
  if not found then raise exception 'Personaggio non trovato'; end if;
end $$;

-- Il giocatore invia una scheda dalla creazione guidata: resta "in approvazione" finché lo staff non la approva.
-- Può modificarla solo finché non è approvata.
create or replace function public.invia_scheda(p_id uuid, p_dati jsonb, p_eq jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  if p_id is null then
    insert into public.personaggi (proprietario, attivo, stato, dati, equipaggiamento)
    values (auth.uid(), true, 'in_approvazione', p_dati, coalesce(p_eq, '{}'::jsonb)) returning id into v_id;
  else
    update public.personaggi set dati = p_dati, equipaggiamento = coalesce(p_eq, equipaggiamento), stato = 'in_approvazione', aggiornato_il = now()
    where id = p_id and proprietario = auth.uid() and stato in ('in_approvazione','da_rivedere') returning id into v_id;
    if v_id is null then raise exception 'Scheda non modificabile'; end if;
  end if;
  return v_id;
end $$;

-- ============ EVENTI E ISCRIZIONI ============
create table if not exists public.eventi (
  id uuid primary key default gen_random_uuid(),
  data_inizio date,
  dati jsonb not null
);
create table if not exists public.iscrizioni (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventi(id) on delete cascade,
  utente uuid not null references public.profili(id) on delete cascade,
  dati jsonb not null,
  pagata boolean not null default false,
  creata_il timestamptz default now(),
  unique (evento_id, utente)
);

-- ============ TACCUINO (privato: lo vede solo il giocatore) ============
create table if not exists public.note (
  id uuid primary key default gen_random_uuid(),
  utente uuid not null references public.profili(id) on delete cascade,
  titolo text not null default '',
  testo text not null default '',
  categoria text not null default 'Altro',
  aggiornata_il timestamptz default now()
);

-- ============ MISSIVE ============
create table if not exists public.missive (
  id uuid primary key default gen_random_uuid(),
  utente uuid not null references public.profili(id) on delete cascade,
  personaggio_id uuid references public.personaggi(id) on delete set null,
  mittente text not null,
  tipo text not null,
  destinatario text not null,
  testo text not null,
  stato text not null default 'inviata' check (stato in ('inviata','letta','risposta')),
  risposta text,
  risposta_il timestamptz,
  inviata_il timestamptz default now()
);
-- tipi di lettera (rieseguibile anche su database già creati)
alter table public.missive drop constraint if exists missive_tipo_check;
alter table public.missive drop constraint if exists risposta_solo_rapida;
alter table public.missive add constraint missive_tipo_check check (tipo in ('normale','assicurata','rapida','runica'));

create table if not exists public.impostazioni (
  chiave text primary key,
  valore jsonb not null
);

-- ============ SICUREZZA (Row Level Security) ============
alter table public.profili enable row level security;
alter table public.personaggi enable row level security;
alter table public.abilita enable row level security;
alter table public.eventi enable row level security;
alter table public.iscrizioni enable row level security;
alter table public.note enable row level security;
alter table public.missive enable row level security;
alter table public.impostazioni enable row level security;

drop policy if exists profili_sel on public.profili;
create policy profili_sel on public.profili for select using (id = auth.uid() or public.is_staff());
drop policy if exists profili_staff on public.profili;
create policy profili_staff on public.profili for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists pg_sel on public.personaggi;
create policy pg_sel on public.personaggi for select using (proprietario = auth.uid() or public.is_staff());
drop policy if exists pg_staff on public.personaggi;
create policy pg_staff on public.personaggi for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists ab_sel on public.abilita;
create policy ab_sel on public.abilita for select using (auth.role() = 'authenticated');
drop policy if exists ab_staff on public.abilita;
create policy ab_staff on public.abilita for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists ev_sel on public.eventi;
create policy ev_sel on public.eventi for select using (auth.role() = 'authenticated');
drop policy if exists ev_staff on public.eventi;
create policy ev_staff on public.eventi for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists isc_own on public.iscrizioni;
create policy isc_own on public.iscrizioni for select using (utente = auth.uid() or public.is_staff());
drop policy if exists isc_ins on public.iscrizioni;
create policy isc_ins on public.iscrizioni for insert with check (utente = auth.uid() and pagata = false);
drop policy if exists isc_upd on public.iscrizioni;
create policy isc_upd on public.iscrizioni for update using (utente = auth.uid() or public.is_staff()) with check (utente = auth.uid() and pagata = false or public.is_staff());
drop policy if exists isc_staff on public.iscrizioni;
create policy isc_staff on public.iscrizioni for delete using (public.is_staff());

drop policy if exists note_own on public.note;
create policy note_own on public.note for all using (utente = auth.uid()) with check (utente = auth.uid());

drop policy if exists mis_sel on public.missive;
create policy mis_sel on public.missive for select using (utente = auth.uid() or public.is_staff());
drop policy if exists mis_ins on public.missive;
create policy mis_ins on public.missive for insert with check (utente = auth.uid() and stato = 'inviata' and risposta is null);
drop policy if exists mis_staff on public.missive;
create policy mis_staff on public.missive for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists imp_sel on public.impostazioni;
create policy imp_sel on public.impostazioni for select using (auth.role() = 'authenticated');
drop policy if exists imp_staff on public.impostazioni;
create policy imp_staff on public.impostazioni for all using (public.is_staff()) with check (public.is_staff());

revoke all on function public.salva_equipaggiamento(uuid, jsonb) from public, anon;
grant execute on function public.salva_equipaggiamento(uuid, jsonb) to authenticated;
revoke all on function public.invia_scheda(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.invia_scheda(uuid, jsonb, jsonb) to authenticated;

-- ============ FILE DEI BACKGROUND ============
insert into storage.buckets (id, name, public) values ('background', 'background', false) on conflict (id) do nothing;
drop policy if exists bg_upload on storage.objects;
create policy bg_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'background' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists bg_read on storage.objects;
create policy bg_read on storage.objects for select to authenticated
  using (bucket_id = 'background' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- PRIMO AVVIO: dopo esserti registrato nell'app, rendi staff il tuo account
-- sostituendo l'email qui sotto ed eseguendo la riga:
-- update public.profili set ruolo = 'staff' where email = 'tua-email@esempio.it';
