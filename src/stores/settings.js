import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAll, update, create } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'

const DEFAULTS = {
  name: 'TAB Elevators',
  address: '',
  phone: '',
  email: '',
  gst: '',
  cin: '',
  bankName: '',
  bankAccount: '',
  bankIfsc: '',
  bankBranch: '',
  logo: null,
  currency: '₹',
  smtpUser: '',
  smtpPassword: '',
  smtpService: 'gmail',
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref({ ...DEFAULTS })
  const docId = ref(null)

  async function load() {
    const rows = await getAll(Collections.SETTINGS)
    if (rows.length) {
      docId.value = rows[0].id
      settings.value = { ...DEFAULTS, ...rows[0] }
    }
  }

  async function save(data) {
    settings.value = { ...settings.value, ...data }
    if (docId.value) {
      await update(Collections.SETTINGS, docId.value, data)
    } else {
      const id = await create(Collections.SETTINGS, data)
      docId.value = id
    }
  }

  return { settings, load, save }
})
