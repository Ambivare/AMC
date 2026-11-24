<template>
  <div>
    <div v-if="loading" style="padding:20px;text-align:center;color:var(--ct-muted);">Loading today's work…</div>
    <template v-else>
      <div class="glass" style="padding:12px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;color:var(--ct-muted);text-transform:uppercase;">Today's Collection</span>
        <b style="color:#10b981;font-size:18px;">{{ fmt(grandTotal) }}</b>
      </div>

      <div v-for="g in paymentGroups" :key="g.key" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:4px;">
          <span>{{ g.label }}</span><span style="color:#10b981;">{{ fmt(g.total) }}</span>
        </div>
        <div v-if="!g.entries.length" style="font-size:12px;color:var(--ct-muted);">No payments today.</div>
        <div v-for="(e, i) in g.entries" :key="i" style="display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:5px 0;border-bottom:1px solid rgba(128,128,128,.15);">
          <span>{{ e.client }} <span style="color:var(--ct-muted);">{{ e.ref }}</span><span v-if="e.mode" style="color:var(--ct-muted);"> · {{ e.mode }}</span></span>
          <b>{{ fmt(e.amount) }}</b>
        </div>
      </div>

      <div style="font-weight:700;margin:16px 0 4px;">Maintenance Sites Today ({{ visits.length }})</div>
      <div v-if="!visits.length" style="font-size:12px;color:var(--ct-muted);">No maintenance scheduled today.</div>
      <div v-for="(v, i) in visits" :key="i" style="font-size:13px;padding:6px 0;border-bottom:1px solid rgba(128,128,128,.15);">
        <div style="display:flex;justify-content:space-between;"><b>{{ v.site }}</b><span style="text-transform:capitalize;color:var(--ct-muted);">{{ v.status }}</span></div>
        <div style="color:var(--ct-muted);">{{ v.work }}<span v-if="v.tech"> · {{ v.tech }}</span></div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useTodayWork } from '@/composables/useTodayWork'
const { loading, paymentGroups, visits, grandTotal, load } = useTodayWork()
const fmt = (n) => 'Rs. ' + (Number(n) || 0).toLocaleString('en-IN')
onMounted(load)
</script>
