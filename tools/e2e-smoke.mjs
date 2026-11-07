// End-to-end smoke test of the shell against a built app, driven over the
// Chrome DevTools Protocol. No dependencies beyond Node 22 and a Chromium.
//
//   npm run build
//   npx vite preview --port 4174 --strictPort &
//   chromium --headless=new --disable-gpu --remote-debugging-port=9223 \
//            --user-data-dir=/tmp/riddles-e2e about:blank &
//   node tools/e2e-smoke.mjs http://localhost:4174/riddles/ 9223
//
// Clears localStorage of the preview origin. Closes the browser when done.
const BASE = process.argv[2] ?? 'http://localhost:4173/riddles/'
const PORT = process.argv[3] ?? '9223'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return new Cdp(page.webSocketDebuggerUrl)
    } catch {}
    await sleep(200)
  }
  throw new Error('no debug target')
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.id = 0
    this.pending = new Map()
    this.ready = new Promise((res) => (this.ws.onopen = res))
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.method === 'Runtime.exceptionThrown') console.log('PAGE EXCEPTION', msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
      if (msg.method === 'Runtime.consoleAPICalled' && ['error','warning'].includes(msg.params.type)) console.log('PAGE CONSOLE', msg.params.type, msg.params.args.map(a => a.value ?? a.description).join(' '))
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
      }
    }
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text))
    return r.result.value
  }
  async waitFor(expr, timeout = 10000) {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      if (await this.eval(`!!(${expr})`)) return
      await sleep(100)
    }
    throw new Error('timeout waiting for ' + expr)
  }
  async navigate(url) {
    await this.send('Page.navigate', { url })
    await this.waitFor(`document.readyState === 'complete' && document.querySelector('main')`)
    await sleep(300)
  }
  async click(selector, text) {
    const ok = await this.eval(`(() => {
      const els = [...document.querySelectorAll(${JSON.stringify(selector)})]
      const el = ${text ? `els.find(e => e.textContent.trim().startsWith(${JSON.stringify(text)}))` : 'els[0]'}
      if (!el) return false
      el.click(); return true })()`)
    if (!ok) throw new Error(`no element ${selector} ${text ?? ''}`)
    await sleep(200)
  }
  text() {
    return this.eval('document.body.innerText')
  }
}

const results = []
function check(name, cond, extra = '') {
  results.push([cond ? 'PASS' : 'FAIL', name, extra])
  console.log(cond ? 'PASS' : 'FAIL', name, extra)
  if (!cond) process.exitCode = 1
}

const cdp = await connect()
await cdp.ready
await cdp.send('Page.enable')
await cdp.send('Runtime.enable')
process.on('uncaughtException', async (e) => {
  console.log('SCRIPT ERROR', e.message)
  try { console.log('PAGE TEXT:\n' + (await cdp.text())) } catch {}
  await shutdown(1)
})
async function shutdown(code) {
  try {
    const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
    const b = new Cdp(v.webSocketDebuggerUrl); await b.ready; await b.send('Browser.close')
  } catch {}
  process.exit(code)
}
await cdp.navigate(BASE)
await cdp.eval('localStorage.clear()')
await cdp.navigate(BASE)

let t = await cdp.text()
check('menu renders', t.includes('Riddles') && t.includes('New · 4×4 · Easy'), t.split('\n')[0])
check('no continue initially', !t.includes('Continue ·'))

// Difficulty choice is remembered
await cdp.click('section[aria-label="Counts"] .segmented button', 'Hard')
check('difficulty selectable', (await cdp.text()).includes('New · 4×4 · Hard'))
await cdp.navigate(BASE)
check('difficulty remembered after reload', (await cdp.text()).includes('New · 4×4 · Hard'))
await cdp.click('section[aria-label="Counts"] .segmented button', 'Easy')

// New game via worker
await cdp.click('section[aria-label="Counts"] button', 'New ·')
await cdp.waitFor(`document.querySelector('.counts .cell')`)
const game1 = await cdp.eval(`JSON.parse(localStorage.getItem('riddles.v1.game.counts'))`)
check('game saved with solution', Array.isArray(game1.solution) && game1.solution.length === 16, 'seed ' + game1.seed)
check('header shows seed', (await cdp.text()).includes('Seed ' + game1.seed))

