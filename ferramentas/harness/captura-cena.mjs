import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const p = await b.newPage({ viewport: { width: 1080, height: 900 }, deviceScaleFactor: 1.6 })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
await p.goto('http://127.0.0.1:8732/cena.html')
await p.waitForFunction('window.__ready === true', { timeout: 15000 }).catch(() => errs.push('TIMEOUT'))
await p.waitForTimeout(800)
const secs = await p.locator('h2').all()
for (let i = 0; i < secs.length; i++) {
  const nome = ['ato1','ato2','ato3'][i]
  await p.locator('.linha').nth(i).screenshot({ path: `/tmp/claude-0/-home-user-Games/5eb10c1a-37e3-5a34-9c72-33d702a6bda8/scratchpad/work/cena-${nome}.png` })
  console.log(nome, await secs[i].innerText())
}
console.log(errs.length ? 'ERROS: ' + errs.join(' | ') : 'sem erros')
await b.close()
