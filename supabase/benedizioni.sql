-- =====================================================================
-- Grayvent Live App: Benedizioni e Maledizioni dei personaggi
-- Da eseguire nell'SQL Editor di Supabase DOPO schema.sql. Si può rieseguire.
--
-- Stanno in una tabella a parte (non dentro la scheda) così quelle "nascoste" restano
-- davvero invisibili al giocatore: il database gliele nega, non solo l'app.
-- =====================================================================

create table if not exists public.afflizioni (
  id uuid primary key default gen_random_uuid(),
  personaggio_id uuid not null references public.personaggi(id) on delete cascade,
  tipo text not null check (tipo in ('benedizione', 'maledizione')),
  nome text not null,
  effetto text not null default '',
  origine text,
  durata text,
  nascosta boolean not null default false,   -- il giocatore non la vede
  terminata boolean not null default false,  -- conclusa: resta nello storico dello staff
  creata_il timestamptz not null default now()
);
create index if not exists afflizioni_pg on public.afflizioni (personaggio_id);
alter table public.afflizioni enable row level security;

-- il giocatore vede solo quelle attive e non nascoste dei propri personaggi; lo staff vede tutto
drop policy if exists af_sel on public.afflizioni;
create policy af_sel on public.afflizioni for select using (
  public.is_staff() or (
    not nascosta and not terminata
    and exists (select 1 from public.personaggi p where p.id = personaggio_id and p.proprietario = auth.uid())
  )
);
drop policy if exists af_staff on public.afflizioni;
create policy af_staff on public.afflizioni for all using (public.is_staff()) with check (public.is_staff());
