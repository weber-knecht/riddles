import { useEffect, useMemo, useState } from 'preact/hooks'
import { Menu } from './shell/Menu'
import { Solve, type SolveMode } from './shell/Solve'
import { UpdateBanner } from './shell/UpdateBanner'
import { pluginById, plugins } from './core/registry'
import { defaultStore, type SavedGame, type Settings } from './core/storage'
import { newSeed } from './core/rng'
import type { Difficulty } from './core/types'

type Screen = { kind: 'menu' } | { kind: 'solve'; puzzleId: string; mode: SolveMode }

const store = defaultStore()

function loadAllGames(): { games: Record<string, SavedGame | null>; discarded: boolean } {
  const games: Record<string, SavedGame | null> = {}
  let discarded = false
  for (const p of plugins) {
    const r = store.loadGame(p.logic.id)
    games[p.logic.id] = r.status === 'ok' ? r.value : null
    if (r.status === 'discarded') discarded = true
  }
  return { games, discarded }
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' })
  const [settings, setSettings] = useState<Settings>(() => store.loadSettings())
  const [seedInput, setSeedInput] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [menuVersion, setMenuVersion] = useState(0)

  const savedGames = useMemo(() => {
    const { games, discarded } = loadAllGames()
    if (discarded)
      setNotice('A saved game from an older version could not be read and was removed.')
    return games
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuVersion])

  // Android back gesture: a history entry is pushed when entering the solve screen.
  useEffect(() => {
    // The app always starts on the menu, whatever entry the page was reloaded on.
    history.replaceState({ screen: 'menu' }, '')
    const onPop = () => {
      setScreen({ kind: 'menu' })
      setMenuVersion((v) => v + 1)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function enterSolve(puzzleId: string, mode: SolveMode) {
    history.pushState({ screen: 'solve' }, '')
    setScreen({ kind: 'solve', puzzleId, mode })
  }

  function exitSolve() {
    if ((history.state as { screen?: string } | null)?.screen === 'solve') history.back()
    else {
      setScreen({ kind: 'menu' })
      setMenuVersion((v) => v + 1)
    }
  }

  function onChoice(puzzleId: string, sizeId: string, difficulty: Difficulty) {
    const next: Settings = {
      ...settings,
      lastChoice: { ...settings.lastChoice, [puzzleId]: { sizeId, difficulty } },
    }
    setSettings(next)
    store.saveSettings(next)
  }

  function onNew(puzzleId: string, sizeId: string, difficulty: Difficulty, seed: string | null) {
    setSeedInput('')
    setNotice(null)
    enterSolve(puzzleId, { kind: 'new', sizeId, difficulty, seed: seed ?? newSeed() })
  }

  if (screen.kind === 'solve') {
    const plugin = pluginById[screen.puzzleId]
    if (!plugin) {
      setScreen({ kind: 'menu' })
      return null
    }
    return (
      <>
        <UpdateBanner />
        <Solve
          key={`${screen.puzzleId}:${JSON.stringify(screen.mode)}`}
          plugin={plugin}
          mode={screen.mode}
          store={store}
          onExit={exitSolve}
          onNewSame={(game) =>
            setScreen({
              kind: 'solve',
              puzzleId: game.puzzleId,
              mode: {
                kind: 'new',
                sizeId: game.sizeId,
                difficulty: game.difficulty,
                seed: newSeed(),
              },
            })
          }
        />
      </>
    )
  }

  return (
    <>
      <UpdateBanner />
      <Menu
        plugins={plugins}
        savedGames={savedGames}
        settings={settings}
        notice={notice}
        seedInput={seedInput}
        onSeedInput={setSeedInput}
        onChoice={onChoice}
        onContinue={(id) => enterSolve(id, { kind: 'continue' })}
        onNew={onNew}
      />
    </>
  )
}
