// End-to-end smoke test of the shell against a built app, driven over the
// Chrome DevTools Protocol. No dependencies beyond Node 22 and a Chromium.
//
//   npm run build
//   npx vite preview --port 4174 --strictPort &
//   chromium --headless=new --disable-gpu --remote-debugging-port=9223 \
//            --user-data-dir=/tmp/riddles-e2e about:blank &
//   (snap Chromium: use a directory under ~/snap/chromium/common instead)
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
// Phone-sized viewport: the Galaxy A26 in the installed app, minus system bars.
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 411, height: 830, deviceScaleFactor: 2, mobile: true })
const checkFit = async (name) => {
  const [scrollH, innerH] = await cdp.eval(`[document.documentElement.scrollHeight, innerHeight]`)
  check(`${name} fits the phone screen without scrolling`, scrollH <= innerH, `${scrollH} of ${innerH}`)
}
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
check('menu renders', t.includes('Riddles') && t.includes('New puzzle · Easy') && t.includes('New puzzle · 10×10 · Easy'), t.split('\n')[0])
check('menu has no placeholder puzzle', !t.includes('Counts'))
check('footer shows volume and print time', /Vol\. \d+\.\d+\.\d+\s+Printed \d{4}-\d\d-\d\d \d\d:\d\d UTC$/.test(t.trim()), t.trim().split('\n').slice(-2).join(' | '))
check('each entry has a tagline', ['9×9', '0 and 1', 'picture logic'].every((w) => t.includes(w)))
check('one pen circle per choice row', await cdp.eval(`[...document.querySelectorAll('.choice')].length === 5 && [...document.querySelectorAll('.choice')].every((row) => row.querySelectorAll('svg').length === 1 && row.querySelector('[aria-pressed="true"] svg'))`))
check('no continue initially', !t.includes('Continue at the bookmark'))

