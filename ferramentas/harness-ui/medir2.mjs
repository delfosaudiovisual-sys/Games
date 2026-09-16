import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const VIEWS = [
  ['retrato-390', 390, 844, 7, 0],
  ['retrato-390-folha', 390, 844, 7, 1],
  ['retrato-360-folha', 360, 640, 7, 1],
  ['paisagem-844', 844, 390, 7, 0],
  ['paisagem-844-folha', 844, 390, 7, 1],
  ['desktop-1440-folha', 1440, 900, 7, 1],
]
for (const [nome, w, h, n, folha] of VIEWS) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto(`http://127.0.0.1:8732/ui/layout2.html?n=${n}&folha=${folha}`)
  await p.waitForFunction('window.__ready === true', { timeout: 10000 })
  await p.waitForTimeout(400) // deixa a animacao da folha terminar
  console.log(nome.padEnd(20), JSON.stringify(await p.evaluate('window.__medida()')), errs.join('|'))
  await p.screenshot({ path: `u2-${nome}.png` })
  await p.close()
}
await b.close()
