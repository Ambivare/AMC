<template>
  <div class="toast-container">
    <transition-group name="toast" tag="div">
      <div
        v-for="toast in ui.toasts"
        :key="toast.id"
        class="toast"
        :class="`toast-${toast.type}`"
        @click="ui.dismissToast(toast.id)"
      >
        <component :is="icons[toast.type]" :size="16" class="toast-icon" />
        <span>{{ toast.message }}</span>
        <button class="toast-close" @click.stop="ui.dismissToast(toast.id)">
          <X :size="13" />
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { useUIStore } from '@/stores/ui'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-vue-next'

const ui = useUIStore()
const icons = { success: CheckCircle, error: AlertCircle, warning: AlertTriangle, info: Info }
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 360px;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  border: 1px solid;
}
.toast-success { background: rgba(16,185,129,0.15); color:var(--ct-green); border-color: rgba(16,185,129,0.25); }
.toast-error   { background: rgba(239,68,68,0.15);  color: #f87171; border-color: rgba(239,68,68,0.25); }
.toast-warning { background: rgba(245,158,11,0.15); color: #fbbf24; border-color: rgba(245,158,11,0.25); }
.toast-info    { background: rgba(99,102,241,0.15); color:var(--ct-accent); border-color: rgba(99,102,241,0.25); }

.toast-icon { flex-shrink: 0; }
.toast span { flex: 1; }
.toast-close { background: transparent; border: none; cursor: pointer; color: inherit; opacity: 0.6; padding: 0; display: flex; }
.toast-close:hover { opacity: 1; }

.toast-enter-active, .toast-leave-active { transition: all 0.25s cubic-bezier(0.16,1,0.3,1); }
.toast-enter-from { opacity: 0; transform: translateX(20px); }
.toast-leave-to { opacity: 0; transform: translateX(20px); }
</style>
