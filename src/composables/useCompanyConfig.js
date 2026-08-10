import { ref } from 'vue'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'

// Module-level state — shared across all components
const company = ref({
  name: '', logoUrl: '', email: '', phone: '', address: '',
  city: '', state: '', pincode: '', gst: '', pan: '',
  bankName: '', accountNo: '', ifsc: '', website: '', stampPosition: 'right',
})

let loadPromise = null

export function useCompanyConfig() {
  function load() {
    if (!loadPromise) {
      loadPromise = getAll(Collections.CONFIGURATIONS)
        .then(docs => {
          if (!docs.length) return
          // Multiple Configurations docs can exist — always use the most
          // recently saved one (matches useBillingPDF.js's loadConfig()).
          const latest = docs.sort((a, b) => {
            const tsA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
            const tsB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
            return tsB - tsA
          })[0]
          if (latest.company) {
            company.value = { ...company.value, ...latest.company }
          }
        })
        .catch(() => {})
    }
    return loadPromise
  }

  // Call after saving Configurations so sidebar/about refreshes immediately
  function refresh() {
    loadPromise = null
    return load()
  }

  return { company, load, refresh }
}
