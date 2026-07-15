<template>
  <div class="table-container">
    <div class="table-toolbar" v-if="$slots.toolbar">
      <slot name="toolbar" />
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key" :style="col.width ? { width: col.width } : {}">
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td :colspan="columns.length" class="loading-row">
              <div class="loading-pulse">Loading...</div>
            </td>
          </tr>
          <tr v-else-if="!rows.length">
            <td :colspan="columns.length">
              <div class="empty-state">
                <component :is="emptyIcon" :size="32" />
                <p>{{ emptyText }}</p>
              </div>
            </td>
          </tr>
          <template v-else>
            <tr v-for="(row, i) in rows" :key="row.id || i"
              :style="onRowClick ? 'cursor:pointer;' : ''"
              @click="onRowClick && onRowClick(row)">
              <slot :row="row" :index="i" />
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <!-- Pagination -->
    <div class="table-footer" v-if="total > pageSize">
      <span class="table-count">
        Showing {{ (page - 1) * pageSize + 1 }}–{{ Math.min(page * pageSize, total) }} of {{ total }}
      </span>
      <div class="pagination">
        <button class="page-btn" :disabled="page <= 1" @click="$emit('page', page - 1)">
          <ChevronLeft :size="14" />
        </button>
        <span class="page-num">{{ page }} / {{ totalPages }}</span>
        <button class="page-btn" :disabled="page >= totalPages" @click="$emit('page', page + 1)">
          <ChevronRight :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-vue-next'

const props = defineProps({
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  loading: Boolean,
  total: { type: Number, default: 0 },
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 25 },
  emptyText: { type: String, default: 'No records found' },
  emptyIcon: { type: Object, default: () => Inbox },
  onRowClick: { type: Function, default: null },
})

defineEmits(['page'])

const totalPages = computed(() => Math.ceil(props.total / props.pageSize) || 1)
</script>

<style scoped>
.table-toolbar {
  padding: 16px 16px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.table-wrap { overflow-x: auto; }
.loading-row td { text-align: center; padding: 40px; color:var(--ct-muted); }
.loading-pulse { font-size: 13px; }
.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-top: 1px solid rgba(255,255,255,0.04);
}
.table-count { font-size: 12px; color:var(--ct-muted); }
.pagination { display: flex; align-items: center; gap: 8px; }
.page-btn {
  width: 28px; height: 28px; border-radius: 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  color:var(--ct-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.09); color:var(--ct-sub); }
.page-btn:disabled { opacity: 0.35; cursor: default; }
.page-num { font-size: 12px; color:var(--ct-muted); }
</style>
