import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const p = await b.newPage({ viewport: { width: 1260, height: 1000 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto('http://127.0.0.1:8732/index.html')
await p.waitForFunction('window.__ready === true', { timeout: 15000 }).catch(() => errs.push('TIMEOUT: __ready nunca ficou true'))
await p.waitForTimeout(1200)
for (const id of ['play','first','build','towers','enemies','mobile','sil']) {
  await p.locator('#' + id).screenshot({ path: `/tmp/claude-0/-home-user-Games/5eb10c1a-37e3-5a34-9c72-33d702a6bda8/scratchpad/work/out-${id}.png` })
}
console.log(errs.length ? 'ERROS:\n' + errs.join('\n') : 'sem erros de página')
await b.close()
