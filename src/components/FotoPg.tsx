import { useRef, useState } from 'react';
import type { Character } from '../data/types';
import { fotoQuadrata } from '../immagine';

/** Volto del personaggio (o le iniziali se non c'è la foto) */
export function FotoPg({ c, size = 44, onClick, label }: { c: Pick<Character, 'nome' | 'cognome' | 'foto'>; size?: number; onClick?: () => void; label?: string }) {
  const iniziali = `${c.nome?.[0] ?? ''}${c.cognome?.[0] ?? ''}`.toUpperCase() || '?';
  const contenuto = c.foto ? <img src={c.foto} alt="" /> : <span aria-hidden="true">{iniziali}</span>;
  const stile = { width: size, height: size, fontSize: size * 0.38 };
  if (onClick) return <button type="button" className="foto-pg" style={stile} onClick={onClick} aria-label={label ?? 'Foto del personaggio'}>{contenuto}</button>;
  return <span className="foto-pg" style={stile} role={c.foto ? 'img' : undefined} aria-label={c.foto ? `Foto di ${c.nome}` : undefined}>{contenuto}</span>;
}

/** Scatta o scegli la foto del personaggio, oppure toglila */
export function CampoFoto({ c, onChange, nota }: { c: Pick<Character, 'nome' | 'cognome' | 'foto'>; onChange: (foto: string | undefined) => Promise<void> | void; nota?: string }) {
  const scatta = useRef<HTMLInputElement>(null);
  const galleria = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const scegli = async (f?: File) => {
    if (!f) return;
    setBusy(true); setErr('');
    try { await onChange(await fotoQuadrata(f)); } catch (e) { setErr((e as Error).message); } finally {
      setBusy(false);
      if (scatta.current) scatta.current.value = '';
      if (galleria.current) galleria.current.value = '';
    }
  };
  return (
    <div className="campo-foto">
      <FotoPg c={c} size={84} />
      <div className="campo-foto-azioni">
        <span className="campo-foto-tit">Foto del personaggio</span>
        <div className="campo-foto-btn">
          <button type="button" className="btn ghost" disabled={busy} onClick={() => scatta.current?.click()}>Scatta</button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => galleria.current?.click()}>Scegli</button>
          {c.foto && <button type="button" className="link" disabled={busy} onClick={async () => { setBusy(true); try { await onChange(undefined); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }}>Togli</button>}
        </div>
        <span className="hint">{busy ? 'Salvataggio…' : nota ?? 'Il volto del personaggio, per riconoscerlo al volo.'}</span>
        {err && <span className="error">{err}</span>}
      </div>
      <input ref={scatta} type="file" accept="image/*" capture="user" hidden onChange={(e) => scegli(e.target.files?.[0])} />
      <input ref={galleria} type="file" accept="image/*" hidden onChange={(e) => scegli(e.target.files?.[0])} />
    </div>
  );
}
