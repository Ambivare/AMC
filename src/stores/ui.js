import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useUIStore = defineStore('ui', () => {
  const sidebarOpen = ref(true)
  const sidebarMini = ref(false)
  const toasts = ref([])
  let toastId = 0
  const toastTimers = new Map()

  // Theme: 'dark' | 'light'
  const theme = ref(localStorage.getItem('me-theme') || 'light')

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('me-theme', t)
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  watch(theme, applyTheme, { immediate: true })

  function toast(message, type = 'info', duration = 4000) {
    const id = ++toastId
    toasts.value.push({ id, message, type })
    const timer = setTimeout(() => dismissToast(id), duration)
    toastTimers.set(id, timer)
  }

  function dismissToast(id) {
    const timer = toastTimers.get(id)
    if (timer) { clearTimeout(timer); toastTimers.delete(id) }
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  function success(msg) { toast(msg, 'success') }
  function error(msg) { toast(msg, 'error') }
  function warning(msg) { toast(msg, 'warning') }
  function info(msg) { toast(msg, 'info') }

  function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value }
  function closeSidebar() { sidebarOpen.value = false }

  const pendingAutoOpen = ref(null)
  function setPendingAutoOpen(data) { pendingAutoOpen.value = data }
  function clearPendingAutoOpen() { pendingAutoOpen.value = null }

  const scheduleContext = ref(null)
  function setScheduleContext(ctx) { scheduleContext.value = ctx }
  function clearScheduleContext() { scheduleContext.value = null }

  const ticketContext = ref(null)
  function setTicketContext(ctx) { ticketContext.value = ctx }
  function clearTicketContext() { ticketContext.value = null }

  return { sidebarOpen, sidebarMini, toasts, toast, dismissToast, success, error, warning, info, toggleSidebar, closeSidebar, theme, toggleTheme, pendingAutoOpen, setPendingAutoOpen, clearPendingAutoOpen, scheduleContext, setScheduleContext, clearScheduleContext, ticketContext, setTicketContext, clearTicketContext }
})
