import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const VIEWS = [
  ['retrato-390', 390, 844, 7],
  ['retrato-360', 360, 640, 7],
  ['retrato-inicio', 390, 844, 2],
  ['paisagem-844', 844, 390, 7],
  ['tablet-820', 820, 1180, 7],
  ['desktop-1440', 1440, 900, 7],
]
for (const [nome, w, h, n] of VIEWS) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto(`http://127.0.0.1:8732/ui/layout.html?n=${n}`)
  await p.waitForFunction('window.__ready === true', { timeout: 10000 })
  const m = await p.evaluate('window.__medida()')
  console.log(nome.padEnd(16), JSON.stringify(m), errs.length ? 'ERROS:' + errs.join('|') : '')
  await p.screenshot({ path: `ui-${nome}.png` })
  await p.close()
}
await b.close()