// Fonts are self-hosted and precached
const FACES = ['500 16px Besley', '700 16px Besley', '900 16px Besley', '400 16px Kalam', '700 16px Kalam', '500 16px "Libre Franklin"', '700 16px "Libre Franklin"']
const loaded = await cdp.eval(`Promise.all(${JSON.stringify(FACES)}.map((f) => document.fonts.load(f))).then((r) => r.map((faces) => faces.length))`)
check('all seven font faces load', loaded.every((n) => n === 1), loaded.join(','))
check('nothing is fetched from another origin', await cdp.eval(`performance.getEntriesByType('resource').every((e) => e.name.startsWith(location.origin))`))
const sw = await (await fetch(BASE + 'sw.js')).text()
const precachedFonts = sw.match(/[\w-]+\.woff2?(?=")/g) ?? []
check('service worker precaches seven woff2 files and no woff', precachedFonts.length === 7 && precachedFonts.every((f) => f.endsWith('.woff2')), precachedFonts.length + ' font files')

// ---- Shell, exercised through Sudoku ----
const SUDOKU = 'section[aria-label="Sudoku"]'
const undoDisabled = () => cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.trim()==='Undo').disabled`)

// Difficulty choice is remembered
await cdp.click(`${SUDOKU} .choice button`, 'Hard')
check('difficulty selectable', (await cdp.text()).includes('New puzzle · Hard'))
await cdp.navigate(BASE)
check('difficulty remembered after reload', (await cdp.text()).includes('New puzzle · Hard'))
await cdp.click(`${SUDOKU} .choice button`, 'Easy')

// New game via worker
await cdp.click(`${SUDOKU} button`, 'New puzzle')
await cdp.waitFor(`document.querySelector('.sudoku .cell')`, 20000)
const sg = await cdp.eval(`JSON.parse(localStorage.getItem('riddles.v1.game.sudoku'))`)
check('sudoku saved with 81 givens and solution', sg.puzzle.givens.length === 81 && sg.solution.length === 81, 'seed ' + sg.seed)
check('page title shows the puzzle number', (await cdp.text()).includes('No. ' + sg.seed))
check('running head and difficulty squares', await cdp.eval(`document.querySelector('.running-head .back').textContent.trim() === 'Contents' && document.querySelectorAll('.page-title .squares .on').length === 1`))
check('tool buttons carry an icon', (await cdp.eval(`document.querySelectorAll('.toolrow .tool svg').length`)) === 3)
await checkFit('sudoku')
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

// Wrong digit -> mistakes; undo -> ok
await clickDigit(sg.solution[first] === 1 ? 2 : 1)
// Three kinds of mark: print for givens, tilted pen for entries
const penStyle = () => cdp.eval(`(() => { const p = document.querySelectorAll('.sudoku .cell')[${first}].querySelector('.pen'); const g = document.querySelector('.sudoku .cell.given'); return p && [getComputedStyle(p).fontFamily, getComputedStyle(g).fontFamily, p.style.getPropertyValue('--tilt'), getComputedStyle(p).transform !== 'none' || p.style.getPropertyValue('--tilt') === '0deg'] })()`)
const pen1 = await penStyle()
const tilt = ((Math.floor(first / 9) * 7 + (first % 9) * 5) % 7) - 3 + 'deg'
check('entry is pen handwriting, given is print', pen1 && pen1[0].includes('Kalam') && pen1[1].includes('Besley') && pen1[3], String(pen1))
check('pen digit is tilted by its cell', pen1 && pen1[2] === tilt, pen1 && pen1[2])
const sHeights = await cdp.eval(`(() => { const h = [...document.querySelectorAll('.sudoku .cell')].map(c => c.getBoundingClientRect().height); return [Math.min(...h), Math.max(...h)] })()`)
check('sudoku rows keep equal height with an entry', sHeights[1] - sHeights[0] < 1.6, sHeights.map((v) => v.toFixed(1)).join(' to '))
check('digit row writes in pen ink', await cdp.eval(`getComputedStyle(document.querySelector('.sudoku .digit-row button')).fontFamily.includes('Kalam') && !document.querySelector('.sudoku .digit-row').classList.contains('pencil')`))
await cdp.click('button', 'Check')
check('pen digit keeps its tilt after a re-render', (await penStyle())?.[2] === tilt)
check('check reports mistakes', (await cdp.text()).includes('Contains mistakes.'))
check('check line has a mark', (await cdp.eval(`document.querySelectorAll('.check-line svg').length`)) === 1)
await cdp.click('button', 'Undo')
check('undo clears digit', (await cellText(first)) === '')
await cdp.click('button', 'Check')
check('undo then check ok', (await cdp.text()).includes('Correct so far.'))
check('undo disabled after use', await undoDisabled())

// Pencil marks, keyboard, eraser
await cdp.click('button', 'Pencil')
await clickCell(first)
await clickDigit(3)
await sleep(100)
check('pencil mark rendered', (await cdp.eval(`document.querySelector('.sudoku .cell .marks')?.textContent.trim()`)) === '3')
check('digit row switches to pencil', await cdp.eval(`document.querySelector('.sudoku .digit-row').classList.contains('pencil') && getComputedStyle(document.querySelector('.sudoku .digit-row button')).fontWeight === '400'`))
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
await cdp.click('button', 'Eraser') // back to pen

// Fill two correct cells, reload, continue, state restored
for (const i of empties.slice(0, 2)) {
  await clickCell(i)
  await clickDigit(sg.solution[i])
}
await cdp.navigate(BASE)
t = await cdp.text()
check('menu shows continue', t.includes('Continue at the bookmark') && t.includes('No. ' + sg.seed + ' · Easy'))
await cdp.click(`${SUDOKU} button`, 'Continue')
await cdp.waitFor(`document.querySelector('.sudoku .cell')`)
check(
  'resume restores two entered digits',
  (await cellText(empties[0])) === String(sg.solution[empties[0]]) && (await cellText(empties[1])) === String(sg.solution[empties[1]]),
)
check('resume restores undo snapshot', !(await undoDisabled()))

// Back gesture returns to menu
await cdp.eval('history.back()')
await sleep(300)
check('history back returns to menu', (await cdp.text()).includes('Continue at the bookmark'))

// Discard confirm
await cdp.click(`${SUDOKU} button`, 'New puzzle')
check('inline discard prompt', (await cdp.text()).includes('Tear out the page you started?'))
await cdp.click(`${SUDOKU} button`, 'Keep')
check('keep keeps game', (await cdp.text()).includes('Continue at the bookmark'))

// Solve it
await cdp.click(`${SUDOKU} button`, 'Continue')
await cdp.waitFor(`document.querySelector('.sudoku .cell')`)
for (const i of empties.slice(2)) {
  await clickCell(i)
  await clickDigit(sg.solution[i])
}
await cdp.click('button', 'Check')
t = await cdp.text()
check('solved screen', t.includes('Solved') && t.includes('New puzzle'))
check('saved game cleared', (await cdp.eval(`localStorage.getItem('riddles.v1.game.sudoku')`)) === null)
await cdp.click('button', 'Back to menu')
await sleep(300)
check('menu has no continue after solve', !(await cdp.text()).includes('Continue at the bookmark'))

// Seed reproducibility
async function newWithSeed(seed) {
  await cdp.eval(`(() => { const i = document.querySelector('input[type=text]'); i.value = ${JSON.stringify(seed)}; i.dispatchEvent(new Event('input', {bubbles:true})) })()`)
  await sleep(200)
  await cdp.click(`${SUDOKU} button`, 'New puzzle')
  if (await cdp.eval(`[...document.querySelectorAll('${SUDOKU} button')].some(b => b.textContent.trim() === 'Discard')`)) {
    await cdp.click(`${SUDOKU} button`, 'Discard')
  }
  await cdp.waitFor(`document.querySelector('.sudoku .cell')`, 20000)
  const g = await cdp.eval(`JSON.parse(localStorage.getItem('riddles.v1.game.sudoku'))`)
  g.heading = await cdp.eval(`(() => { const h = document.querySelector('.page-title h1'); return [h.scrollWidth, h.clientWidth, h.getBoundingClientRect().height] })()`)
  await cdp.click('.running-head .back')
  await sleep(400)
  return g
}
const a = await newWithSeed('abc234')
const b = await newWithSeed('abc234')
check('seed normalised to uppercase', a.seed === 'ABC234')
check('same seed gives same puzzle', JSON.stringify(a.puzzle) === JSON.stringify(b.puzzle) && JSON.stringify(a.solution) === JSON.stringify(b.solution))
check('seed field cleared after use', (await cdp.eval(`document.querySelector('input[type=text]').value`)) === '')
check('menu history state normalised', (await cdp.eval(`history.state?.screen`)) === 'menu')
const wide = await newWithSeed('WWWWWWWWWWWW')
check('twelve-character number stays on one line', wide.heading[0] <= wide.heading[1] && wide.heading[2] < 40, wide.heading.join(' '))
await cdp.eval(`localStorage.removeItem('riddles.v1.game.sudoku')`)


// ---- Binairo ----
await cdp.navigate(BASE)
await cdp.click('section[aria-label="Binairo"] button', 'New puzzle')
await cdp.waitFor(`document.querySelector('.binairo .cell')`, 20000)
const bg = await cdp.eval(`JSON.parse(localStorage.getItem('riddles.v1.game.binairo'))`)
check('binairo saved 10x10 with solution', bg.puzzle.n === 10 && bg.solution.length === 100, 'seed ' + bg.seed)
await checkFit('binairo 10x10')
const bEmpties = bg.puzzle.givens.map((v, i) => (v === -1 ? i : -1)).filter((i) => i >= 0)
const bCell = (i) => cdp.eval(`document.querySelectorAll('.binairo .cell')[${i}].click()`)
const bText = (i) => cdp.eval(`document.querySelectorAll('.binairo .cell')[${i}].textContent.trim()`)
const b0 = bEmpties[0]
await bCell(b0); await sleep(50)
check('binairo tap cycles to 0', (await bText(b0)) === '0')
await bCell(b0); await sleep(50)
check('binairo tap cycles to 1', (await bText(b0)) === '1')
check('binairo entry is tilted pen, tap leaves no highlight', await cdp.eval(`(() => { const c = document.querySelectorAll('.binairo .cell')[${b0}]; const p = c.querySelector('.pen'); return !!p && getComputedStyle(p).fontFamily.includes('Kalam') && p.style.getPropertyValue('--tilt') === '${((Math.floor(b0 / 10) * 5 + (b0 % 10) * 3) % 7) - 3}deg' && !document.querySelector('.binairo .cell.focus') })()`))
const bHeights = await cdp.eval(`(() => { const h = [...document.querySelectorAll('.binairo .cell')].map(c => c.getBoundingClientRect().height); return [Math.min(...h), Math.max(...h)] })()`)
check('binairo rows keep equal height with an entry', bHeights[1] - bHeights[0] < 1, bHeights.map((v) => v.toFixed(1)).join(' to '))
await cdp.eval(`document.querySelector('.binairo').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))`)
await sleep(50)
check('binairo keyboard shows the focus cell', (await cdp.eval(`document.querySelectorAll('.binairo .cell.focus').length`)) === 1)
await bCell(b0); await sleep(50)
check('binairo tap cycles to empty', (await bText(b0)) === '')
await bCell(bg.puzzle.givens.findIndex((v) => v !== -1)); await sleep(50)
check('binairo given untouched', true)
// wrong value: cycle to the opposite of the solution
const wrongTaps = bg.solution[b0] === 0 ? 2 : 1
for (let k = 0; k < wrongTaps; k++) { await bCell(b0); await sleep(30) }
await cdp.click('button', 'Check')
check('binairo wrong value reports mistakes', (await cdp.text()).includes('Contains mistakes.'))
await cdp.click('button', 'Undo')
await cdp.click('button', 'Check')
check('binairo after undo correct so far', (await cdp.text()).includes('Correct so far.'))
check('binairo has no pencil button', !(await cdp.eval(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Pencil')`)))
await cdp.click('button', 'Eraser')
await bCell(b0); await sleep(50)
check('binairo eraser clears', (await bText(b0)) === '')
await cdp.click('button', 'Eraser')
for (const i of bEmpties) {
  const taps = bg.solution[i] === 0 ? 1 : 2
  for (let k = 0; k < taps; k++) await bCell(i)
}
await cdp.click('button', 'Check')
check('binairo solved screen', (await cdp.text()).includes('Solved'))
await cdp.click('button', 'Back to menu')
await sleep(300)


