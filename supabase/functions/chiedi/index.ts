// Grayvent Live App — Edge Function "chiedi"
// Fa arrivare all'app la risposta del chatbot parola per parola, mentre Gemini la scrive.
// Il database fa i controlli (utente, limite giornaliero) e la ricerca nei manuali; qui si chiama solo Gemini.
//
// Risposta all'app: una riga JSON per evento
//   {"tipo":"fonti","fonti":[...],"rimaste":n}   {"tipo":"testo","t":"..."}   {"tipo":"fine"}   {"tipo":"errore","messaggio":"..."}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Env = { url: string; anon: string; service: string };

async function rpc(env: Env, nome: string, body: unknown, auth: string, apikey: string) {
  const r = await fetch(`${env.url}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey, Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const testo = await r.text();
  if (!r.ok) {
    let msg = testo;
    try { msg = JSON.parse(testo).message ?? testo; } catch { /* testo semplice */ }
    throw new Error(msg);
  }
  return testo ? JSON.parse(testo) : null;
}

const MSG: Record<number, string> = {
  404: 'Il modello di Gemini impostato non è disponibile: lo staff deve aggiornare il nome del modello.',
  429: 'Il chatbot ha ricevuto troppe domande in poco tempo. Riprova tra qualche minuto.',
  500: 'Il servizio di intelligenza artificiale è sovraccarico in questo momento. Riprova tra qualche minuto.',
};
const messaggioErrore = (s: number) => MSG[s] ?? (s >= 500 ? MSG[500] : `Il chatbot al momento non risponde (errore ${s}). Riprova più tardi.`);

export async function handler(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const auth = req.headers.get('Authorization') ?? '';
  const enc = new TextEncoder();
  const inizio = Date.now();

  let corpo: { domanda?: string; storia?: unknown };
  try { corpo = await req.json(); } catch { corpo = {}; }

  const stream = new ReadableStream({
    async start(ctrl) {
      const invia = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + '\n'));
      try {
        // 1) controlli e ricerca nei manuali, come l'utente collegato
        const prep = await rpc(env, 'prepara_domanda', { p_domanda: corpo.domanda ?? '', p_storia: corpo.storia ?? [] }, auth, env.anon);
        // 2) chiave di Gemini, solo con la chiave di servizio
        const chiave: string = await rpc(env, 'ai_chiave', {}, `Bearer ${env.service}`, env.service);
        invia({ tipo: 'fonti', fonti: prep.fonti ?? [], rimaste: prep.rimaste });

        // 3) Gemini in streaming: modello principale, poi la riserva se è occupato
        let res: Response | null = null;
        let modello = '';
        for (const m of prep.modelli as string[]) {
          modello = m;
          res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse`, {
            method: 'POST',
            headers: { 'x-goog-api-key': chiave, 'Content-Type': 'application/json' },
            body: JSON.stringify(prep.richiesta),
          });
          if (res.ok || ![404, 429, 500, 502, 503, 504].includes(res.status)) break;
          await res.body?.cancel();
        }
        if (!res || !res.ok || !res.body) throw new Error(messaggioErrore(res?.status ?? 500));

        // 4) inoltra i pezzi di testo man mano che arrivano (saltando i "pensieri" del modello)
        let risposta = '';
        let buf = '';
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const riga = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!riga.startsWith('data:')) continue;
            try {
              const j = JSON.parse(riga.slice(5));
              for (const p of j?.candidates?.[0]?.content?.parts ?? []) {
                if (p.text && !p.thought) { risposta += p.text; invia({ tipo: 'testo', t: p.text }); }
              }
            } catch { /* riga incompleta */ }
          }
        }
        if (!risposta.trim()) {
          risposta = 'Non sono riuscito a formulare una risposta. Prova a riformulare la domanda oppure contatta lo staff.';
          invia({ tipo: 'testo', t: risposta });
        }
        // 5) registra la risposta (conta per il limite giornaliero)
        await rpc(env, 'registra_risposta', { p_domanda: prep.domanda, p_risposta: risposta, p_durata_ms: Date.now() - inizio, p_modello: modello }, auth, env.anon)
          .catch(() => { /* la risposta è già arrivata: un errore di registrazione non deve bloccarla */ });
        invia({ tipo: 'fine' });
      } catch (e) {
        invia({ tipo: 'errore', messaggio: (e as Error).message || 'Errore imprevisto.' });
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(stream, { headers: { ...CORS, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache' } });
}

// Avvio su Supabase (Deno). Le variabili SUPABASE_* sono fornite da Supabase in automatico.
// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D) {
  const env: Env = {
    url: D.env.get('SUPABASE_URL') ?? '',
    anon: D.env.get('SUPABASE_ANON_KEY') ?? '',
    service: D.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  };
  D.serve((req: Request) => handler(req, env));
}