// Wrong cell -> mistakes; undo -> ok
const wrong = game1.solution.indexOf(0)
await cdp.eval(`document.querySelectorAll('.counts .cell')[${wrong}].click()`)
await cdp.click('button', 'Check')
check('check reports mistakes', (await cdp.text()).includes('Contains mistakes.'))
await cdp.click('button', 'Undo')
await cdp.click('button', 'Check')
check('undo then check ok', (await cdp.text()).includes('Correct so far.'))
check('undo disabled after use', await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.trim()==='Undo').disabled`))

// Pencil mark then erase
await cdp.click('button', 'Pencil')
await cdp.eval(`document.querySelectorAll('.counts .cell')[0].click()`)
check('pencil dot drawn', await cdp.eval(`!!document.querySelector('.counts .cell .dot')`))
await cdp.click('button', 'Eraser')
await cdp.eval(`document.querySelectorAll('.counts .cell')[0].click()`)
check('eraser removes dot', await cdp.eval(`!document.querySelector('.counts .cell .dot')`))
await cdp.click('button', 'Eraser') // back to pen

// Fill two correct cells, reload, continue, state restored
const correct = game1.solution.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)
await cdp.eval(`document.querySelectorAll('.counts .cell')[${correct[0]}].click()`)
await cdp.eval(`document.querySelectorAll('.counts .cell')[${correct[1]}].click()`)
await cdp.navigate(BASE)
t = await cdp.text()
check('menu shows continue', t.includes('Continue · 4×4 · Easy · ' + game1.seed))
await cdp.click('section[aria-label="Counts"] button', 'Continue')
await cdp.waitFor(`document.querySelector('.counts .cell')`)
check('resume restores two filled cells', (await cdp.eval(`document.querySelectorAll('.counts .cell.filled').length`)) === 2)
check('resume restores undo snapshot', !(await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.trim()==='Undo').disabled`)))

// Back gesture returns to menu
await cdp.eval('history.back()')
await sleep(300)
check('history back returns to menu', (await cdp.text()).includes('Continue ·'))

// Discard confirm
await cdp.click('section[aria-label="Counts"] button', 'New ·')
check('inline discard prompt', (await cdp.text()).includes('Discard the current game?'))
await cdp.click('section[aria-label="Counts"] button', 'Keep')
check('keep keeps game', (await cdp.text()).includes('Continue ·'))

// Solve it
await cdp.click('section[aria-label="Counts"] button', 'Continue')
await cdp.waitFor(`document.querySelector('.counts .cell')`)
for (const i of correct.slice(2)) await cdp.eval(`document.querySelectorAll('.counts .cell')[${i}].click()`)
await cdp.click('button', 'Check')
t = await cdp.text()
check('solved screen', t.includes('Solved') && t.includes('New puzzle'))
check('saved game cleared', (await cdp.eval(`localStorage.getItem('riddles.v1.game.counts')`)) === null)
await cdp.click('button', 'Back to menu')
await sleep(300)
check('menu has no continue after solve', !(await cdp.text()).includes('Continue ·'))

// Seed reproducibility
async function newWithSeed(seed) {
  await cdp.eval(`(() => { const i = document.querySelector('input[type=text]'); i.value = ${JSON.stringify(seed)}; i.dispatchEvent(new Event('input', {bubbles:true})) })()`)
  await sleep(200)
  await cdp.click('section[aria-label="Counts"] button', 'New ·')
  if (await cdp.eval(`[...document.querySelectorAll('section[aria-label="Counts"] button')].some(b => b.textContent.trim() === 'Discard')`)) {
    await cdp.click('section[aria-label="Counts"] button', 'Discard')
  }
  await cdp.waitFor(`document.querySelector('.counts .cell')`)
  const g = await cdp.eval(`JSON.parse(localStorage.getItem('riddles.v1.game.counts'))`)
  await cdp.eval('history.back()')
  await sleep(400)
  return g
}
const a = await newWithSeed('abc234')
const b = await newWithSeed('abc234')
check('seed normalised to uppercase', a.seed === 'ABC234')
check('same seed gives same puzzle', JSON.stringify(a.puzzle) === JSON.stringify(b.puzzle) && JSON.stringify(a.solution) === JSON.stringify(b.solution))
check('seed field cleared after use', (await cdp.eval(`document.querySelector('input[type=text]').value`)) === '')
check('menu history state normalised', (await cdp.eval(`history.state?.screen`)) === 'menu')


