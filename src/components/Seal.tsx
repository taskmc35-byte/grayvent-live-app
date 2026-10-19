import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Sigillo di ceralacca che compare per un attimo dopo un'azione importante */
export function Seal({ label, onDone }: { label: string; onDone: () => void }) {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setOut(true), 1300);
    const b = setTimeout(onDone, 1650);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onDone]);
  return createPortal(
    <div className={`seal-overlay${out ? ' out' : ''}`} role="status" aria-live="polite">
      <div className="seal">
        <div className="seal-disc" aria-hidden="true">
          <svg viewBox="0 0 100 100" fill="none" stroke="#3d0608" strokeWidth="3">
            <polygon points="50,6 84,22 94,58 72,90 28,90 6,58 16,22" />
            <rect x="26" y="26" width="48" height="48" />
            <rect x="26" y="26" width="48" height="48" transform="rotate(45 50 50)" />
            <path d="M40 46 L60 46 L50 62 Z" />
          </svg>
        </div>
        <span className="seal-label">{label}</span>
      </div>
    </div>,
    document.body,
  );
}
