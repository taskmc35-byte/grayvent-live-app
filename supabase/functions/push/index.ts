// Grayvent Live App — Edge Function "push"
// Manda le notifiche push ai telefoni (Web Push standard, senza servizi esterni).
//   {"azione":"inizializza"}      crea le chiavi VAPID al primo uso e restituisce la chiave pubblica
//   {"azione":"invia","id":"..."}  invia la notifica in coda con quell'id (la chiama il database)
// Le chiavi restano nel database (schema privato): non passano mai dall'app né dalla chat.
// Da pubblicare con "Verify JWT" disattivato: la chiama il database, che non ha un utente collegato.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Env = { url: string; service: string };
type Chiavi = { pubblica: string; privata: JsonWebKey; soggetto: string };

const enc = new TextEncoder();
export const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const deb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const unisci = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };

async function hmac(chiave: Uint8Array, dati: Uint8Array) {
  const k = await crypto.subtle.importKey('raw', chiave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, dati));
}

/** Cifratura del messaggio per un abbonamento (RFC 8291, aes128gcm) */
export async function cifra(p256dh: string, auth: string, testo: Uint8Array, salt = crypto.getRandomValues(new Uint8Array(16)), locale?: CryptoKeyPair) {
  const uaPub = deb64u(p256dh), segreto = deb64u(auth);
  const kp = locale ?? await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const condiviso = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, kp.privateKey, 256));
  const prkKey = await hmac(segreto, condiviso);
  const ikm = await hmac(prkKey, unisci(enc.encode('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, unisci(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, unisci(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrato = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, unisci(testo, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return unisci(salt, rs, new Uint8Array([asPub.length]), asPub, cifrato);
}

/** Intestazione VAPID: dimostra al servizio push che il messaggio arriva da noi */
export async function vapid(endpoint: string, c: Chiavi) {
  const aud = new URL(endpoint).origin;
  const testa = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corpo = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: c.soggetto })));
  const k = await crypto.subtle.importKey('jwk', c.privata, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const firma = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, enc.encode(`${testa}.${corpo}`)));
  return `vapid t=${testa}.${corpo}.${b64u(firma)}, k=${c.pubblica}`;
}

export async function nuoveChiavi(soggetto: string): Promise<Chiavi> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const pubblica = b64u(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)));
  const privata = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { pubblica, privata, soggetto };
}

async function rest(env: Env, percorso: string, init: RequestInit = {}) {
  const r = await fetch(`${env.url}/rest/v1/${percorso}`, {
    ...init,
    headers: { apikey: env.service, Authorization: `Bearer ${env.service}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t);
  return t ? JSON.parse(t) : null;
}
const rpc = (env: Env, nome: string, body: unknown = {}) => rest(env, `rpc/${nome}`, { method: 'POST', body: JSON.stringify(body) });

async function chiavi(env: Env): Promise<Chiavi> {
  const c = await rpc(env, 'push_config_leggi');
  if (c?.pubblica && c?.privata) return c as Chiavi;
  const nuove = await nuoveChiavi(c?.soggetto || 'mailto:info@grayvent.it');
  await rpc(env, 'push_config_salva', { p_pubblica: nuove.pubblica, p_privata: nuove.privata });
  return nuove;
}

async function invia(env: Env, id: string) {
  const [n] = await rest(env, `notifiche_push?id=eq.${encodeURIComponent(id)}&select=*`);
  if (!n || n.inviata_il) return { inviate: 0 };
  const c = await chiavi(env);
  const subs = n.utenti?.length
    ? await rest(env, `push_iscrizioni?utente=in.(${n.utenti.join(',')})&select=id,endpoint,p256dh,auth`)
    : [];
  const testo = enc.encode(JSON.stringify({ titolo: n.titolo, testo: n.testo, url: n.url || './' }));
  let inviate = 0;
  for (const s of subs) {
    try {
      const r = await fetch(s.endpoint, {
        method: 'POST',
        headers: { Authorization: await vapid(s.endpoint, c), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal' },
        body: await cifra(s.p256dh, s.auth, testo),
      });
      if (r.status === 404 || r.status === 410) await rest(env, `push_iscrizioni?id=eq.${s.id}`, { method: 'DELETE' }); // telefono non più iscritto
      else if (r.ok) inviate++;
      await r.body?.cancel();
    } catch { /* un telefono irraggiungibile non deve fermare gli altri */ }
  }
  await rest(env, `notifiche_push?id=eq.${n.id}`, { method: 'PATCH', body: JSON.stringify({ inviata_il: new Date().toISOString(), inviate }) });
  return { inviate };
}

export async function handler(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const risposta = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
  try {
    const b = await req.json().catch(() => ({}));
    if (b.azione === 'inizializza') return risposta({ pubblica: (await chiavi(env)).pubblica });
    if (b.azione === 'invia' && b.id) return risposta(await invia(env, String(b.id)));
    return risposta({ errore: 'Azione non valida' }, 400);
  } catch (e) {
    return risposta({ errore: (e as Error).message }, 500);
  }
}

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D) {
  const env: Env = { url: D.env.get('SUPABASE_URL') ?? '', service: D.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' };
  D.serve((req: Request) => handler(req, env));
}
