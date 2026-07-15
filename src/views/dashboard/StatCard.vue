<template>
  <div class="stat-card" :class="`accent-${color}`">
    <div class="stat-top">
      <div class="stat-icon-wrap" :class="`icon-${color}`">
        <component :is="iconComponent" :size="18" />
      </div>
      <div v-if="alert" class="stat-alert">
        <span>{{ alert }}</span>
        <span class="alert-text">{{ alertText }}</span>
      </div>
      <button class="stat-expand-btn" @click.stop="$emit('expand')" title="View details">
        <Maximize2 :size="13" />
      </button>
    </div>
    <div class="stat-value" :class="{ 'stat-value-lg': valueLarge }">{{ value ?? '—' }}</div>
    <div class="stat-label">{{ label }}</div>
    <div class="stat-sub" v-if="sub">{{ sub }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  FolderOpen, Shield, CheckSquare, MessageSquareWarning, Users,
  TrendingUp, Package, Receipt, Activity, Zap, Wrench,
  RefreshCw, CalendarOff, Store, Layers, MapPin, BarChart2, Maximize2
} from 'lucide-vue-next'

const iconMap = { FolderOpen, Shield, CheckSquare, MessageSquareWarning, Users, TrendingUp, Package, Receipt, Activity, Zap, Wrench, RefreshCw, CalendarOff, Store, Layers, MapPin, BarChart2 }

defineEmits(['expand'])

const props = defineProps({
  icon: String,
  color: { type: String, default: 'indigo' },
  value: [String, Number],
  label: String,
  sub: String,
  alert: [String, Number],
  alertText: String,
  valueLarge: Boolean,
})

const iconComponent = computed(() => iconMap[props.icon] || Activity)
</script>

<style scoped>
.stat-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  padding: 20px;
  position: relative;
  overflow: hidden;
  transition: all 0.25s ease;
}
.stat-card::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  opacity: 0;
  transition: opacity 0.25s;
}
.stat-card:hover { transform: translateY(-2px); }
.stat-card:hover::after { opacity: 1; }

.accent-indigo::after { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
.accent-purple::after { background: linear-gradient(90deg, #8b5cf6, #a855f7); }
.accent-blue::after   { background: linear-gradient(90deg, #3b82f6, #6366f1); }
.accent-amber::after  { background: linear-gradient(90deg, #f59e0b, #f97316); }
.accent-emerald::after{ background: linear-gradient(90deg, #10b981, #14b8a6); }
.accent-rose::after   { background: linear-gradient(90deg, #f43f5e, #ef4444); }
.accent-cyan::after   { background: linear-gradient(90deg, #06b6d4, #3b82f6); }
.accent-green::after  { background: linear-gradient(90deg, #22c55e, #10b981); }

.stat-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
.stat-icon-wrap {
  width: 38px; height: 38px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
}
.icon-indigo { background: rgba(99,102,241,0.12); color: #818cf8; border: 1px solid rgba(99,102,241,0.18); }
.icon-purple  { background: rgba(168,85,247,0.12); color: #c084fc; border: 1px solid rgba(168,85,247,0.18); }
.icon-blue    { background: rgba(59,130,246,0.12); color: #93c5fd; border: 1px solid rgba(59,130,246,0.18); }
.icon-amber   { background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.18); }
.icon-emerald { background: rgba(16,185,129,0.12); color:var(--ct-green); border: 1px solid rgba(16,185,129,0.18); }
.icon-rose    { background: rgba(244,63,94,0.12);  color: #fb7185; border: 1px solid rgba(244,63,94,0.18); }
.icon-cyan    { background: rgba(6,182,212,0.12);  color: #67e8f9; border: 1px solid rgba(6,182,212,0.18); }
.icon-green   { background: rgba(34,197,94,0.12);  color: #86efac; border: 1px solid rgba(34,197,94,0.18); }

.stat-alert {
  display: flex; align-items: center; gap: 4px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 99px;
  padding: 2px 8px;
  font-size: 11px; font-weight: 600; color: #f87171;
}
.alert-text { font-weight: 400; opacity: 0.7; }

.stat-value { font-size: 28px; font-weight: 700; color: #f1f5f9; letter-spacing: -0.8px; line-height: 1; margin-bottom: 4px; }
.stat-value-lg { font-size: 20px; }
.stat-label { font-size: 12px; font-weight: 500; color:var(--ct-muted); }
.stat-sub { font-size: 11px; color:var(--ct-muted); margin-top: 3px; }

.stat-expand-btn {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.07);
  color:var(--ct-muted); cursor: pointer;
  transition: all 0.18s;
  opacity: 0;
}
.stat-card:hover .stat-expand-btn { opacity: 1; }
.stat-expand-btn:hover { background: rgba(255,255,255,0.07); color:var(--ct-sub); }

@media (max-width: 600px) {
  .stat-card { padding: 14px; border-radius: 12px; }
  .stat-top { margin-bottom: 10px; }
  .stat-icon-wrap { width: 32px; height: 32px; border-radius: 8px; }
  .stat-value { font-size: 22px; }
  .stat-value-lg { font-size: 16px; }
  .stat-label { font-size: 11px; }
  .stat-sub { font-size: 10px; }
  .stat-expand-btn { opacity: 1; width: 24px; height: 24px; }
}

[data-theme="light"] .stat-expand-btn { border-color: rgba(0,0,0,0.08); }
[data-theme="light"] .stat-expand-btn:hover { background: rgba(0,0,0,0.05); color:var(--ct-muted); }
[data-theme="light"] .stat-value { color: #0f172a; }
[data-theme="light"] .stat-label { color:var(--ct-muted); }
[data-theme="light"] .stat-sub { color:var(--ct-muted); }
[data-theme="light"] .stat-card { background: rgba(255,255,255,0.92); border-color: rgba(0,0,0,0.07); }
</style>
