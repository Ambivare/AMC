import { watch, onBeforeUnmount } from 'vue'
import { pushBackHandler, removeBackHandler } from '@/utils/backHandlerStack'

/**
 * Makes the hardware back button return an in-page tab ref to its default
 * ("main") value one step at a time, instead of leaving the page entirely.
 * e.g. AMC tab's Payments/Renewals/Monthly sub-tabs → back goes to Contracts.
 */
export function useTabBackHandler(activeTabRef, defaultTab) {
  let entry = null
  watch(activeTabRef, (val) => {
    if (val !== defaultTab) {
      if (!entry) entry = pushBackHandler(() => { activeTabRef.value = defaultTab })
    } else if (entry) {
      removeBackHandler(entry)
      entry = null
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    if (entry) removeBackHandler(entry)
  })
}
