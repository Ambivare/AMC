import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useDbMaskStore = defineStore('dbMask', () => {
  const maskEnabled = ref(localStorage.getItem('sk-db-mask') === '1')

  if (maskEnabled.value) document.documentElement.classList.add('db-masked')

  function toggle() {
    maskEnabled.value = !maskEnabled.value
    localStorage.setItem('sk-db-mask', maskEnabled.value ? '1' : '0')
    if (maskEnabled.value) document.documentElement.classList.add('db-masked')
    else document.documentElement.classList.remove('db-masked')
  }

  return { maskEnabled, toggle }
})
