import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const logo = 'data:image/png;base64,' + readFileSync('public/brand/logo-ink.png').toString('base64');
for (const s of [192, 512]) {
  const p = await b.newPage({ viewport: { width: s, height: s } });
  await p.setContent(`<style>*{margin:0}body{width:${s}px;height:${s}px;display:grid;place-items:center;background:radial-gradient(circle at 35% 25%,#f1e7d1,#e2d3b4 60%,#cdb993)}img{width:86%}</style><img src="${logo}">`);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `public/icon-${s}.png` });
}
await b.close();
