<template>
  <Teleport to="body">
    <div v-if="modelValue" class="export-overlay" @click.self="$emit('cancel')">
      <div class="export-dialog">
        <div class="export-header">
          <span class="export-title">Export Data</span>
          <button class="export-close" @click="$emit('cancel')"><X :size="16" /></button>
        </div>

        <div class="export-body">
          <p class="export-hint">Select the time period and format for your export.</p>

          <!-- Format toggle -->
          <div class="export-group">
            <label class="export-label">Format</label>
            <div class="export-toggle">
              <button
                v-for="t in [{ v: 'pdf', label: 'PDF' }, { v: 'excel', label: 'Excel' }]"
                :key="t.v"
                :class="['toggle-btn', exportType === t.v && 'active']"
                @click="$emit('update:exportType', t.v)"
              >{{ t.label }}</button>
            </div>
          </div>

          <!-- Period selection -->
          <div class="export-group">
            <label class="export-label">Time Period</label>
            <div class="period-grid">
              <button
                v-for="opt in TIMELINE_OPTIONS"
                :key="opt.value"
                :class="['period-btn', selectedPeriod === opt.value && 'active']"
                @click="$emit('update:selectedPeriod', opt.value)"
              >{{ opt.label }}</button>
            </div>
          </div>
        </div>

        <div class="export-footer">
          <button class="btn-secondary" @click="$emit('cancel')">Cancel</button>
          <button class="btn-primary" :disabled="exporting" @click="$emit('confirm')">
            <span v-if="exporting">Exporting…</span>
            <span v-else>Export {{ exportType === 'pdf' ? 'PDF' : 'Excel' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { X } from 'lucide-vue-next'
import { TIMELINE_OPTIONS } from '@/composables/useExport'

defineProps({
  modelValue:     { type: Boolean, default: false },
  selectedPeriod: { type: String,  default: 'month' },
  exportType:     { type: String,  default: 'pdf' },
  exporting:      { type: Boolean, default: false },
})
defineEmits(['update:modelValue', 'update:selectedPeriod', 'update:exportType', 'confirm', 'cancel'])
</script>

<style scoped>
.export-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
}
.export-dialog {
  background: var(--modal-bg, #fff);
  border: 1px solid var(--modal-border, rgba(0,0,0,0.1));
  border-radius: 16px; width: 360px; max-width: 94vw;
  box-shadow: 0 24px 60px rgba(0,0,0,0.2);
  overflow: hidden;
}
.export-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--modal-border, rgba(0,0,0,0.08));
}
.export-title { font-size: 15px; font-weight: 700; color: var(--ct-primary, #0f172a); }
.export-close { background: none; border: none; cursor: pointer; color: var(--ct-muted, #4b5563); display:flex;align-items:center; border-radius:6px;padding:4px;}
.export-close:hover { background: rgba(0,0,0,0.06); }
.export-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 16px; }
.export-hint { font-size: 13px; color: var(--ct-muted, #4b5563); margin: 0; }
.export-group { display: flex; flex-direction: column; gap: 8px; }
.export-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--ct-muted, #6b7280); }
.export-toggle { display: flex; gap: 8px; }
.toggle-btn {
  flex: 1; padding: 8px 0; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
  border: 1.5px solid rgba(99,102,241,0.25); background: transparent;
  color: var(--ct-sub, #475569); transition: all .15s;
}
.toggle-btn.active { background: #6366f1; border-color: #6366f1; color: #fff; }
.period-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.period-btn {
  padding: 8px 6px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer;
  border: 1.5px solid rgba(0,0,0,0.1); background: transparent;
  color: var(--ct-sub, #475569); transition: all .15s; text-align: center;
}
.period-btn.active { background: rgba(99,102,241,0.1); border-color: #6366f1; color: #6366f1; font-weight: 700; }
.period-btn:hover:not(.active) { background: rgba(0,0,0,0.04); }
.export-footer {
  display: flex; gap: 10px; padding: 14px 20px;
  border-top: 1px solid var(--modal-border, rgba(0,0,0,0.08)); justify-content: flex-end;
}
</style>
