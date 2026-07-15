const LOCK_MS = 1500
const ACTION_CLASSES = ['btn-primary', 'btn-success', 'btn-danger']

export function setupClickLock() {
  document.addEventListener(
    'click',
    (e) => {
      const btn = e.target.closest('button, [role="button"]')
      if (!btn) return

      // Already locked — block this click completely
      if (btn.dataset.clickLocked) {
        e.stopImmediatePropagation()
        e.preventDefault()
        return
      }

      // Only apply to action buttons; skip opt-outs and natively disabled buttons
      if (btn.disabled) return
      if ('noLock' in btn.dataset) return
      if (!ACTION_CLASSES.some(c => btn.classList.contains(c))) return

      btn.dataset.clickLocked = '1'
      setTimeout(() => {
        delete btn.dataset.clickLocked
      }, LOCK_MS)
    },
    true // capture phase — fires before Vue handlers
  )
}
