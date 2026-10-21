import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChiediTab } from './ChiediTab';
import { ApriManuale, useManuali } from './ManualiTab';
import type { FonteManuale } from '../data/types';
import { useIndietro } from '../indietro';

export const APRI_CHAT = 'grayvent:apri-chat';
export const apriChat = () => window.dispatchEvent(new Event(APRI_CHAT));

/** Pulsante sempre visibile che apre il chatbot dei manuali in un pannello, da qualsiasi pagina */
export function ChatPopup() {
  const [aperto, setAperto] = useState(false);
  const [fonte, setFonte] = useState<FonteManuale | null>(null);
  const { list: manuali } = useManuali();
  useIndietro(aperto, () => setAperto(false));
  const manualeFonte = fonte && (manuali.find((m) => m.id === fonte.manuale) ?? { id: fonte.manuale, nome: fonte.titolo, descrizione: '', sigla: '', ordine: 0, nascosto: false, base: true });

  // si può aprire anche da un pulsante in pagina (es. Manuali)
  useEffect(() => {
    const apri = () => setAperto(true);
    window.addEventListener(APRI_CHAT, apri);
    return () => window.removeEventListener(APRI_CHAT, apri);
  }, []);

  useEffect(() => {
    if (!aperto) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !fonte && setAperto(false);
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [aperto, fonte]);

  return createPortal(
    <>
      {!aperto && (
        <button className="chat-fab" onClick={() => setAperto(true)} aria-label="Chiedi ai manuali">
          <span className="fab-q" aria-hidden="true">?</span>
        </button>
      )}
      {aperto && (
        <div className="chat-overlay" onClick={() => setAperto(false)}>
          <div className="chat-panel" role="dialog" aria-modal="true" aria-label="Chiedi ai manuali" onClick={(e) => e.stopPropagation()}>
            <header className="chat-head">
              <div className="chat-head-tit">
                <span className="chat-sigillo" aria-hidden="true">?</span>
                <div><h2>Chiedi ai manuali</h2><span className="hint">Risposte con manuale e pagina</span></div>
              </div>
              <button className="icon-btn" onClick={() => setAperto(false)} aria-label="Chiudi la chat">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </header>
            <div className="chat-body">
              <ChiediTab onApri={setFonte} />
            </div>
          </div>
        </div>
      )}
      {fonte && manualeFonte && <ApriManuale m={manualeFonte} pagina={fonte.pagina} onClose={() => setFonte(null)} />}
    </>,
    document.body,
  );
}