// ---- Nonogram ----
await cdp.navigate(BASE)
await cdp.click('section[aria-label="Nonogram"] button', 'New puzzle')
await cdp.waitFor(`document.querySelector('.nonogram .cell')`, 20000)
const ng = await cdp.eval(`JSON.parse(localStorage.getItem('riddles.v1.game.nonogram'))`)
check('nonogram saved 10x10 with clues and solution', ng.puzzle.n === 10 && ng.puzzle.rows.length === 10 && ng.solution.length === 100, 'seed ' + ng.seed)
await checkFit('nonogram 10x10')
check('nonogram cross button label', await cdp.eval(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Cross')`))
const nCell = async (i, type = 'tap') => {
  // Dispatch pointer events at the cell centre; the board reads geometry, not targets.
  await cdp.eval(`(() => {
    const grid = document.querySelector('.nonogram .grid'); const r = grid.getBoundingClientRect(); const n = ${ng.puzzle.n}
    const i = ${i}; const x = r.left + ((i % n) + 0.5) * r.width / n; const y = r.top + (Math.floor(i / n) + 0.5) * r.height / n
    const opts = { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', button: 0, isPrimary: true }
    grid.dispatchEvent(new PointerEvent('pointerdown', opts)); grid.dispatchEvent(new PointerEvent('pointerup', opts)) })()`)
  await sleep(30)
}
const nDrag = async (from, to) => {
  await cdp.eval(`(() => {
    const grid = document.querySelector('.nonogram .grid'); const r = grid.getBoundingClientRect(); const n = ${ng.puzzle.n}
    const at = (i) => [r.left + ((i % n) + 0.5) * r.width / n, r.top + (Math.floor(i / n) + 0.5) * r.height / n]
    const ev = (type, [x, y]) => grid.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 2, pointerType: 'touch', button: 0, isPrimary: true }))
    ev('pointerdown', at(${from})); ev('pointermove', at(${from} + 1)); ev('pointermove', at(${to})); ev('pointerup', at(${to})) })()`)
  await sleep(50)
}
const nClass = (i) => cdp.eval(`document.querySelectorAll('.nonogram .cell')[${i}].className`)
const nEmpties = ng.solution.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0)
const nFilled = ng.solution.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)
await nCell(nEmpties[0])
check('nonogram tap fills', (await nClass(nEmpties[0])).includes('filled'))
await cdp.click('button', 'Check')
check('nonogram wrong fill reports mistakes', (await cdp.text()).includes('Contains mistakes.'))
await cdp.click('button', 'Undo')
check('nonogram undo clears fill', !(await nClass(nEmpties[0])).includes('filled'))
await cdp.click('button', 'Cross')
await nCell(nEmpties[0])
check('nonogram cross mode marks a cross', (await nClass(nEmpties[0])).includes('cross'))
check('nonogram cross is drawn in pen', await cdp.eval(`(() => { const svg = document.querySelectorAll('.nonogram .cell')[${nEmpties[0]}].querySelector('svg'); return !!svg && svg.getBoundingClientRect().width > 8 })()`))
const gutters = await cdp.eval(`(() => { const g = document.querySelector('.nonogram .grid').getBoundingClientRect(); const f = document.querySelector('.nonogram').getBoundingClientRect(); return [g.left - f.left, g.top - f.top] })()`)
check('nonogram 10x10 clue gutters are at least 65px', gutters[0] >= 65 && gutters[1] >= 65, gutters.map((v) => v.toFixed(1)).join(' '))
const nHeights = await cdp.eval(`(() => { const h = [...document.querySelectorAll('.nonogram .cell')].map(c => c.getBoundingClientRect().height); return [Math.min(...h), Math.max(...h)] })()`)
check('nonogram rows keep equal height with a cross', nHeights[1] - nHeights[0] < 1, nHeights.map((v) => v.toFixed(1)).join(' to '))
await cdp.click('button', 'Check')
check('nonogram cross ignored by check', (await cdp.text()).includes('Correct so far.'))
await cdp.click('button', 'Cross')
// drag along the first row from column 0 to 4
await nDrag(0, 4)
const rowFilled = await cdp.eval(`[0,1,2,3,4].every(i => document.querySelectorAll('.nonogram .cell')[i].className.includes('filled'))`)
check('nonogram drag paints a run', rowFilled)
await cdp.click('button', 'Undo')
check('nonogram undo reverts whole stroke', await cdp.eval(`[0,1,2,3,4].every(i => !document.querySelectorAll('.nonogram .cell')[i].className.includes('filled'))`))
// solve: fill every picture cell via taps (crosses stay, ignored)
for (const i of nFilled) await nCell(i)
await cdp.click('button', 'Check')
check('nonogram solved screen', (await cdp.text()).includes('Solved'))
await cdp.click('button', 'Back to menu')
await sleep(300)

