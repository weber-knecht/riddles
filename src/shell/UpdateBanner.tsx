import { useRegisterSW } from 'virtual:pwa-register/preact'

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
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
