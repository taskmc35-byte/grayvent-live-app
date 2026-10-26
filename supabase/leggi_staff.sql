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


-- ---------- chatbot: i manuali riservati li usa solo per rispondere allo staff ----------
alter table public.manuali_parti add column if not exists solo_staff boolean not null default false;
create index if not exists manuali_parti_staff on public.manuali_parti (solo_staff);
drop policy if exists mp_sel on public.manuali_parti;
create policy mp_sel on public.manuali_parti for select using (auth.uid() is not null and (not solo_staff or public.is_staff()));

-- il segno "solo staff" dei passaggi segue sempre quello del manuale
create or replace function privato.parti_solo_staff() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.solo_staff := coalesce((select solo_staff from public.manuali where id = new.manuale), false);
  return new;
end $$;
drop trigger if exists parti_solo_staff on public.manuali_parti;
create trigger parti_solo_staff before insert on public.manuali_parti for each row execute function privato.parti_solo_staff();

create or replace function privato.manuale_solo_staff() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.manuali_parti set solo_staff = new.solo_staff where manuale = new.id and solo_staff is distinct from new.solo_staff;
  return new;
end $$;
drop trigger if exists manuale_solo_staff on public.manuali;
create trigger manuale_solo_staff after insert or update of solo_staff on public.manuali for each row execute function privato.manuale_solo_staff();
-- (la ricerca in privato.prepara, chatbot.sql, filtra: "and (not solo_staff or public.is_staff())")
