import { ref } from 'vue'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'

// Module-level cache — refreshed after save
const enabledTabs = ref(null) // null = not loaded yet = show all
let loadPromise = null

export function useEnabledTabs() {
  function load() {
    if (!loadPromise) {
      loadPromise = getAll(Collections.CONFIGURATIONS)
        .then(docs => {
          if (docs.length && docs[0].enabledTabs) {
            enabledTabs.value = docs[0].enabledTabs
          } else {
            enabledTabs.value = {} // empty = all visible
          }
        })
        .catch(() => { enabledTabs.value = {} })
    }
    return loadPromise
  }

  function refresh() {
    loadPromise = null
    enabledTabs.value = null
    return load()
  }

  /** Returns true if tab should be shown (null state = all shown) */
  function isEnabled(tabKey) {
    if (enabledTabs.value === null) return true
    const val = enabledTabs.value[tabKey]
    return val === undefined ? true : !!val
  }

  return { enabledTabs, load, refresh, isEnabled }
}
