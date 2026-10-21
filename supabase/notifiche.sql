-- =====================================================================
-- Grayvent Live App: avvisi via email (staff e giocatori)
-- Da eseguire nell'SQL Editor di Supabase DOPO schema.sql. Si può rieseguire.
--
-- Le email partono tramite l'API di Brevo, direttamente dal database:
--   allo staff   -> nuova scheda da approvare (anche quando viene corretta e rinviata),
--                   nuova missiva, nuova iscrizione a un evento
--   al giocatore -> scheda approvata o rimandata indietro, risposta a una missiva
--
-- Finché la chiave Brevo non è inserita (vedi in fondo) non parte nulla e l'app funziona normalmente.
-- =====================================================================

create extension if not exists pg_net;

-- Impostazioni private: non sono raggiungibili dall'app, solo dal database e dalla dashboard
create schema if not exists privato;
revoke all on schema privato from public, anon, authenticated;

create table if not exists privato.email_config (
  id int primary key default 1 check (id = 1),
  brevo_api_key text,
  mittente_email text,
  mittente_nome text not null default 'Grayvent Live',
  staff_email text not null default 'taskmc35@googlemail.com',
  sito text not null default 'https://grayvent-live-app.vercel.app'
);
insert into privato.email_config (id) values (1) on conflict (id) do nothing;
revoke all on privato.email_config from public, anon, authenticated;

-- Testo sicuro dentro l'HTML
create or replace function privato.h(t text) returns text language sql immutable as $$
  select replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), E'\n', '<br>');
$$;

-- Impaginazione comune delle email
create or replace function privato.email_html(titolo text, corpo text, sito text) returns text language sql immutable as $$
  select '<div style="background:#f2e8d3;padding:24px;font-family:Georgia,serif;color:#2a211b">'
      || '<div style="max-width:560px;margin:0 auto;background:#fbf6ea;border:1px solid #c2ae8a;padding:24px">'
      || '<p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#8f3324">GRAYVENT LIVE</p>'
      || '<h1 style="margin:0 0 16px;font-size:22px;font-weight:normal">' || titolo || '</h1>'
      || '<div style="font-size:15px;line-height:1.5">' || corpo || '</div>'
      || '<p style="margin:24px 0 0;padding-top:14px;border-top:1px solid #c2ae8a;color:#6f604e">Accedi all’app Grayvent Live per vedere tutte le novità.</p>'
      || '</div></div>';
$$;

