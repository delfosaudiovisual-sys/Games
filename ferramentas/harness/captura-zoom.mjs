import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const p = await b.newPage({ viewport: { width: 2100, height: 950 }, deviceScaleFactor: 1 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
await p.goto('http://127.0.0.1:8732/harness/zoom.html')
await p.waitForFunction('window.__ready === true', { timeout: 15000 }).catch(() => errs.push('TIMEOUT'))
await p.waitForTimeout(600)
for (const id of ['p-fit', 'p-max', 'l-fit']) {
  console.log(id, await p.locator(`#${id}-t`).innerText())
}
await p.screenshot({ path: 'zoom-prova.png' })
console.log(errs.length ? 'ERROS: ' + errs.join(' | ') : 'sem erros')
await b.close()
