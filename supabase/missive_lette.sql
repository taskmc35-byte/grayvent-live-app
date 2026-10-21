-- =====================================================================
-- Grayvent Live App: puntino rosso sulle Missive del giocatore
-- Tiene traccia di quando il giocatore ha letto la risposta a una sua missiva. Si può rieseguire.
-- =====================================================================
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'missive' and column_name = 'risposta_letta_il') then
    alter table public.missive add column risposta_letta_il timestamptz;
    -- le risposte arrivate prima di oggi contano come già lette: il puntino compare solo per quelle nuove
    update public.missive set risposta_letta_il = coalesce(risposta_il, now()) where risposta is not null;
  end if;
end $$;

create or replace function public.segna_risposta_letta(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.missive set risposta_letta_il = now()
  where id = p_id and utente = auth.uid() and risposta is not null and risposta_letta_il is null;
$$;
revoke all on function public.segna_risposta_letta(uuid) from public, anon;
grant execute on function public.segna_risposta_letta(uuid) to authenticated;