-- Invio tramite Brevo (asincrono: non rallenta e non blocca mai l'app)
create or replace function privato.invia_email(dest text, oggetto text, titolo text, corpo text) returns void
language plpgsql security definer set search_path = privato, public as $$
declare c privato.email_config;
begin
  -- notifica push in parallelo all'email (se push.sql è installato)
  begin perform privato.accoda_push(dest, oggetto, corpo); exception when undefined_function then null; end;
  select * into c from privato.email_config where id = 1;
  if c.brevo_api_key is null or c.mittente_email is null or coalesce(dest, '') = '' then return; end if;
  perform net.http_post(
    url := 'https://api.brevo.com/v3/smtp/email',
    headers := jsonb_build_object('api-key', c.brevo_api_key, 'content-type', 'application/json', 'accept', 'application/json'),
    body := jsonb_build_object(
      'sender', jsonb_build_object('name', c.mittente_nome, 'email', c.mittente_email),
      'to', jsonb_build_array(jsonb_build_object('email', dest)),
      'subject', oggetto,
      'htmlContent', privato.email_html(titolo, corpo, c.sito)
    )
  );
exception when others then
  raise warning 'Email non inviata: %', sqlerrm; -- un errore di invio non deve mai bloccare il salvataggio
end $$;

create or replace function privato.staff_email() returns text language sql stable security definer set search_path = privato as $$
  select staff_email from privato.email_config where id = 1;
$$;

-- ---------------------------------------------------------------------
-- SCHEDE: nuova da approvare (staff) / approvata o rimandata (giocatore)
-- ---------------------------------------------------------------------
create or replace function privato.avviso_scheda() returns trigger
language plpgsql security definer set search_path = privato, public as $$
declare
  nome_pg text := trim(coalesce(new.dati->>'nome', '') || ' ' || coalesce(new.dati->>'cognome', ''));
  p public.profili;
begin
  select * into p from public.profili where id = new.proprietario;

  if new.stato = 'in_approvazione' and (tg_op = 'INSERT' or old.stato is distinct from 'in_approvazione') then
    perform privato.invia_email(privato.staff_email(),
      'Nuova scheda da approvare: ' || nome_pg,
      case when tg_op = 'UPDATE' and old.stato = 'da_rivedere' then 'Scheda corretta da ricontrollare' else 'Nuova scheda da approvare' end,
      '<p><b>' || privato.h(nome_pg) || '</b></p>'
      || '<p>Giocatore: ' || privato.h(coalesce(p.nome, '')) || ' (' || privato.h(coalesce(p.email, '')) || ')</p>'
      || '<p>La trovi nel pannello staff, in Personaggi &rarr; Da approvare.</p>');
  end if;

  if tg_op = 'UPDATE' and old.stato = 'in_approvazione' and new.stato = 'approvato' then
    perform privato.invia_email(p.email,
      'La tua scheda è stata approvata',
      'Scheda approvata',
      '<p>' || privato.h(coalesce(split_part(p.nome, ' ', 1), '')) || ', i Master hanno approvato la scheda di <b>' || privato.h(nome_pg) || '</b>.</p>'
      || '<p>Da ora la trovi completa nell’app: PF, PA, abilità e poteri.</p>');
  end if;

  if tg_op = 'UPDATE' and old.stato = 'in_approvazione' and new.stato = 'da_rivedere' then
    perform privato.invia_email(p.email,
      'La tua scheda va rivista',
      'Scheda da rivedere',
      '<p>' || privato.h(coalesce(split_part(p.nome, ' ', 1), '')) || ', i Master chiedono qualche modifica alla scheda di <b>' || privato.h(nome_pg) || '</b>.</p>'
      || case when coalesce(new.nota_staff, '') <> '' then '<p style="border-left:3px solid #8f3324;padding-left:10px"><i>' || privato.h(new.nota_staff) || '</i></p>' else '' end
      || '<p>Apri l’app, correggi la scheda e inviala di nuovo.</p>');
  end if;

  return new;
end $$;

drop trigger if exists avviso_scheda on public.personaggi;
create trigger avviso_scheda after insert or update of stato on public.personaggi
  for each row execute function privato.avviso_scheda();

-- ---------------------------------------------------------------------
-- MISSIVE: nuova (staff) / risposta arrivata (giocatore)
-- ---------------------------------------------------------------------
create or replace function privato.avviso_missiva() returns trigger
language plpgsql security definer set search_path = privato, public as $$
declare
  p public.profili;
  tipo_nome text := case new.tipo when 'normale' then 'Posta semplice' when 'assicurata' then 'Posta assicurata'
                    when 'rapida' then 'Assicurata e rapida' when 'runica' then 'Assicurata e runica' else new.tipo end;
begin
  select * into p from public.profili where id = new.utente;

  if tg_op = 'INSERT' then
    perform privato.invia_email(privato.staff_email(),
      'Nuova missiva (' || tipo_nome || ') per ' || new.destinatario,
      'Nuova missiva',
      '<p><b>' || privato.h(tipo_nome) || '</b><br>Da: ' || privato.h(new.mittente) || '<br>A: ' || privato.h(new.destinatario) || '</p>'
      || '<p style="border-left:3px solid #c2ae8a;padding-left:10px">' || privato.h(new.testo) || '</p>'
      || '<p style="color:#6f604e">Giocatore: ' || privato.h(coalesce(p.nome, '')) || ' (' || privato.h(coalesce(p.email, '')) || ')</p>');
  elsif old.risposta is null and new.risposta is not null then
    perform privato.invia_email(p.email,
      'Risposta da ' || new.destinatario,
      'È arrivata una risposta',
      '<p>' || privato.h(new.destinatario) || ' ha risposto alla tua missiva.</p>'
      || '<p style="border-left:3px solid #8f3324;padding-left:10px">' || privato.h(new.risposta) || '</p>'
      || '<p style="color:#6f604e">La trovi anche nell’app, nella sezione Missive.</p>');
  end if;
  return new;
end $$;

drop trigger if exists avviso_missiva on public.missive;
create trigger avviso_missiva after insert or update of risposta on public.missive
  for each row execute function privato.avviso_missiva();

-- ---------------------------------------------------------------------
-- ISCRIZIONI AGLI EVENTI (staff)
-- ---------------------------------------------------------------------
create or replace function privato.avviso_iscrizione() returns trigger
language plpgsql security definer set search_path = privato, public as $$
declare
  ev text;
  d jsonb := new.dati;
begin
  select dati->>'titolo' into ev from public.eventi where id = new.evento_id;
  perform privato.invia_email(privato.staff_email(),
    'Nuova iscrizione: ' || coalesce(d->>'nomePg', '') || ' a ' || coalesce(ev, 'evento'),
    'Nuova iscrizione',
    '<p><b>' || privato.h(coalesce(ev, '')) || '</b></p>'
    || '<p>Giocatore: ' || privato.h(coalesce(d->>'nome', '') || ' ' || coalesce(d->>'cognome', ''))
    || '<br>Personaggio: ' || privato.h(coalesce(d->>'nomePg', ''))
    || '<br>Email: ' || privato.h(coalesce(d->>'email', ''))
    || '<br>Nuovo giocatore: ' || case when (d->>'nuovoGiocatore')::boolean then 'Sì' else 'No' end
    || '<br>Associazione: ' || case when (d->>'associato')::boolean then 'Associato' else 'Non ancora associato' end
    || '<br>Biglietto: ' || privato.h(coalesce(d->>'biglietto', ''))
    || '<br>Pernotto extra venerdì: ' || case when (d->>'pernottoVenerdi')::boolean then 'Sì' else 'No' end
    || '<br>Pernotto extra domenica: ' || case when (d->>'pernottoDomenica')::boolean then 'Sì' else 'No' end
    || '<br>Pasti: ' || coalesce(nullif(concat_ws(', ',
         case when coalesce((d->>'cenaVenerdi')::boolean, false) then 'cena del venerdì' end,
         case when coalesce((d->>'pranzoSabato')::boolean, false) then 'pranzo del sabato' end,
         case when coalesce((d->>'cenaDomenica')::boolean, false) then 'cena della domenica' end), ''), 'nessuno')
    || '<br>Pagamento: ' || privato.h(coalesce(d->>'pagamento', '')) || '</p>'
    || case when coalesce(d->>'note', '') <> '' then '<p>Note: ' || privato.h(d->>'note') || '</p>' else '' end);
  return new;
end $$;

drop trigger if exists avviso_iscrizione on public.iscrizioni;
create trigger avviso_iscrizione after insert on public.iscrizioni
  for each row execute function privato.avviso_iscrizione();

-- =====================================================================
-- ULTIMO PASSO: inserisci chiave Brevo e mittente (sostituisci i valori tra apici ed esegui).
-- Il mittente deve essere un indirizzo verificato su Brevo.
-- update privato.email_config set
--   brevo_api_key = 'xkeysib-...',
--   mittente_email = 'indirizzo-verificato@esempio.it',
--   mittente_nome = 'Grayvent Live';
--
-- Per cambiare in futuro l'indirizzo che riceve gli avvisi dello staff:
-- update privato.email_config set staff_email = 'nuovo-indirizzo@esempio.it';
-- =====================================================================
