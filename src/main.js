import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import { registerFCMRouter, registerFCMUIStore } from './firebase/fcm'
import { enableNetwork } from 'firebase/firestore'
import { db } from './firebase/config'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { consumeBackHandler } from './utils/backHandlerStack'

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
// Note: the plugin's own `canGoBack` reflects the native WebView's history
// stack, which does not reliably track Vue Router's pushState navigations —
// it was staying false and exiting the app on every press. Vue Router's own
// createWebHistory records a `back` pointer in `history.state` for every
// entry, so check that instead to know whether there's an in-app screen to
// return to.
//
// Open modals and non-default in-page sub-tabs (e.g. AMC's Payments tab)
// aren't part of the route at all, so they're checked first via a global
// handler stack (src/utils/backHandlerStack.js) — closing a modal or
// resetting a sub-tab consumes the press instead of navigating/exiting.
const HOME_ROUTES = ['/dashboard', '/login']
if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener('backButton', () => {
    if (consumeBackHandler()) return
    const path = router.currentRoute.value.path
    const hasInAppHistory = !!window.history.state?.back
    if (hasInAppHistory && !HOME_ROUTES.includes(path)) {
      window.history.back()
    } else {
      CapacitorApp.exitApp()
    }
  })
}
