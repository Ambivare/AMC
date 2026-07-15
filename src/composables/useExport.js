/**
 * useExport — bulk PDF + Excel export with timeline filtering
 *
 * Usage:
 *   const { showExportDialog, ExportDialog } = useExport()
 *   showExportDialog({ rows, columns, title, filename, excelRowMapper })
 */
import { ref, markRaw, defineComponent, h } from 'vue'
import { exportTablePDF } from './usePDF'
import * as XLSX from 'xlsx'

// ── Timeline options ─────────────────────────────────────────────────────────
export const TIMELINE_OPTIONS = [
  { value: 'today',      label: 'Today' },
  { value: 'week',       label: 'This Week' },
  { value: 'month',      label: 'This Month' },
  { value: 'quarter',    label: 'This Quarter' },
  { value: 'half',       label: 'Half Year' },
  { value: 'year',       label: 'This Year' },
  { value: 'all',        label: 'All Time' },
]

export function getDateRange(period) {
  const now   = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  switch (period) {
    case 'today':
      break
    case 'week':
      start.setDate(now.getDate() - now.getDay())
      break
    case 'month':
      start.setDate(1)
      break
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3)
      start.setMonth(q * 3, 1)
      break
    }
    case 'half':
      start.setMonth(now.getMonth() < 6 ? 0 : 6, 1)
      break
    case 'year':
      start.setMonth(0, 1)
      break
    case 'all':
      return { from: null, to: null }
  }

  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { from: start, to: end }
}

/**
 * Filter rows by a date field.
 * @param {object[]} rows
 * @param {string}   dateField  – field name that contains a date string
 * @param {Date|null} from
 * @param {Date|null} to
 */
export function filterByDateRange(rows, dateField, from, to) {
  if (!from && !to) return rows
  return rows.filter(r => {
    const v = r[dateField]
    if (!v) return false
    // Handle Firestore Timestamp objects (.toDate()), plain Date, or date strings
    const d = (v && typeof v.toDate === 'function') ? v.toDate() : new Date(v)
    if (isNaN(d)) return false
    if (from && d < from) return false
    if (to   && d > to  ) return false
    return true
  })
}

// ── Export to Excel ──────────────────────────────────────────────────────────
export async function exportExcel({ columns, rows, filename = 'export', ui }) {
  const ws = XLSX.utils.aoa_to_sheet([columns, ...rows])
  const colWidths = columns.map((h, i) => ({
    wch: Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length).slice(0, 200)) + 2,
  }))
  ws['!cols'] = colWidths
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  const { saveExcel } = await import('@/utils/saveFile')
  await saveExcel(wb, `${filename}.xlsx`, ui)
}

// ── Composable ───────────────────────────────────────────────────────────────
export function useExport() {
  const dialogVisible = ref(false)
  const dialogOpts    = ref(null)
  const selectedPeriod = ref('month')
  const exportType    = ref('pdf')   // 'pdf' | 'excel'
  const exporting     = ref(false)

  function showExportDialog(opts) {
    dialogOpts.value    = opts
    selectedPeriod.value = 'month'
    exportType.value    = 'pdf'
    dialogVisible.value = true
  }

  async function runExport() {
    if (exporting.value || !dialogOpts.value) return
    exporting.value = true
    try {
      const opts = dialogOpts.value
      const { from, to } = getDateRange(selectedPeriod.value)
      const filtered = filterByDateRange(
        opts.rows,
        opts.dateField || 'createdAt',
        from, to,
      )

      const periodLabel = TIMELINE_OPTIONS.find(o => o.value === selectedPeriod.value)?.label || ''
      const subtitle = `${periodLabel}${from ? ' · ' + from.toLocaleDateString('en-IN') : ''} – ${to ? to.toLocaleDateString('en-IN') : ''} · ${filtered.length} records`

      if (exportType.value === 'excel') {
        await exportExcel({
          columns: opts.columns,
          rows: opts.excelRowMapper ? filtered.map(opts.excelRowMapper) : filtered.map(r => opts.columns.map((_, i) => r[Object.keys(r)[i]] ?? '')),
          filename: `${opts.filename || 'export'}-${selectedPeriod.value}`,
          ui: opts.ui,
        })
      } else {
        await exportTablePDF({
          title:    opts.title,
          subtitle,
          columns:  opts.columns,
          rows:     opts.pdfRowMapper ? filtered.map(opts.pdfRowMapper) : filtered.map(r => opts.columns.map((_, i) => r[Object.keys(r)[i]] ?? '')),
          filename: `${opts.filename || 'export'}-${selectedPeriod.value}`,
          accent:   opts.accent,
          ui:       opts.ui,
        })
      }
      dialogVisible.value = false
    } finally {
      exporting.value = false
    }
  }

  return {
    showExportDialog,
    dialogVisible,
    selectedPeriod,
    exportType,
    exporting,
    runExport,
    TIMELINE_OPTIONS,
    cancelExport: () => { dialogVisible.value = false },
  }
}
