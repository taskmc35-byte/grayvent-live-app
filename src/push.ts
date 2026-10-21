import { api } from './api';

/*
 * Notifiche push sul telefono. Funzionano su Android (app installata o Chrome) e sui computer;
 * su iPhone/iPad solo con l'app aggiunta alla schermata Home (iOS 16.4 o più recente).
 */
export type StatoPush = 'attive' | 'spente' | 'bloccate' | 'non-supportate' | 'ios-home' | 'prova';

const iOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const daHome = () => matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const supportate = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function registrazione(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return navigator.serviceWorker.ready;
}

export async function statoPush(): Promise<StatoPush> {
  if (api.demo) return 'prova';
  if (!supportate()) return iOS() && !daHome() ? 'ios-home' : 'non-supportate';
  if (Notification.permission === 'denied') return 'bloccate';
  const reg = await registrazione();
  if (!reg) return 'non-supportate';
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'attive' : 'spente';
}

const chiaveBinaria = (b64: string) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

export async function attivaPush(): Promise<void> {
  const permesso = await Notification.requestPermission();
  if (permesso !== 'granted') throw new Error(permesso === 'denied'
    ? 'Notifiche bloccate: riattivale dalle impostazioni del telefono o del browser per questo sito.'
    : 'Permesso non concesso.');
  const reg = await registrazione();
  if (!reg) throw new Error('Le notifiche funzionano solo nell’app installata o sul sito, non in questa anteprima.');
  const chiave = await api.pushChiave();
  if (!chiave) throw new Error('Notifiche non disponibili.');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveBinaria(chiave) });
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await api.pushIscrivi(j.endpoint, j.keys.p256dh, j.keys.auth);
}

export async function disattivaPush(): Promise<void> {
  const reg = await registrazione();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.pushDisiscrivi(sub.endpoint).catch(() => {});
  await sub.unsubscribe();
}

/** All'accesso: se il telefono era già iscritto, riallinea l'iscrizione all'utente collegato (es. telefono condiviso) */
export async function riallineaPush() {
  try { if ((await statoPush()) === 'attive') await attivaPush(); } catch { /* niente */ }
}
