-- =====================================================================
-- Grayvent Live App: manuali caricati dallo staff
-- Da eseguire nell'SQL Editor di Supabase DOPO schema.sql. Si può rieseguire.
--
-- I cinque manuali di base sono già dentro l'app; questa tabella permette allo staff di:
-- aggiungerne di nuovi (es. FAQ), sostituire il PDF di uno esistente, cambiarne nome/descrizione o nasconderlo.
-- I PDF caricati stanno nell'archivio "manuali" e li possono aprire solo gli utenti con account.
-- =====================================================================

create table if not exists public.manuali (
  id text primary key,                 -- per i manuali di base è il nome del file (es. manuale-giocatore.pdf)
  nome text not null,
  descrizione text not null default '',
  sigla text not null default '',
  ordine int not null default 100,
  file_path text,                      -- PDF nell'archivio "manuali"; vuoto = PDF di base dell'app
  nascosto boolean not null default false,
  aggiornato_il timestamptz not null default now()
);
alter table public.manuali enable row level security;
drop policy if exists man_sel on public.manuali;
create policy man_sel on public.manuali for select using (auth.uid() is not null);
drop policy if exists man_staff on public.manuali;
create policy man_staff on public.manuali for all using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public) values ('manuali', 'manuali', false) on conflict (id) do nothing;
drop policy if exists man_read on storage.objects;
create policy man_read on storage.objects for select to authenticated using (bucket_id = 'manuali');
drop policy if exists man_write on storage.objects;
create policy man_write on storage.objects for insert to authenticated with check (bucket_id = 'manuali' and public.is_staff());
drop policy if exists man_update on storage.objects;
create policy man_update on storage.objects for update to authenticated using (bucket_id = 'manuali' and public.is_staff());
drop policy if exists man_delete on storage.objects;
create policy man_delete on storage.objects for delete to authenticated using (bucket_id = 'manuali' and public.is_staff());
