<template>
  <Teleport to="body">
    <Transition name="tl-backdrop">
      <div v-if="modelValue" class="tl-backdrop" @click.self="close"></div>
    </Transition>
    <Transition name="tl-slide">
      <div v-if="modelValue" class="tl-panel">

        <!-- Header -->
        <div class="tl-header">
          <div class="tl-header-left">
            <div class="tl-header-icon">
              <History :size="18" />
            </div>
            <div>
              <div class="tl-header-title">Activity Timeline</div>
              <div class="tl-header-sub">{{ title }}</div>
            </div>
          </div>
          <div class="tl-header-actions">
            <button class="tl-icon-btn" title="Export PDF" @click="exportPDF" :disabled="exporting">
              <Loader2 v-if="exporting" :size="15" class="spin" />
              <FileDown v-else :size="15" />
            </button>
            <button class="tl-icon-btn tl-close-btn" @click="close" title="Close">
              <X :size="16" />
            </button>
          </div>
        </div>

        <!-- Summary pill -->
        <div v-if="recordSummary" class="tl-summary">
          <span class="tl-summary-text">{{ recordSummary }}</span>
        </div>

        <!-- Add Note -->
        <div class="tl-add-note">
          <div class="tl-add-note-inner">
            <div class="tl-note-avatar">
              <MessageSquarePlus :size="14" />
            </div>
            <textarea
              v-model="noteText"
              class="tl-note-input"
              rows="2"
              placeholder="Add a note, progress update, or comment…"
            ></textarea>
          </div>
          <div class="tl-add-note-footer">
            <span class="tl-entry-count">{{ entries.length }} event{{ entries.length !== 1 ? 's' : '' }}</span>
            <button
              class="tl-note-btn"
              :disabled="!noteText.trim() || adding"
              @click="addNote"
            >
              <Loader2 v-if="adding" :size="13" class="spin" />
              <Plus v-else :size="13" />
              Add Note
            </button>
          </div>
        </div>

        <!-- Timeline body -->
        <div class="tl-body" ref="bodyRef">
          <div v-if="loading" class="tl-loading">
            <Loader2 :size="32" class="spin tl-spin-icon" />
            <span>Loading timeline…</span>
          </div>

          <div v-else-if="!entries.length" class="tl-empty">
            <History :size="48" class="tl-empty-icon" />
            <p>No activity recorded yet</p>
            <span>Events will appear here when the record is created or updated.</span>
          </div>

          <div v-else class="tl-list">
            <div
              v-for="(entry, idx) in entries"
              :key="entry.id"
              class="tl-entry"
            >
              <!-- Dot + line connector -->
              <div class="tl-entry-track">
                <div class="tl-dot" :class="`tl-dot-${entry.type}`">
                  <component :is="typeIcon(entry.type)" :size="10" />
                </div>
                <div v-if="idx < entries.length - 1" class="tl-connector"></div>
              </div>

              <!-- Content -->
              <div class="tl-entry-content">
                <div class="tl-entry-top">
                  <span class="tl-type-badge" :class="`tl-badge-${entry.type}`">
                    {{ typeLabel(entry.type) }}
                  </span>
                  <span class="tl-ts">{{ formatTs(entry.timestamp) }}</span>
                </div>
                <div class="tl-msg">{{ entry.message }}</div>
                <div class="tl-user">
                  <span class="tl-user-dot"></span>
                  {{ entry.user }}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { usePDF } from '@/composables/usePDF'
import {
  History, X, FileDown, Plus, Loader2,
  MessageSquarePlus, CheckCircle2, PenLine, ArrowRightLeft,
  UserCheck, RefreshCw, StickyNote
} from 'lucide-vue-next'
import { getAll, create, where, orderBy } from '@/firebase/firestore'
import { savePDF } from '@/utils/saveFile'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  recordId:   { type: String, default: '' },
  collection: { type: String, default: '' },
  title:      { type: String, default: 'Record' },
  recordSummary: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const entries  = ref([])
