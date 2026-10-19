import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); p.on('console', (m) => errs.push(m.type() + ' ' + m.text()));
await p.goto(process.argv[2]); await p.waitForTimeout(1500);
console.log(await p.evaluate(() => document.getElementById('root')?.innerText.slice(0, 300)));
console.log(errs);
await b.close();
