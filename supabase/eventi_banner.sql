-- =====================================================================
-- Grayvent Live App: immagine banner degli eventi.
-- Da eseguire nell'SQL Editor di Supabase. Si può rieseguire.
-- Le immagini sono pubbliche in lettura (come una locandina); solo lo staff può caricarle o toglierle.
-- =====================================================================
insert into storage.buckets (id, name, public) values ('eventi', 'eventi', true) on conflict (id) do update set public = true;
drop policy if exists ev_img_read on storage.objects;
create policy ev_img_read on storage.objects for select using (bucket_id = 'eventi');
drop policy if exists ev_img_write on storage.objects;
create policy ev_img_write on storage.objects for insert to authenticated with check (bucket_id = 'eventi' and public.is_staff());
drop policy if exists ev_img_update on storage.objects;
create policy ev_img_update on storage.objects for update to authenticated using (bucket_id = 'eventi' and public.is_staff());
drop policy if exists ev_img_delete on storage.objects;
create policy ev_img_delete on storage.objects for delete to authenticated using (bucket_id = 'eventi' and public.is_staff());
