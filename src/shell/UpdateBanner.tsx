import { useEffect, useRef } from 'preact/hooks'
import { useRegisterSW } from 'virtual:pwa-register/preact'

/** Minimum time between two update checks triggered by returning to the app. */
const CHECK_INTERVAL_MS = 60_000

export function UpdateBanner() {
  const registration = useRef<ServiceWorkerRegistration | null>(null)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      registration.current = r ?? null
    },
  })

  // An installed app can stay open for days, so also look for a new version
  // whenever it returns to the foreground. The banner still asks before reloading.
  useEffect(() => {
    let lastCheck = Date.now()
    function onVisible() {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return
      lastCheck = Date.now()
      registration.current?.update().catch(() => {
        // Offline or the server is unreachable: try again next time.
      })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (!needRefresh) return null
  return (
    <div class="banner" role="status">
      <span>A new version is available.</span>
      <button class="primary" onClick={() => updateServiceWorker(true)}>
        Reload
      </button>
    </div>
  )
}