const loading  = ref(false)
const adding   = ref(false)
const exporting = ref(false)
const noteText = ref('')
const bodyRef  = ref(null)
const { _drawHeader, _drawFooter, _sectionLabel, _C, _MARGIN, _PAGE_W, _getCtx } = usePDF()

// ── Load timeline entries ──────────────────────────────────────────────────────
async function load() {
  if (!props.recordId || !props.collection) return
  loading.value = true
  try {
    const raw = await getAll(props.collection, [
      where('recordId', '==', props.recordId),
      orderBy('timestamp', 'desc'),
    ])
    entries.value = raw
  } catch (e) {
    // Firestore index may not exist yet — fallback to client-side sort
    try {
      const raw = await getAll(props.collection, [where('recordId', '==', props.recordId)])
      entries.value = raw.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
    } catch { entries.value = [] }
  } finally {
    loading.value = false
  }
}

watch(() => [props.modelValue, props.recordId], ([open]) => {
  if (open) load()
  else { entries.value = []; noteText.value = '' }
})

// ── Add note ──────────────────────────────────────────────────────────────────
async function addNote() {
  if (!noteText.value.trim() || !props.recordId) return
  adding.value = true
  try {
    const sessionRaw = localStorage.getItem('me_session_v2')
    const session = sessionRaw ? JSON.parse(sessionRaw) : {}
    await create(props.collection, {
      recordId: props.recordId,
      type: 'note',
      message: noteText.value.trim(),
      meta: {},
      user: session.fullName || session.username || 'System',
      userId: session.id || null,
      timestamp: new Date().toISOString(),
    })
    noteText.value = ''
    await load()
  } finally {
    adding.value = false
  }
}

function close() { emit('update:modelValue', false) }

// ── Type helpers ──────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  created:       'Created',
  updated:       'Updated',
  status_change: 'Status Change',
  note:          'Note',
  assigned:      'Assigned',
  completed:     'Completed',
}
const TYPE_ICONS = {
  created:       CheckCircle2,
  updated:       RefreshCw,
  status_change: ArrowRightLeft,
  note:          StickyNote,
  assigned:      UserCheck,
  completed:     CheckCircle2,
}
function typeLabel(t) { return TYPE_LABELS[t] || t }
function typeIcon(t)  { return TYPE_ICONS[t] || PenLine }

// ── Format timestamp ──────────────────────────────────────────────────────────
function formatTs(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

// ── Export PDF ────────────────────────────────────────────────────────────────
async function exportPDF() {
  exporting.value = true
  try {
    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const { company, userName } = await _getCtx()
    const M = _MARGIN
    const W = _PAGE_W

    const types = [...new Set(entries.value.map(e => typeLabel(e.type)))]
    let y = await _drawHeader(doc, {
      company,
      userName,
      title: 'Activity Timeline',
      subtitle: `${props.title || ''} · ${entries.value.length} events`,
    })

    // ── Summary band ─────────────────────────────────────────────────────────
    y = _sectionLabel(doc, `Record: ${props.title || '—'}`, y, _C.indigo)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(..._C.midGrey)
    if (props.recordSummary) doc.text(props.recordSummary, M, y)
    doc.text(`Event Types: ${types.join(', ')}`, M, y + (props.recordSummary ? 5 : 0))
    y += (props.recordSummary ? 12 : 7)

    // ── Events table ─────────────────────────────────────────────────────────
    const sorted = [...entries.value].sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
    const typeColors = {
      created: _C.green, updated: [217, 119, 6],
      status_change: _C.indigo, note: [147, 51, 234],
      assigned: [20, 184, 166], completed: _C.green,
    }

    doc.autoTable({
      startY: y,
      head: [['#', 'Date & Time', 'Event', 'Description', 'By']],
      body: sorted.map((e, i) => [i + 1, formatTs(e.timestamp), typeLabel(e.type), e.message || '—', e.user || '—']),
      styles: {
        fontSize: 8, cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
        overflow: 'linebreak', textColor: _C.darkText, minCellHeight: 8,
      },
      headStyles: { fillColor: _C.indigo, textColor: _C.white, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: _C.rowAlt },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        1: { cellWidth: 32 },
        2: { cellWidth: 28 },
        3: { overflow: 'linebreak', minCellWidth: 80 },
        4: { cellWidth: 25 },
      },
      didParseCell(data) {
        if (data.column.index === 2 && data.section === 'body') {
          const col = typeColors[sorted[data.row.index]?.type]
          if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = 'bold' }
        }
      },
      margin: { left: M, right: M, bottom: 12 },
    })

    _drawFooter(doc, { company: company.name, title: 'Activity Timeline', note: 'Internal Document · Confidential' })

    const safeName = (props.title || 'timeline').replace(/[^a-zA-Z0-9-_]/g, '_')
    await savePDF(doc, `Timeline-${safeName}.pdf`, undefined)
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
/* ── Backdrop ──────────────────────────────────────────────────────────────── */
.tl-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1100;
  backdrop-filter: blur(2px);
}

