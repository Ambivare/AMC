<template>
  <div class="da-page" :data-theme="theme">

    <!-- ACCESS DENIED -->
    <div v-if="!isAdmin" class="da-denied">
      <div class="denied-card">
        <ShieldOff :size="48" style="color:#f87171;margin-bottom:16px;" />
        <h2>Access Denied</h2>
        <p>This page is restricted to admin accounts only.</p>
        <a href="/dashboard" class="da-btn-sec" style="margin-top:20px;display:inline-block;text-decoration:none;">← Back to Dashboard</a>
      </div>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="da-header">
        <div>
          <div class="da-logo">
            <Trash2 :size="20" style="color:#f87171;" /> Data Manager
          </div>
          <div class="da-sub">Firebase admin tool — S.K Elevators</div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <span class="da-badge-admin">Admin</span>
          <a href="/dashboard" class="da-btn-sec" style="text-decoration:none;">← Dashboard</a>
        </div>
      </div>

      <!-- Warning banner -->
      <div class="da-warning">
        <AlertTriangle :size="18" style="flex-shrink:0;" />
        <span><strong>Danger Zone.</strong> All deletions are permanent and cannot be undone. Proceed with extreme caution.</span>
      </div>

      <!-- Global stats bar -->
      <div class="da-stats-bar">
        <div class="da-stat"><span class="da-stat-val">{{ Object.keys(Collections).length }}</span> Collections</div>
        <div class="da-stat-sep" />
        <div class="da-stat"><span class="da-stat-val">{{ totalDocs }}</span> Docs loaded</div>
        <div class="da-stat-sep" />
        <div class="da-stat"><span class="da-stat-val">{{ storageFolders.length }}</span> Storage folders</div>
        <div class="da-stat-sep" />
        <div class="da-stat"><span class="da-stat-val">{{ totalFiles }}</span> Files loaded</div>
      </div>

      <!-- ═══════════════════════════════════════════
           FIRESTORE SECTION
      ═══════════════════════════════════════════ -->
      <div class="da-section-hdr">
        <div class="da-section-title">
          <Database :size="16" /> Firestore Collections
        </div>
        <button class="da-btn-sec da-btn-sm" @click="loadAllCollections" :disabled="loadingAll">
          <RefreshCw :size="13" :class="{ spin: loadingAll }" />
          {{ loadingAll ? 'Loading…' : 'Load All' }}
        </button>
      </div>

      <div class="da-grid">
        <div
          v-for="col in fsCollections"
          :key="col.name"
          class="da-card"
          :class="{ expanded: col.open }"
        >
          <!-- Card header -->
          <div class="da-card-hdr" @click="toggleCollection(col)">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
              <ChevronRight :size="15" style="flex-shrink:0;color:var(--da-muted);transition:transform 0.2s;"
                :style="{ transform: col.open ? 'rotate(90deg)' : '' }" />
              <div>
                <div class="da-col-name">{{ col.name }}</div>
                <div class="da-col-key">{{ col.label }}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;" @click.stop>
              <span v-if="col.docs !== null" class="da-count-badge">{{ col.docs.length }} docs</span>
              <span v-else-if="col.loading" class="da-loading-dot">…</span>
              <button class="da-btn-load da-btn-sm" @click.stop="loadCollection(col)" :disabled="col.loading">
                <RefreshCw :size="11" :class="{ spin: col.loading }" />
              </button>
              <button
                class="da-btn-danger da-btn-sm"
                :disabled="!col.docs?.length || col.deleting"
                @click.stop="confirmDeleteAll('collection', col)"
              >
                <Trash2 :size="11" /> Delete All
              </button>
            </div>
          </div>

          <!-- Expanded docs list -->
          <div v-if="col.open && col.docs !== null" class="da-doc-list">
            <div v-if="!col.docs.length" class="da-empty">No documents in this collection.</div>
            <div
              v-for="docu in col.docs"
              :key="docu.id"
              class="da-doc-row"
            >
              <div class="da-doc-id">{{ docu.id }}</div>
              <div class="da-doc-fields">
                <span v-for="(val, key) in docu._preview" :key="key" class="da-field">
                  <span class="da-field-key">{{ key }}</span>
                  <span class="da-field-val">{{ val }}</span>
                </span>
              </div>
              <button class="da-btn-danger da-btn-xs" @click="confirmDeleteDoc(col, docu)" :disabled="docu._deleting">
                <Trash2 :size="10" />
              </button>
            </div>
            <div v-if="col.docs.length > 50" class="da-truncated">
              Showing {{ col.docs.length }} documents
            </div>
          </div>
          <div v-else-if="col.open && col.loading" class="da-doc-list">
            <div class="da-empty spin-inline"><Loader2 :size="16" class="spin" /> Loading…</div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════
           STORAGE SECTION
      ═══════════════════════════════════════════ -->
      <div class="da-section-hdr" style="margin-top:28px;">
        <div class="da-section-title">
          <HardDrive :size="16" /> Firebase Storage
        </div>
        <button class="da-btn-sec da-btn-sm" @click="loadStorageRoot" :disabled="storageLoading">
          <RefreshCw :size="13" :class="{ spin: storageLoading }" />
          {{ storageLoading ? 'Scanning…' : 'Scan Storage' }}
        </button>
      </div>

      <div v-if="!storageFolders.length && !storageLoading" class="da-empty-section">
        Click "Scan Storage" to list all files and folders.
      </div>

      <div class="da-grid">
        <div
          v-for="folder in storageFolders"
          :key="folder.path"
          class="da-card"
          :class="{ expanded: folder.open }"
        >
          <div class="da-card-hdr" @click="toggleFolder(folder)">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
              <ChevronRight :size="15" style="flex-shrink:0;color:var(--da-muted);transition:transform 0.2s;"
                :style="{ transform: folder.open ? 'rotate(90deg)' : '' }" />
              <div>
                <div class="da-col-name">{{ folder.name }}</div>
                <div class="da-col-key">{{ folder.path }}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;" @click.stop>
              <span v-if="folder.items !== null" class="da-count-badge">{{ folder.items.length }} files</span>
              <span v-else-if="folder.loading" class="da-loading-dot">…</span>
              <button class="da-btn-load da-btn-sm" @click.stop="loadFolder(folder)" :disabled="folder.loading">
                <RefreshCw :size="11" :class="{ spin: folder.loading }" />
              </button>
              <button
                class="da-btn-danger da-btn-sm"
                :disabled="!folder.items?.length || folder.deleting"
                @click.stop="confirmDeleteAll('folder', folder)"
              >
                <Trash2 :size="11" /> Delete All
              </button>
            </div>
          </div>

          <!-- File list -->
          <div v-if="folder.open && folder.items !== null" class="da-doc-list">
            <div v-if="!folder.items.length" class="da-empty">No files in this folder.</div>
            <div
              v-for="file in folder.items"
              :key="file.fullPath"
              class="da-doc-row"
            >
              <div class="da-doc-id" style="word-break:break-all;max-width:280px;">{{ file.name }}</div>
              <div class="da-doc-fields">
                <span class="da-field">
                  <span class="da-field-key">type</span>
                  <span class="da-field-val">{{ fileType(file.name) }}</span>
                </span>
                <span v-if="file.size" class="da-field">
                  <span class="da-field-key">size</span>
                  <span class="da-field-val">{{ formatBytes(file.size) }}</span>
                </span>
              </div>
              <button class="da-btn-danger da-btn-xs" @click="confirmDeleteFile(folder, file)" :disabled="file._deleting">
                <Trash2 :size="10" />
              </button>
            </div>
          </div>
          <div v-else-if="folder.open && folder.loading" class="da-doc-list">
            <div class="da-empty spin-inline"><Loader2 :size="16" class="spin" /> Loading…</div>
          </div>
        </div>
      </div>

    </template>

    <!-- ═══════════════════════════════════════════
         CONFIRM MODAL
    ═══════════════════════════════════════════ -->
    <div v-if="confirm.show" class="da-modal-overlay" @click.self="confirm.show = false">
      <div class="da-modal">
        <div class="da-modal-icon">
          <AlertTriangle :size="28" style="color:#f87171;" />
        </div>
        <h3 class="da-modal-title">{{ confirm.title }}</h3>
        <p class="da-modal-msg">{{ confirm.message }}</p>
        <div v-if="confirm.requiresInput" style="margin-bottom:16px;">
          <div style="font-size:12px;color:var(--da-muted);margin-bottom:6px;">
            Type <strong style="color:#f87171;">{{ confirm.inputExpected }}</strong> to confirm:
          </div>
          <input
            v-model="confirm.inputValue"
            class="da-input"
            :placeholder="confirm.inputExpected"
            autofocus
            @keydown.enter="runConfirm"
          />
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="da-btn-sec" @click="confirm.show = false">Cancel</button>
          <button
            class="da-btn-danger"
            :disabled="confirm.requiresInput && confirm.inputValue !== confirm.inputExpected"
            @click="runConfirm"
          >
            <Trash2 :size="14" /> {{ confirm.actionLabel || 'Delete' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import {
  collection as fsCollection, getDocs, deleteDoc,
  doc, writeBatch,
} from 'firebase/firestore'
import {
  ref as sRef, listAll, deleteObject, getMetadata,
} from 'firebase/storage'
import { db } from '@/firebase/config'
import { storage } from '@/firebase/config'
import { Collections } from '@/firebase/collections'
import {
  Trash2, ShieldOff, AlertTriangle, RefreshCw, Database,
  HardDrive, ChevronRight, Loader2,
} from 'lucide-vue-next'

// ── Auth check ────────────────────────────────────────────────────────────────
const SESSION_KEY = 'me_session_v2'
const session = (() => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
})()
const isAdmin = computed(() => session?.role === 'admin')

// ── Theme (respect app theme) ─────────────────────────────────────────────────
const theme = localStorage.getItem('ct_theme') || 'dark'

// ── Firestore state ───────────────────────────────────────────────────────────
const fsCollections = ref(
  Object.entries(Collections).map(([label, name]) => reactive({
    label, name, docs: null, open: false, loading: false, deleting: false,
  }))
)

const totalDocs = computed(() => fsCollections.value.reduce((s, c) => s + (c.docs?.length || 0), 0))
const loadingAll = ref(false)

async function loadAllCollections() {
  loadingAll.value = true
  for (const col of fsCollections.value) {
    await loadCollection(col)
  }
  loadingAll.value = false
}

async function loadCollection(col) {
  col.loading = true
  try {
    const snap = await getDocs(fsCollection(db, col.name))
    col.docs = snap.docs.map(d => {
      const data = d.data()
      return reactive({
        id: d.id,
        _data: data,
        _preview: buildPreview(data),
        _deleting: false,
      })
    })
    col.open = true
  } catch (e) {
    col.docs = []
  } finally {
    col.loading = false
  }
}

function toggleCollection(col) {
  if (!col.open && col.docs === null) { loadCollection(col); return }
  col.open = !col.open
}

function buildPreview(data) {
  const skip = new Set(['createdAt', 'updatedAt', 'password', 'checkInSelfie', 'checkOutSelfie', 'imageUrl', 'storagePath'])
  const preview = {}
  let count = 0
  for (const [k, v] of Object.entries(data)) {
    if (count >= 5) break
    if (skip.has(k)) continue
    if (v === null || v === undefined) continue
    if (typeof v === 'object' && !Array.isArray(v) && !v?.toDate) continue
    const display = v?.toDate ? v.toDate().toLocaleDateString('en-IN') : Array.isArray(v) ? `[${v.length} items]` : String(v).slice(0, 50)
    preview[k] = display
    count++
  }
  return preview
}

// ── Firestore delete ──────────────────────────────────────────────────────────
async function deleteDocRecord(col, docu) {
  docu._deleting = true
  try {
    await deleteDoc(doc(db, col.name, docu.id))
    col.docs = col.docs.filter(d => d.id !== docu.id)
  } catch (e) {
    alert('Delete failed: ' + e.message)
  } finally {
    docu._deleting = false
  }
}

async function deleteAllInCollection(col) {
  col.deleting = true
  try {
    const snap = await getDocs(fsCollection(db, col.name))
    const batches = []
    let batch = writeBatch(db)
    let count = 0
    for (const d of snap.docs) {
      batch.delete(doc(db, col.name, d.id))
      count++
      if (count % 500 === 0) {
        batches.push(batch.commit())
        batch = writeBatch(db)
        count = 0
      }
    }
    if (count > 0) batches.push(batch.commit())
    await Promise.all(batches)
    col.docs = []
  } catch (e) {
    alert('Delete all failed: ' + e.message)
  } finally {
    col.deleting = false
  }
}

// ── Storage state ─────────────────────────────────────────────────────────────
const storageLoading = ref(false)
const storageFolders = ref([])
const totalFiles = computed(() => storageFolders.value.reduce((s, f) => s + (f.items?.length || 0), 0))

// Known root-level storage prefixes to scan
const KNOWN_STORAGE_ROOTS = [
  'gallery',
  'attendance-selfies',
  'company',
  'uploads',
  'images',
  'files',
]

async function loadStorageRoot() {
  storageLoading.value = true
  storageFolders.value = []
  try {
    // Try listing root first
    const rootRef = sRef(storage, '/')
    let rootResult
    try { rootResult = await listAll(rootRef) } catch { rootResult = null }

    const folderPaths = new Set()

    // Add folders found at root
    if (rootResult?.prefixes) {
      rootResult.prefixes.forEach(p => folderPaths.add(p.fullPath))
    }
    if (rootResult?.items) {
      // root-level files — add as a pseudo-folder
      if (rootResult.items.length) folderPaths.add('__root__')
    }

    // Also probe known paths
    for (const known of KNOWN_STORAGE_ROOTS) {
      try {
        const r = await listAll(sRef(storage, known))
        if (r.items.length || r.prefixes.length) folderPaths.add(known)
      } catch { /* folder doesn't exist */ }
    }

    storageFolders.value = [...folderPaths].map(path => reactive({
      path,
      name: path === '__root__' ? '/ (root)' : path,
      items: null,
      open: false,
      loading: false,
      deleting: false,
    }))
  } catch (e) {
    alert('Storage scan failed: ' + e.message)
  } finally {
    storageLoading.value = false
  }
}

async function loadFolder(folder) {
  folder.loading = true
  try {
    const allItems = []
    if (folder.path === '__root__') {
      const r = await listAll(sRef(storage, '/'))
      for (const item of r.items) {
        let size = null
        try { const meta = await getMetadata(item); size = meta.size } catch {}
        allItems.push(reactive({ name: item.name, fullPath: item.fullPath, ref: item, size, _deleting: false }))
      }
    } else {
      await collectFilesRecursive(sRef(storage, folder.path), allItems)
    }
    folder.items = allItems
    folder.open = true
  } catch (e) {
    folder.items = []
    folder.open = true
  } finally {
    folder.loading = false
  }
}

async function collectFilesRecursive(folderRef, result) {
  const listResult = await listAll(folderRef)
  for (const item of listResult.items) {
    let size = null
    try { const meta = await getMetadata(item); size = meta.size } catch {}
    result.push(reactive({ name: item.name, fullPath: item.fullPath, ref: item, size, _deleting: false }))
  }
  for (const prefix of listResult.prefixes) {
    await collectFilesRecursive(prefix, result)
  }
}

function toggleFolder(folder) {
  if (!folder.open && folder.items === null) { loadFolder(folder); return }
  folder.open = !folder.open
}

// ── Storage delete ────────────────────────────────────────────────────────────
async function deleteFile(folder, file) {
  file._deleting = true
  try {
    await deleteObject(file.ref)
    folder.items = folder.items.filter(f => f.fullPath !== file.fullPath)
  } catch (e) {
    alert('Delete failed: ' + e.message)
  } finally {
    file._deleting = false
  }
}

async function deleteAllInFolder(folder) {
  folder.deleting = true
  try {
    if (!folder.items || !folder.items.length) {
      await collectFilesRecursive(sRef(storage, folder.path === '__root__' ? '/' : folder.path), folder.items = [])
    }
    await Promise.all(folder.items.map(f => deleteObject(f.ref).catch(() => {})))
    folder.items = []
  } catch (e) {
    alert('Delete all failed: ' + e.message)
  } finally {
    folder.deleting = false
  }
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
const confirm = reactive({
  show: false,
  title: '',
  message: '',
  actionLabel: 'Delete',
  requiresInput: false,
  inputExpected: '',
  inputValue: '',
  onConfirm: null,
})

function showConfirm({ title, message, requiresInput, inputExpected, actionLabel, onConfirm }) {
  confirm.title         = title
  confirm.message       = message
  confirm.requiresInput = !!requiresInput
  confirm.inputExpected = inputExpected || ''
  confirm.inputValue    = ''
  confirm.actionLabel   = actionLabel || 'Delete'
  confirm.onConfirm     = onConfirm
  confirm.show          = true
}

function runConfirm() {
  if (confirm.requiresInput && confirm.inputValue !== confirm.inputExpected) return
  confirm.show = false
  confirm.onConfirm?.()
}

function confirmDeleteDoc(col, docu) {
  showConfirm({
    title:    'Delete Document',
    message:  `Delete document "${docu.id}" from "${col.name}"? This is permanent.`,
    onConfirm: () => deleteDocRecord(col, docu),
  })
}

function confirmDeleteAll(type, target) {
  const isCol = type === 'collection'
  showConfirm({
    title:         `Delete ALL in "${target.name}"`,
    message:       isCol
      ? `This will permanently delete ALL ${target.docs?.length || 'all'} documents in the "${target.name}" collection. This cannot be undone.`
      : `This will permanently delete ALL ${target.items?.length || 'all'} files in the "${target.name}" folder. This cannot be undone.`,
    requiresInput:  true,
    inputExpected:  target.name,
    actionLabel:    'Delete All',
    onConfirm:      isCol ? () => deleteAllInCollection(target) : () => deleteAllInFolder(target),
  })
}

function confirmDeleteFile(folder, file) {
  showConfirm({
    title:    'Delete File',
    message:  `Delete "${file.name}"? This is permanent.`,
    onConfirm: () => deleteFile(folder, file),
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fileType(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  const map = { jpg: 'Image', jpeg: 'Image', png: 'Image', gif: 'Image', webp: 'Image', pdf: 'PDF', xlsx: 'Excel', csv: 'CSV', json: 'JSON', mp4: 'Video', mov: 'Video' }
  return map[ext] || ext?.toUpperCase() || 'File'
}

function formatBytes(b) {
  if (!b) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}
</script>

<style>
/* ── Page-level reset (standalone page, no AppShell) ──────────────────────── */
:root {
  --da-bg:      #08080f;
  --da-surface: #0f0f1e;
  --da-border:  rgba(255,255,255,0.06);
  --da-primary: #e2e8f0;
  --da-sub:     #94a3b8;
  --da-muted:   #475569;
  --da-accent:  #818cf8;
  --da-danger:  #f87171;
  --da-danger-bg: rgba(248,113,113,0.08);
  --da-danger-border: rgba(248,113,113,0.25);
}
[data-theme="light"] {
  --da-bg:      #f1f5f9;
  --da-surface: #ffffff;
  --da-border:  rgba(0,0,0,0.08);
  --da-primary: #1e293b;
  --da-sub:     #475569;
  --da-muted:   #94a3b8;
}
</style>

<style scoped>
.da-page {
  min-height: 100vh;
  background: var(--da-bg);
  color: var(--da-primary);
  font-family: system-ui, -apple-system, sans-serif;
  padding: 0 0 48px;
}

/* Access denied */
.da-denied {
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center; padding: 24px;
  background: var(--da-bg);
}
.denied-card {
  background: var(--da-surface);
  border: 1px solid var(--da-border);
  border-radius: 20px;
  padding: 40px 36px;
  text-align: center;
  max-width: 380px;
}
.denied-card h2 { font-size: 22px; font-weight: 800; color: #f87171; margin: 0 0 10px; }
.denied-card p  { font-size: 14px; color: var(--da-sub); margin: 0; }

/* Header */
.da-header {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 12px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--da-border);
  background: var(--da-surface);
}
.da-logo {
  display: flex; align-items: center; gap: 10px;
  font-size: 17px; font-weight: 800; color: var(--da-primary);
}
.da-sub { font-size: 12px; color: var(--da-muted); margin-top: 3px; }

.da-badge-admin {
  background: rgba(248,113,113,0.12);
  border: 1px solid rgba(248,113,113,0.3);
  color: #f87171;
  font-size: 10px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; padding: 4px 10px; border-radius: 99px;
}

/* Warning */
.da-warning {
  display: flex; align-items: flex-start; gap: 12px;
  margin: 16px 24px;
  padding: 14px 18px;
  background: rgba(248,113,113,0.07);
  border: 1px solid rgba(248,113,113,0.22);
  border-radius: 12px;
  font-size: 13px; color: #fca5a5;
  line-height: 1.5;
}

/* Stats bar */
.da-stats-bar {
  display: flex; align-items: center; gap: 0;
  margin: 0 24px 20px;
  background: var(--da-surface);
  border: 1px solid var(--da-border);
  border-radius: 12px;
  padding: 12px 20px;
  flex-wrap: wrap; gap: 0;
}
.da-stat { font-size: 12px; color: var(--da-sub); padding: 0 16px 0 0; }
.da-stat:first-child { padding-left: 0; }
.da-stat-val { font-size: 18px; font-weight: 800; color: var(--da-primary); display: block; margin-bottom: 1px; }
.da-stat-sep { width: 1px; height: 28px; background: var(--da-border); margin: 0 16px 0 0; flex-shrink: 0; }

/* Section header */
.da-section-hdr {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px 12px;
}
.da-section-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .07em;
  color: var(--da-muted);
}

/* Grid of cards */
.da-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 10px;
  padding: 0 24px;
}
@media (max-width: 600px) { .da-grid { grid-template-columns: 1fr; padding: 0 12px; } }

/* Collection/folder card */
.da-card {
  background: var(--da-surface);
  border: 1px solid var(--da-border);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color 0.15s;
}
.da-card.expanded { border-color: rgba(248,113,113,0.2); }

.da-card-hdr {
  display: flex; align-items: center; gap: 10px;
  padding: 13px 16px;
  cursor: pointer; user-select: none;
  transition: background 0.15s;
}
.da-card-hdr:hover { background: rgba(255,255,255,0.02); }

.da-col-name { font-size: 13px; font-weight: 700; color: var(--da-primary); }
.da-col-key  { font-size: 10px; color: var(--da-muted); margin-top: 2px; font-family: monospace; }

.da-count-badge {
  font-size: 11px; font-weight: 600;
  background: rgba(99,102,241,0.12);
  border: 1px solid rgba(99,102,241,0.25);
  color: var(--da-accent);
  padding: 2px 8px; border-radius: 99px;
  white-space: nowrap;
}
.da-loading-dot { font-size: 14px; color: var(--da-muted); }

/* Doc list */
.da-doc-list {
  border-top: 1px solid var(--da-border);
  max-height: 360px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.1) transparent;
}
.da-doc-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--da-border);
  transition: background 0.1s;
}
.da-doc-row:last-child { border-bottom: none; }
.da-doc-row:hover { background: rgba(255,255,255,0.02); }

