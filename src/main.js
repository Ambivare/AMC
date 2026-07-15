import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import { setupClickLock } from './utils/clickLock'
import { registerFCMRouter, registerFCMUIStore } from './firebase/fcm'
import { enableNetwork } from 'firebase/firestore'
import { db } from './firebase/config'

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
app.mount('#app')

// Register router and UI store so FCM notification taps can navigate + toast
registerFCMRouter(router)
import('./stores/ui').then(({ useUIStore }) => registerFCMUIStore(useUIStore()))