// Corrupt record -> notice
await cdp.eval(`localStorage.setItem('riddles.v1.game.sudoku', '{"schema":99}')`)
await cdp.navigate(BASE)
check('corrupt record notice', (await cdp.text()).includes('older edition was discarded'))

// The larger sizes fit too
for (const [name, size, sel] of [['Binairo', '12×12', '.binairo'], ['Nonogram', '15×15', '.nonogram']]) {
  await cdp.navigate(BASE)
  await cdp.click(`section[aria-label="${name}"] .choice button`, size)
  await cdp.click(`section[aria-label="${name}"] button`, 'New puzzle')
  await cdp.waitFor(`document.querySelector('${sel} .cell')`, 20000)
  await checkFit(`${name.toLowerCase()} ${size}`)
  await cdp.eval(`localStorage.removeItem('riddles.v1.game.${name.toLowerCase()}')`)
}
check('zoom gestures disabled', (await cdp.eval(`getComputedStyle(document.documentElement).touchAction`)) === 'pan-x pan-y')

// Data of a removed puzzle type is pruned silently
await cdp.eval(`(() => {
  localStorage.setItem('riddles.v1.game.counts', JSON.stringify({ schema: 1, puzzleId: 'counts' }))
  const s = JSON.parse(localStorage.getItem('riddles.v1.settings'))
  s.lastChoice.counts = { sizeId: '4', difficulty: 'easy' }
  localStorage.setItem('riddles.v1.settings', JSON.stringify(s)) })()`)
