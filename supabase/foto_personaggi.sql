-- =====================================================================
-- Grayvent Live App: foto del volto dei personaggi. Da eseguire nell'SQL Editor di Supabase. Si può rieseguire.
-- La foto è un'immagine piccola (ritagliata e compressa dall'app) salvata nella scheda stessa: la vedono
-- solo il proprietario e lo staff, come il resto della scheda. Il giocatore può cambiare solo la foto,
-- non il resto della scheda approvata.
-- =====================================================================
create or replace function public.salva_foto(p_id uuid, p_foto text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_foto is not null and (p_foto !~ '^data:image/(jpeg|png|webp);base64,' or length(p_foto) > 300000) then
    raise exception 'Foto non valida o troppo grande';
  end if;
  update public.personaggi
    set dati = case when p_foto is null then dati - 'foto' else jsonb_set(dati, '{foto}', to_jsonb(p_foto)) end,
        aggiornato_il = now()
  where id = p_id and (proprietario = auth.uid() or public.is_staff());
  if not found then raise exception 'Personaggio non trovato'; end if;
end $$;
revoke all on function public.salva_foto(uuid, text) from public, anon;
grant execute on function public.salva_foto(uuid, text) to authenticated;