/* ── Panel ──────────────────────────────────────────────────────────────────── */
.tl-panel {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: 460px;
  background: #0f172a;
  border-left: 1px solid rgba(255,255,255,0.08);
  z-index: 1101;
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 40px rgba(0,0,0,0.5);
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.tl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(99,102,241,0.06);
  flex-shrink: 0;
}
.tl-header-left { display: flex; align-items: center; gap: 12px; }
.tl-header-icon {
  width: 38px; height: 38px;
  background: rgba(99,102,241,0.15);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #818cf8;
}
.tl-header-title { font-size: 15px; font-weight: 700; color:var(--ct-primary); }
.tl-header-sub   { font-size: 12px; color:var(--ct-muted); margin-top: 2px; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tl-header-actions { display: flex; gap: 8px; }
.tl-icon-btn {
  width: 32px; height: 32px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  cursor: pointer;
  color:var(--ct-sub);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.tl-icon-btn:hover { background: rgba(255,255,255,0.1); color:var(--ct-primary); }
.tl-icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.tl-close-btn:hover { background: rgba(239,68,68,0.15); color: #f87171; border-color: rgba(239,68,68,0.2); }

/* ── Summary pill ───────────────────────────────────────────────────────────── */
.tl-summary {
  padding: 10px 20px;
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  flex-shrink: 0;
}
.tl-summary-text { font-size: 12px; color:var(--ct-muted); }

/* ── Add Note ───────────────────────────────────────────────────────────────── */
.tl-add-note {
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.015);
  flex-shrink: 0;
}
.tl-add-note-inner { display: flex; gap: 10px; align-items: flex-start; }
.tl-note-avatar {
  width: 30px; height: 30px; flex-shrink: 0;
  background: rgba(99,102,241,0.15);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #818cf8;
  margin-top: 2px;
}
.tl-note-input {
  flex: 1;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  color:var(--ct-primary);
  resize: none;
  transition: border-color 0.15s;
  font-family: inherit;
}
.tl-note-input:focus { outline: none; border-color: rgba(99,102,241,0.5); }
.tl-note-input::placeholder { color:var(--ct-muted); }
.tl-add-note-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.tl-entry-count { font-size: 11px; color:var(--ct-muted); }
.tl-note-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 14px;
  background: rgba(99,102,241,0.15);
  border: 1px solid rgba(99,102,241,0.3);
  border-radius: 8px;
  color: #818cf8;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.tl-note-btn:hover:not(:disabled) { background: rgba(99,102,241,0.25); }
.tl-note-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Body / Scrollable ──────────────────────────────────────────────────────── */
.tl-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  scroll-behavior: smooth;
}
.tl-body::-webkit-scrollbar { width: 4px; }
.tl-body::-webkit-scrollbar-track { background: transparent; }
.tl-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

.tl-loading, .tl-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 10px; padding: 60px 20px;
  color:var(--ct-muted);
}
.tl-empty-icon { opacity: 0.25; }
.tl-empty p { font-size: 14px; color:var(--ct-muted); margin: 0; font-weight: 500; }
.tl-empty span { font-size: 12px; color:var(--ct-muted); text-align: center; }