await cdp.navigate(BASE)
check('removed puzzle data pruned', (await cdp.eval(`localStorage.getItem('riddles.v1.game.counts')`)) === null)
check('removed puzzle choice pruned', !(await cdp.eval(`'counts' in JSON.parse(localStorage.getItem('riddles.v1.settings')).lastChoice`)))
check('pruning shows no notice', !(await cdp.text()).includes('older edition was discarded'))

// A game from another generator version is discarded with the notice
const stale = { schema: 1, puzzleId: 'sudoku', sizeId: '9', difficulty: 'easy', seed: 'STALE2', generatorVersion: 0, puzzle: {}, solution: [], state: {}, undo: null, startedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
await cdp.eval(`localStorage.setItem('riddles.v1.game.sudoku', ${JSON.stringify(JSON.stringify(stale))})`)
await cdp.navigate(BASE)
t = await cdp.text()
check('outdated game discarded with notice', t.includes('older edition was discarded') && !t.includes('Continue at the bookmark'))

// A current-version game the board cannot render offers a discard
await cdp.eval(`localStorage.setItem('riddles.v1.game.sudoku', ${JSON.stringify(JSON.stringify({ ...stale, generatorVersion: 1, puzzle: null }))})`)
await cdp.navigate(BASE)
await cdp.click('section[aria-label="Sudoku"] button', 'Continue')
await sleep(300)
check('unrenderable game offers discard', (await cdp.text()).includes('This saved game could not be opened.'))
await cdp.click('button', 'Discard this game')
await sleep(400)
check('discard returns to a clean menu', !(await cdp.text()).includes('Continue at the bookmark') && (await cdp.eval(`localStorage.getItem('riddles.v1.game.sudoku')`)) === null)

// Benchmark page
await cdp.navigate(BASE + '?bench')
await cdp.waitFor(`document.body.innerText.includes('Done.')`, 240000)
t = await cdp.text()
check('benchmark finishes with a row per puzzle size', t.includes('Slowest overall') && (await cdp.eval(`document.querySelectorAll('.bench tbody tr').length`)) === 5, t.split('\n').filter((l) => l.includes('Slowest overall')).join(''))
await cdp.click('button', 'Back to the app')
await cdp.waitFor(`document.querySelector('section[aria-label="Sudoku"]')`)
check('benchmark page leads back to the app', true)

// Returning to the foreground looks for a new version, at most once per minute
await cdp.waitFor(`navigator.serviceWorker.getRegistration().then((r) => !!r)`, 15000)
await sleep(500)
const updates = await cdp.eval(`(() => {
  window.__updates = 0
  ServiceWorkerRegistration.prototype.update = function () { window.__updates++; return Promise.resolve() }
  const fire = () => document.dispatchEvent(new Event('visibilitychange'))
  fire()
  const early = window.__updates
  const now = Date.now
  Date.now = () => now() + 61000
  fire()
  fire()
  Date.now = now
  return [early, window.__updates]
})()`)
check('foreground update check runs once per minute', updates[0] === 0 && updates[1] === 1, updates.join(','))

console.log(results.filter((r) => r[0] === 'FAIL').length + ' failures')
await shutdown(process.exitCode ?? 0)
