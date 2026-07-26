// Global stack of Android hardware-back-button interceptors.
//
// The app has two kinds of in-page state that a route-level back handler
// can't see: modals (open/closed booleans) and in-page sub-tabs (a plain
// ref, not a route). Without this, pressing back while either is active
// falls straight through to router navigation (or exits the app), skipping
// the "close this modal" / "return to the main sub-tab" step the user
// expects. Components push a handler while they're in a non-default state
// and pop it when they return to default; the back button always consumes
// the most recently pushed handler first (LIFO), so nested state (e.g. a
// modal opened while on a non-default sub-tab) unwinds one step at a time.
let stack = []

export function pushBackHandler(fn) {
  const entry = { fn }
  stack.push(entry)
  return entry
}

export function removeBackHandler(entry) {
  const idx = stack.lastIndexOf(entry)
  if (idx !== -1) stack.splice(idx, 1)
}

// Called by the hardware back button listener. Returns true if a handler
// consumed the press (caller should not also navigate or exit the app).
export function consumeBackHandler() {
  const entry = stack.pop()
  if (!entry) return false
  entry.fn()
  return true
}
