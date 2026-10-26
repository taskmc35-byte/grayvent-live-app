-- =====================================================================
-- Grayvent Live App: manuali riservati allo staff (es. Leggi di Esmerion e Leggi dei Feudi)
-- Da eseguire nell'SQL Editor di Supabase DOPO manuali.sql. Si può rieseguire.
--
-- Un manuale "solo staff" non compare ai giocatori e il suo PDF (cartella staff/ dell'archivio)
-- si può aprire solo con un account dello staff.
-- =====================================================================

alter table public.manuali add column if not exists solo_staff boolean not null default false;

drop policy if exists man_sel on public.manuali;
create policy man_sel on public.manuali for select
  using (auth.uid() is not null and (not solo_staff or public.is_staff()));

drop policy if exists man_read on storage.objects;
create policy man_read on storage.objects for select to authenticated
  using (bucket_id = 'manuali' and (name not like 'staff/%' or public.is_staff()));

-- i testi del chatbot di un manuale riservato non devono esistere: se ci fossero, si tolgono
delete from public.manuali_parti where manuale in (select id from public.manuali where solo_staff);
