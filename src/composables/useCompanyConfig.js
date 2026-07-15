import { ref } from 'vue'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'

// Module-level state — shared across all components
const company = ref({
  name: '', logoUrl: '', email: '', phone: '', address: '',
  city: '', state: '', pincode: '', gst: '', pan: '',
  bankName: '', accountNo: '', ifsc: '', website: '',
})

let loadPromise = null

export function useCompanyConfig() {
  function load() {
    if (!loadPromise) {
      loadPromise = getAll(Collections.CONFIGURATIONS)
        .then(docs => {
          if (docs.length && docs[0].company) {
            company.value = { ...company.value, ...docs[0].company }
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