.da-doc-id {
  font-family: monospace;
  font-size: 10px; color: var(--da-accent);
  flex-shrink: 0; max-width: 100px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.da-doc-fields { flex: 1; display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.da-field {
  display: flex; align-items: center; gap: 4px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--da-border);
  border-radius: 6px; padding: 2px 7px;
  max-width: 200px; overflow: hidden;
}
.da-field-key { font-size: 9px; font-weight: 700; color: var(--da-muted); text-transform: uppercase; flex-shrink: 0; }
.da-field-val { font-size: 10px; color: var(--da-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.da-truncated { padding: 8px 14px; font-size: 11px; color: var(--da-muted); text-align: center; }
.da-empty { padding: 20px; text-align: center; font-size: 12px; color: var(--da-muted); }
.da-empty-section { padding: 0 24px 16px; font-size: 13px; color: var(--da-muted); }
.spin-inline { display: flex; align-items: center; gap: 8px; }

/* Buttons */
.da-btn-danger {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--da-danger-bg);
  border: 1px solid var(--da-danger-border);
  color: var(--da-danger);
  border-radius: 8px; padding: 6px 12px;
  font-size: 12px; font-weight: 600; cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.da-btn-danger:hover:not(:disabled) { background: rgba(248,113,113,0.16); }
.da-btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }

.da-btn-sec {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--da-border);
  color: var(--da-sub);
  border-radius: 8px; padding: 7px 14px;
  font-size: 12px; font-weight: 500; cursor: pointer;
  transition: background 0.15s;
}
.da-btn-sec:hover { background: rgba(255,255,255,0.09); color: var(--da-primary); }
.da-btn-sec:disabled { opacity: 0.5; cursor: wait; }

.da-btn-load {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  background: rgba(99,102,241,0.08);
  border: 1px solid rgba(99,102,241,0.2);
  color: var(--da-accent);
  border-radius: 7px; cursor: pointer;
  transition: background 0.15s;
}
.da-btn-load:hover { background: rgba(99,102,241,0.16); }
.da-btn-load:disabled { opacity: 0.4; cursor: wait; }

.da-btn-sm  { padding: 5px 10px !important; font-size: 11px !important; }
.da-btn-xs  { padding: 4px 8px !important; font-size: 10px !important; border-radius: 6px !important; }

/* Confirm modal */
.da-modal-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.da-modal {
  background: var(--da-surface);
  border: 1px solid rgba(248,113,113,0.3);
  border-radius: 18px;
  padding: 28px 28px 24px;
  width: 100%; max-width: 420px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.7);
}
.da-modal-icon { text-align: center; margin-bottom: 14px; }
.da-modal-title {
  font-size: 17px; font-weight: 800; color: var(--da-primary);
  text-align: center; margin: 0 0 10px;
}
.da-modal-msg {
  font-size: 13px; color: var(--da-sub); line-height: 1.6;
  text-align: center; margin: 0 0 18px;
}
.da-input {
  width: 100%; box-sizing: border-box;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--da-border);
  border-radius: 10px; padding: 10px 14px;
  font-size: 13px; color: var(--da-primary);
  outline: none; transition: border-color 0.15s;
}
.da-input:focus { border-color: rgba(248,113,113,0.4); }

/* Spinner */
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Scrollbar */
.da-doc-list::-webkit-scrollbar { width: 4px; }
.da-doc-list::-webkit-scrollbar-track { background: transparent; }
.da-doc-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
</style>
