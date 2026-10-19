import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const svg = readFileSync('public/icon.svg', 'utf8');
for (const s of [192, 512]) {
  const p = await b.newPage({ viewport: { width: s, height: s } });
  await p.setContent(`<style>*{margin:0}</style>${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}`);
  await p.screenshot({ path: `public/icon-${s}.png`, omitBackground: true });
}
await b.close();