/* ── Timeline entries ───────────────────────────────────────────────────────── */
.tl-list { display: flex; flex-direction: column; }

.tl-entry {
  display: flex;
  gap: 14px;
  min-height: 48px;
}

.tl-entry-track {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 22px;
}
.tl-dot {
  width: 22px; height: 22px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  color: white;
  box-shadow: 0 0 0 3px rgba(255,255,255,0.04);
}
.tl-dot-created       { background: #16a34a; }
.tl-dot-updated       { background: #d97706; }
.tl-dot-status_change { background: #6366f1; }
.tl-dot-note          { background: #7c3aed; }
.tl-dot-assigned      { background: #0891b2; }
.tl-dot-completed     { background: #059669; }

.tl-connector {
  width: 2px; flex: 1; min-height: 16px;
  background: rgba(255,255,255,0.07);
  margin: 4px 0;
}

.tl-entry-content {
  flex: 1;
  padding-bottom: 20px;
}
.tl-entry-top {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 5px; flex-wrap: wrap;
}
.tl-type-badge {
  font-size: 10px; font-weight: 700;
  padding: 2px 8px; border-radius: 20px;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.tl-badge-created       { background: rgba(22,163,74,0.15); color: #4ade80; }
.tl-badge-updated       { background: rgba(217,119,6,0.15);  color: #fbbf24; }
.tl-badge-status_change { background: rgba(99,102,241,0.15); color: #818cf8; }
.tl-badge-note          { background: rgba(124,58,237,0.15); color: #c084fc; }
.tl-badge-assigned      { background: rgba(8,145,178,0.15);  color: #22d3ee; }
.tl-badge-completed     { background: rgba(5,150,105,0.15);  color:var(--ct-green); }

.tl-ts { font-size: 11px; color:var(--ct-muted); margin-left: auto; white-space: nowrap; }
.tl-msg { font-size: 13px; color:var(--ct-secondary); line-height: 1.5; }
.tl-user {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; color:var(--ct-muted); margin-top: 4px;
}
.tl-user-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: #334155;
}

/* ── Transitions ────────────────────────────────────────────────────────────── */
.tl-backdrop-enter-active,
.tl-backdrop-leave-active { transition: opacity 0.25s ease; }
.tl-backdrop-enter-from,
.tl-backdrop-leave-to { opacity: 0; }

.tl-slide-enter-active,
.tl-slide-leave-active { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.tl-slide-enter-from,
.tl-slide-leave-to { transform: translateX(100%); }

/* ── Spin ───────────────────────────────────────────────────────────────────── */
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.tl-spin-icon { color: #6366f1; }

/* ── Light theme ─────────────────────────────────────────────────────────────── */
[data-theme="light"] .tl-panel { background: #ffffff; border-left-color: rgba(0,0,0,0.08); }
[data-theme="light"] .tl-header { background: rgba(99,102,241,0.04); }
[data-theme="light"] .tl-header-title { color: #0f172a; }
[data-theme="light"] .tl-header-sub { color:var(--ct-muted); }
[data-theme="light"] .tl-note-input { background: #f8fafc; border-color:var(--ct-primary); color: #1e293b; }
[data-theme="light"] .tl-msg { color: #1e293b; }
[data-theme="light"] .tl-connector { background: rgba(0,0,0,0.08); }
[data-theme="light"] .tl-icon-btn { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); color:var(--ct-muted); }
[data-theme="light"] .tl-body { scrollbar-color:var(--ct-secondary) transparent; }
</style>
