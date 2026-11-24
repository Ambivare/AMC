<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">Today's Work</h1>
    </div>
    <div class="table-container" style="padding:20px;"><TodayWorkPanel /></div>
  </div>
</template>

<script setup>
import TodayWorkPanel from '@/components/ui/TodayWorkPanel.vue'
</script>

<style scoped>
.page-container { padding: 28px; }
</style>
