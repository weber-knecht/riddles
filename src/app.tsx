import { useEffect, useState } from 'preact/hooks'
import { useRegisterSW } from 'virtual:pwa-register/preact'

const COUNTER_KEY = 'riddles.test.counter'

function readCounter(): number | null {
  try {
    const raw = localStorage.getItem(COUNTER_KEY)
    return raw === null ? 0 : Number(raw)
  } catch {
    return null
  }
}

function writeCounter(value: number): boolean {
  try {
    localStorage.setItem(COUNTER_KEY, String(value))
    return true
  } catch {
    return false
  }
}

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

export function App() {
  const [counter, setCounter] = useState<number | null>(readCounter)
  const [storageError, setStorageError] = useState(false)
  const [persisted, setPersisted] = useState<string>('not requested')
  const [swState, setSwState] = useState('unknown')
  const online = useOnline()

  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      setSwState(registration ? `registered (${registration.active ? 'active' : 'installing'})` : 'registered')
    },
    onRegisterError(error) {
      setSwState(`error: ${String(error)}`)
    },
  })

  const controlled = 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null
  const standalone = window.matchMedia('(display-mode: standalone)').matches

  function increment() {
    if (counter === null) return
    const next = counter + 1
    if (writeCounter(next)) setCounter(next)
    else setStorageError(true)
  }

  async function requestPersist() {
    try {
      if (!navigator.storage?.persist) {
        setPersisted('Storage API unavailable')
        return
      }
      const granted = await navigator.storage.persist()
      const now = await navigator.storage.persisted()
      setPersisted(`persist() → ${granted}, persisted() → ${now}`)
    } catch (error) {
      setPersisted(`error: ${String(error)}`)
    }
  }

  return (
    <main>
      <h1>Riddles — offline test</h1>

      {needRefresh && (
        <div class="banner" role="status">
          A new version is available.
          <button onClick={() => updateServiceWorker(true)}>Reload</button>
        </div>
      )}

      <section>
        <h2>Counter</h2>
        <p class="big">{counter === null ? 'localStorage unavailable' : counter}</p>
        <button onClick={increment} disabled={counter === null}>
          +1
        </button>
        {storageError && <p class="warn">Writing to localStorage failed.</p>}
      </section>

      <section>
        <h2>Status</h2>
        <dl>
          <dt>Build</dt>
          <dd>{__BUILD_TIME__}</dd>
          <dt>Service worker</dt>
          <dd>{swState}</dd>
          <dt>Page controlled by SW</dt>
          <dd>{controlled ? 'yes' : 'no'}</dd>
          <dt>Offline ready</dt>
          <dd>{offlineReady ? 'yes' : 'not yet'}</dd>
          <dt>Network</dt>
          <dd>{online ? 'online' : 'offline'}</dd>
          <dt>Display mode</dt>
          <dd>{standalone ? 'standalone' : 'browser tab'}</dd>
          <dt>Persistent storage</dt>
          <dd>
            {persisted} <button onClick={requestPersist}>Request</button>
          </dd>
          <dt>User agent</dt>
          <dd class="ua">{navigator.userAgent}</dd>
        </dl>
      </section>
    </main>
  )
}
