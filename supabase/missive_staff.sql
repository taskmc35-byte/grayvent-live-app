-- =====================================================================
-- Grayvent Live App: missive dallo staff ai personaggi
-- Da eseguire nell'SQL Editor di Supabase DOPO schema.sql (e dopo notifiche.sql per l'email). Si può rieseguire.
-- Lo staff scrive con un mittente libero (un PNG) a uno o più personaggi; il giocatore la legge nell'app
-- (non può rispondere) e riceve un'email con il testo.
-- =====================================================================

create table if not exists public.missive_staff (
  id uuid primary key default gen_random_uuid(),
  personaggio_id uuid references public.personaggi(id) on delete set null,
  utente uuid references public.profili(id) on delete cascade,   -- giocatore del personaggio al momento dell'invio
  destinatario text not null,                                     -- nome del personaggio
  mittente text not null,
  testo text not null,
  inviata_il timestamptz not null default now(),
  letta_il timestamptz
);
create index if not exists missive_staff_utente on public.missive_staff (utente, inviata_il desc);
alter table public.missive_staff enable row level security;
drop policy if exists ms_sel on public.missive_staff;
create policy ms_sel on public.missive_staff for select using (utente = auth.uid() or public.is_staff());
drop policy if exists ms_staff on public.missive_staff;
create policy ms_staff on public.missive_staff for all using (public.is_staff()) with check (public.is_staff());

-- il giocatore del personaggio viene preso dalla scheda al momento dell'invio
create or replace function public.missiva_staff_utente() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.utente is null then select proprietario into new.utente from public.personaggi where id = new.personaggio_id; end if;
  return new;
end $$;
drop trigger if exists missiva_staff_utente on public.missive_staff;
create trigger missiva_staff_utente before insert on public.missive_staff for each row execute function public.missiva_staff_utente();

-- il giocatore può solo segnarla come letta
create or replace function public.segna_missiva_staff_letta(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.missive_staff set letta_il = now() where id = p_id and utente = auth.uid() and letta_il is null;
$$;
revoke all on function public.segna_missiva_staff_letta(uuid) from public, anon;
grant execute on function public.segna_missiva_staff_letta(uuid) to authenticated;

-- email al giocatore con il testo (se gli avvisi email sono installati)
create schema if not exists privato;
create or replace function privato.avviso_missiva_staff() returns trigger
language plpgsql security definer set search_path = privato, public as $$
declare p public.profili;
begin
  select * into p from public.profili where id = new.utente;
  begin
    perform privato.invia_email(p.email,
      'Una missiva per ' || new.destinatario || ' da ' || new.mittente,
      'Hai ricevuto una missiva',
      '<p><b>Da:</b> ' || privato.h(new.mittente) || '<br><b>A:</b> ' || privato.h(new.destinatario) || '</p>'
      || '<p style="border-left:3px solid #8f3324;padding-left:10px">' || privato.h(new.testo) || '</p>'
      || '<p style="color:#6f604e">La trovi anche nell’app, in Missive &rarr; Ricevute.</p>');
  exception when undefined_function then
    null; -- avvisi email non installati
  end;
  return new;
end $$;
drop trigger if exists avviso_missiva_staff on public.missive_staff;
create trigger avviso_missiva_staff after insert on public.missive_staff for each row execute function privato.avviso_missiva_staff();
