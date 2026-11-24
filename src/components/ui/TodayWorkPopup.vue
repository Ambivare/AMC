<template>
  <AppModal v-model="show" title="Today's Work" width="520px">
    <TodayWorkPanel />
    <div style="text-align:right;margin-top:14px;"><button class="btn-primary" @click="show = false">Got it</button></div>
  </AppModal>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppModal from './AppModal.vue'
import TodayWorkPanel from './TodayWorkPanel.vue'
import { localToday } from '@/composables/useTodayWork'

const show = ref(false)
onMounted(() => {
  try {
    const key = 'ct-today-popup-shown'
    if (localStorage.getItem(key) === localToday()) return
    localStorage.setItem(key, localToday())
  } catch {}
  show.value = true
})
</script>