// ---- Sudoku ----
await cdp.navigate(BASE)
await cdp.click('section[aria-label="Sudoku"] button', 'New ·')
await cdp.waitFor(`document.querySelector('.sudoku .cell')`, 20000)
const sg = await cdp.eval(`JSON.parse(localStorage.getItem('riddles.v1.game.sudoku'))`)
check('sudoku saved with 81 givens and solution', sg.puzzle.givens.length === 81 && sg.solution.length === 81, 'seed ' + sg.seed)
check('sudoku renders givens', (await cdp.eval(`document.querySelectorAll('.sudoku .cell.given').length`)) > 20)
check('digit row disabled without selection', await cdp.eval(`document.querySelector('.sudoku .digit-row button').disabled`))
const empties = sg.puzzle.givens.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0)
const first = empties[0]
const clickCell = (i) => cdp.eval(`document.querySelectorAll('.sudoku .cell')[${i}].click()`)
const clickDigit = (d) => cdp.eval(`document.querySelectorAll('.sudoku .digit-row button')[${d - 1}].click()`)
const cellText = (i) => cdp.eval(`document.querySelectorAll('.sudoku .cell')[${i}].textContent.trim()`)
await clickCell(sg.puzzle.givens.findIndex((v) => v))
check('given cell cannot be selected', !(await cdp.eval(`!!document.querySelector('.sudoku .cell.selected')`)))
await clickCell(first)
check('cell selected', await cdp.eval(`document.querySelectorAll('.sudoku .cell')[${first}].classList.contains('selected')`))
await clickDigit(sg.solution[first] === 1 ? 2 : 1)
await cdp.click('button', 'Check')
check('sudoku wrong digit reports mistakes', (await cdp.text()).includes('Contains mistakes.'))
await cdp.click('button', 'Undo')
check('sudoku undo clears digit', (await cellText(first)) === '')
await cdp.click('button', 'Check')
check('sudoku after undo correct so far', (await cdp.text()).includes('Correct so far.'))
await cdp.click('button', 'Pencil')
await clickCell(first)
await clickDigit(3)
await sleep(100)
check('pencil mark rendered', (await cdp.eval(`document.querySelector('.sudoku .cell .marks')?.textContent.trim()`)) === '3')
await clickDigit(3)
await sleep(100)
check('pencil mark toggles off', !(await cdp.eval(`!!document.querySelector('.sudoku .cell .marks')`)))
await cdp.click('button', 'Pencil')
await clickCell(first)
await cdp.eval(`document.querySelector('.sudoku').dispatchEvent(new KeyboardEvent('keydown', { key: '${sg.solution[first]}', bubbles: true }))`)
await sleep(100)
check('keyboard digit entered', (await cellText(first)) === String(sg.solution[first]))
await cdp.click('button', 'Eraser')
await clickCell(first)
await sleep(100)
check('eraser clears a cell by tap', (await cellText(first)) === '')
check('digit row disabled in erase mode', await cdp.eval(`document.querySelector('.sudoku .digit-row button').disabled`))
await cdp.click('button', 'Eraser')
for (const i of empties) {
  await clickCell(i)
  await clickDigit(sg.solution[i])
}
await cdp.click('button', 'Check')
check('sudoku solved screen', (await cdp.text()).includes('Solved'))
check('sudoku saved game cleared', (await cdp.eval(`localStorage.getItem('riddles.v1.game.sudoku')`)) === null)
await cdp.click('button', 'Back to menu')
await sleep(300)

// Corrupt record -> notice
await cdp.eval(`localStorage.setItem('riddles.v1.game.counts', '{"schema":99}')`)
await cdp.navigate(BASE)
check('corrupt record notice', (await cdp.text()).includes('could not be read'))

console.log(results.filter((r) => r[0] === 'FAIL').length + ' failures')
await shutdown(process.exitCode ?? 0)
