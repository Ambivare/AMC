import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import { setupClickLock } from './utils/clickLock'
import { registerFCMRouter, registerFCMUIStore } from './firebase/fcm'
import { enableNetwork } from 'firebase/firestore'
import { db } from './firebase/config'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'

setupClickLock()

// When the browser wakes the tab from background freeze, re-enable Firebase
// network so Firestore listeners reconnect and the UI unfreezes immediately.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    enableNetwork(db).catch(() => {})
  }
})

const app    = createApp(App)
const pinia  = createPinia()
app.use(pinia)
app.use(router)
app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue error]', info, err)
}
router.onError((err) => {
  console.error('[Router error]', err)
})
app.mount('#app')

// Register router and UI store so FCM notification taps can navigate + toast
registerFCMRouter(router)
import('./stores/ui').then(({ useUIStore }) => registerFCMUIStore(useUIStore()))

// Android hardware back button — without this, Capacitor's default behavior
// is to exit the app immediately instead of navigating back within the SPA.
const HOME_ROUTES = ['/dashboard', '/login']
if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    const path = router.currentRoute.value.path
    if (canGoBack && !HOME_ROUTES.includes(path)) {
      window.history.back()
    } else {
      CapacitorApp.exitApp()
    }
  })
}
