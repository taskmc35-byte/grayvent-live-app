/**
 * Salva un file generato dall'app.
 * Nell'anteprima pubblicata su claude.ai passa dalla conferma di salvataggio della piattaforma;
 * sul sito vero usa il normale download del browser.
 */
type Downloads = { save: (r: { filename: string; data: Blob }) => Promise<unknown> };
type ClaudeHost = { use?: (name: string) => Promise<unknown> };

export async function salvaFile(filename: string, blob: Blob) {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (host?.use) {
    const dl = (await host.use('downloads').catch(() => null)) as Downloads | null;
    if (dl) {
      try { await dl.save({ filename, data: blob }); return; }
      catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'declined') return; // il viewer ha detto no: nessun errore
        if (code !== 'unavailable' && code !== 'not_granted') throw new Error((e as Error).message || code || 'salvataggio non riuscito');
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
