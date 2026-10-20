-- =====================================================================
-- Grayvent Live App: email a tutti i giocatori quando lo staff crea un nuovo evento
-- (nome dell'evento e date). Da eseguire nell'SQL Editor di Supabase DOPO notifiche.sql. Si può rieseguire.
-- Ogni giocatore riceve la sua email (gli indirizzi non sono visibili agli altri).
-- =====================================================================

-- "sabato 13 marzo 2027" / "da sabato 13 a domenica 14 marzo 2027"
create or replace function privato.data_it(d date) returns text language sql immutable as $$
  select (array['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'])[extract(dow from d)::int + 1]
      || ' ' || extract(day from d)::int || ' '
      || (array['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'])[extract(month from d)::int]
      || ' ' || extract(year from d)::int;
$$;

create or replace function privato.periodo_it(inizio date, fine date) returns text language sql immutable as $$
  select case
    when inizio is null then 'data da definire'
    when fine is null or fine = inizio then privato.data_it(inizio)
    when extract(year from inizio) = extract(year from fine) and extract(month from inizio) = extract(month from fine)
      then 'da ' || split_part(privato.data_it(inizio), ' ', 1) || ' ' || extract(day from inizio)::int || ' a ' || privato.data_it(fine)
    else 'da ' || privato.data_it(inizio) || ' a ' || privato.data_it(fine)
  end;
$$;

create or replace function privato.avviso_nuovo_evento() returns trigger
language plpgsql security definer set search_path = privato, public as $$
declare
  titolo text := coalesce(nullif(new.dati->>'titolo', ''), 'Nuovo evento');
  quando text := privato.periodo_it(nullif(new.dati->>'dataInizio', '')::date, nullif(new.dati->>'dataFine', '')::date);
  g record;
begin
  for g in select email, nome from public.profili where ruolo = 'giocatore' and coalesce(email, '') <> '' loop
    perform privato.invia_email(g.email,
      'Nuovo evento: ' || titolo,
      'Nuovo evento: ' || privato.h(titolo),
      '<p>' || privato.h(coalesce(nullif(split_part(g.nome, ' ', 1), ''), 'Ciao')) || ', lo staff ha pubblicato un nuovo evento di Grayvent Live.</p>'
      || '<p style="font-size:17px"><b>' || privato.h(titolo) || '</b><br>' || privato.h(quando) || '</p>'
      || '<p>Trovi tutti i dettagli nell’app, nella sezione Eventi.</p>');
  end loop;
  return new;
exception when undefined_function or undefined_table then
  return new; -- avvisi email non installati
end $$;

drop trigger if exists avviso_nuovo_evento on public.eventi;
create trigger avviso_nuovo_evento after insert on public.eventi
  for each row execute function privato.avviso_nuovo_evento();
