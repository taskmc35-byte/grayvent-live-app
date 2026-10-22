/** Riduce una foto (anche di molti MB, dal telefono) a una larghezza adatta al banner, in JPEG */
export async function ridimensiona(file: File, maxW = 1600, qualita = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i); i.onerror = () => ko(new Error('Immagine non leggibile: usa un file JPG o PNG.'));
      i.src = url;
    });
    const k = Math.min(1, maxW / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#2b2724'; ctx.fillRect(0, 0, c.width, c.height); // sfondo per le PNG trasparenti
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('Conversione non riuscita.'))), 'image/jpeg', qualita));
  } finally { URL.revokeObjectURL(url); }
}

export const blobToDataUrl = (b: Blob) => new Promise<string>((ok, ko) => {
  const r = new FileReader(); r.onload = () => ok(r.result as string); r.onerror = () => ko(r.error); r.readAsDataURL(b);
});

/** Foto del personaggio: ritaglio quadrato al centro, piccola (circa 20-40 KB), pronta da salvare nella scheda */
export async function fotoQuadrata(file: File, lato = 360, qualita = 0.8): Promise<string> {
  const img = await createImageBitmap(file).catch(() => { throw new Error('Immagine non leggibile: usa un file JPG o PNG.'); });
  const s = Math.min(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = c.height = Math.min(lato, s);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2b2724'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', qualita);
}
