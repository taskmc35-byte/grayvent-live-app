/*
 * Alcuni browser (es. Opera con "Forza pagine scure") schiariscono da soli i testi scuri anche sulle pergamene chiare,
 * che così diventano illeggibili: il colore viene cambiato al momento del disegno e nessuna regola CSS lo impedisce.
 * Il browser però non tocca le immagini di sfondo: qui i testi scuri delle pergamene vengono disegnati come
 * "sfondo ritagliato sulle lettere", nello stesso identico colore. A occhio non cambia nulla; con le pagine scure
 * forzate restano scuri e leggibili.
 */
// Con le pagine scure forzate, queste pergamene (con il foglio sotto e il nastro) restano chiare mentre i testi
// vengono schiariti: sono le uniche da correggere. Le altre superfici chiare vengono scurite insieme ai testi e si leggono già.
const CONTENITORI = '.race-card, .ev-card.big, .letter, .stato-card';
const SALTA = 'button.btn, .btn, input, textarea, select, option, .pill, .tag-x, .chip, .fonte, .seg, svg, .ev-bollo, .sev-stato, .esito-btns';
const TESTO = 'p, dd, dt, h1, h2, h3, h4, strong, b, em, i, small, span, li, label, a, div, legend, summary, td, th';

const trasparente = (c: string) => c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);

function haTesto(el: Element) {
  for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent && n.textContent.trim()) return true;
  return false;
}

function scuro(colore: string) {
  const m = colore.match(/\d+(\.\d+)?/g);
  if (!m) return false;
  const [r, g, b] = m.map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 150; // solo i testi scuri vengono "invertiti" dal browser
}

/** la prima superficie con un fondo proprio sotto al testo deve essere una delle pergamene che restano chiare */
function suPergamena(el: HTMLElement) {
  for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.backgroundImage !== 'none' || !trasparente(cs.backgroundColor)) return n.matches(CONTENITORI);
  }
  return false;
}

function marca(el: HTMLElement) {
  // già sistemato: ricontrollo solo se nel frattempo gli è cambiata la classe (es. una voce evidenziata)
  if (el.classList.contains('gv-ink') && el.dataset.gvCls === el.className) return;
  el.classList.remove('gv-ink');
  const cs = getComputedStyle(el);
  if (cs.backgroundImage !== 'none' || !trasparente(cs.backgroundColor) || !scuro(cs.color) || !suPergamena(el)) return;
  el.style.setProperty('--gv-ink', cs.color);
  el.classList.add('gv-ink');
  el.dataset.gvCls = el.className;
}

function passa(radice: ParentNode) {
  radice.querySelectorAll<HTMLElement>(`:is(${CONTENITORI}) :is(${TESTO}), :is(${CONTENITORI}):is(${TESTO})`).forEach((el) => {
    if (!haTesto(el) || el.closest(SALTA)) return;
    marca(el);
  });
}

export function avviaInchiostro() {
  if (typeof window === 'undefined' || !('MutationObserver' in window)) return;
  // la modalità scura forzata esiste solo nei browser basati su Chromium
  if (!/Chrome|Chromium|OPR|Edg/.test(navigator.userAgent)) return;
  let attesa = 0;
  const pianifica = () => { if (!attesa) attesa = requestAnimationFrame(() => { attesa = 0; passa(document); }); };
  new MutationObserver(pianifica).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  pianifica();
}
