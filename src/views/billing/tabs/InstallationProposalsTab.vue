<template>
  <div>
    <!-- Toolbar -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
      <div class="search-box" style="flex:1;min-width:220px;">
        <Search :size="14" class="search-icon" />
        <input v-model="search" class="input" placeholder="Search proposals…" />
      </div>
      <button class="btn-primary" @click="openAdd">
        <Plus :size="16" /> New Installation Proposal
      </button>
    </div>

    <DataTable
      :columns="columns"
      :rows="pagedItems"
      :loading="loading"
      :total="filtered.length"
      :page="page"
      :pageSize="pageSize"
      empty-text="No installation proposals found."
      :on-row-click="openEdit"
      @page="page = $event"
    >
      <template #default="{ row }">
        <td>
          <div style="font-weight:500;color:var(--ct-primary);">{{ row.proposalNo || '—' }}</div>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ formatDate(row.date) }}</div>
        </td>
        <td>
          <div class="db-s" style="color:var(--ct-sub);">{{ row.projectId ? getProjectName(row.projectId) : row.clientName }}</div>
          <div class="db-s" style="font-size:11px;color:var(--ct-muted);">{{ row.city || '—' }}</div>
        </td>
        <td>
          <div style="color:var(--ct-accent);font-weight:600;">{{ formatCurrency(rowTotal(row)) }}</div>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ (row.items || []).length }} item{{ (row.items || []).length === 1 ? '' : 's' }}</div>
        </td>
        <td><span :class="['badge', statusBadge(row.status)]">{{ row.status || 'draft' }}</span></td>
        <td @click.stop>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn-secondary btn-sm" @click="openEdit(row)"><Pencil :size="12" /></button>
            <button class="btn-success btn-sm" :disabled="pdfSavingToDownloads[row.id]" @click="downloadPDFToDownloads(row)" title="Download PDF">
              <Loader2 v-if="pdfSavingToDownloads[row.id]" :size="12" class="spin" />
              <FileDown v-else :size="12" />
            </button>
            <button class="btn-danger btn-sm" @click="confirmDel(row)"><Trash2 :size="12" /></button>
          </div>
        </td>
      </template>
    </DataTable>

    <!-- Add/Edit Modal -->
    <AppModal v-model="showModal" :title="editing ? 'Edit Installation Proposal' : 'New Installation Proposal'" width="880px">
      <div class="form-grid" style="margin-bottom:20px;">
        <!-- Project Link Toggle -->
        <div class="form-group form-full" style="margin-bottom:4px;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;background:rgba(99,102,241,0.12);border-radius:9px;display:flex;align-items:center;justify-content:center;color:var(--ct-accent);">
                <FolderOpen :size="16" />
              </div>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--ct-primary);">Link to Project</div>
                <div style="font-size:11px;color:var(--ct-muted);">Auto-fill client details from an existing project</div>
              </div>
            </div>
            <button type="button" @click="useProject = !useProject"
              :style="`width:44px;height:24px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${useProject ? '#6366f1' : 'rgba(255,255,255,0.12)'};position:relative;`">
              <span :style="`position:absolute;top:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:all .2s;left:${useProject ? '23px' : '3px'};`"></span>
            </button>
          </div>
        </div>
        <div v-if="useProject" class="form-group form-full">
          <label class="label">Select Project</label>
          <div style="position:relative;">
            <input v-model="projectSearch" class="input" placeholder="Search project name…"
              @focus="showProjectDropdown = true" @blur="delayCloseDropdown" />
            <div v-if="showProjectDropdown && filteredProjects.length" class="proj-dd" style="position:absolute;top:100%;left:0;right:0;border-radius:8px;z-index:200;max-height:200px;overflow-y:auto;margin-top:4px;">
              <div v-for="p in filteredProjects" :key="p.id" @mousedown.prevent="selectProject(p)"
                class="proj-dd-item" style="padding:10px 14px;cursor:pointer;font-size:13px;"
                :style="form.projectId === p.id ? 'background:rgba(99,102,241,0.15);' : ''">
                <div>{{ p.projectName }}</div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ p.clientName }} · {{ p.city || p.address || '—' }}</div>
              </div>
            </div>
          </div>
          <div v-if="form.projectId" style="margin-top:6px;font-size:12px;color:var(--ct-green);">✓ Project linked — client details auto-filled below</div>
        </div>

        <div class="form-group">
          <label class="label">Proposal Number</label>
          <div style="display:flex;gap:6px;">
            <input v-model="form.proposalNo" class="input" placeholder="IP-001" style="flex:1;min-width:0;" />
            <button type="button" class="btn-secondary btn-sm" style="flex-shrink:0;" @click="generateProposalNumber" title="Generate proposal number">
              <Wand2 :size="12" />
            </button>
          </div>
        </div>
        <div class="form-group">
          <label class="label">Date</label>
          <input v-model="form.date" class="input" type="date" />
        </div>
        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Number of Lifts</label>
          <input v-model.number="form.numberOfLifts" class="input" type="number" min="1" />
        </div>
        <div class="form-group">
          <label class="label">Client Name *</label>
          <input v-model="form.clientName" class="input" placeholder="Client / Company"
            :readonly="useProject && !!form.projectId" :style="useProject && form.projectId ? 'opacity:.8;' : ''" />
        </div>
        <div class="form-group">
          <label class="label">Contact Person</label>
          <input v-model="form.contactPerson" class="input" placeholder="Name of contact person" />
        </div>
        <div class="form-group form-full">
          <label class="label">Client Address</label>
          <textarea v-model="form.clientAddress" class="input" rows="2" placeholder="Address…"
            :readonly="useProject && !!form.projectId" :style="useProject && form.projectId ? 'opacity:.8;' : ''"></textarea>
        </div>
        <div class="form-group">
          <label class="label">City / Project Location</label>
          <input v-model="form.city" class="input" placeholder="e.g. Pune" />
        </div>
        <div class="form-group">
          <label class="label">Phone</label>
          <input v-model="form.clientPhone" class="input" placeholder="+91 98765 43210"
            :readonly="useProject && !!form.projectId" :style="useProject && form.projectId ? 'opacity:.8;' : ''" />
        </div>
      </div>

      <!-- Lift Specification Remarks -->
      <div style="margin-bottom:18px;">
        <div style="font-size:12px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">
          Lift Specification — Remarks Only (rest is fixed)
        </div>
        <div class="glass" style="border-radius:12px;overflow:hidden;max-height:260px;overflow-y:auto;">
          <div v-for="(it, i) in LIFT_SPEC_ITEMS" :key="i" class="spec-row">
            <span class="spec-idx">{{ i + 1 }}</span>
            <span class="spec-label">{{ it.label }}</span>
            <span class="spec-value">{{ it.spec }}</span>
            <input v-model="form.liftSpecRemarks[i]" class="input spec-remark" placeholder="Remarks" />
          </div>
        </div>
      </div>

      <!-- Elevator Specification & Pricing -->
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:12px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;">Specification of Elevator(s) &amp; Pricing</div>
          <button class="btn-secondary btn-sm" @click="addItem"><Plus :size="12" /> Add Item</button>
        </div>
        <div class="glass" style="border-radius:12px;overflow:hidden;">
          <div class="li-header">
            <span class="li-desc">Specification of Elevator</span>
            <span class="li-qty">Qty</span>
            <span class="li-rate">Rate / Unit (₹)</span>
            <span class="li-amt">Amount (₹)</span>
            <span style="width:36px;flex-shrink:0;"></span>
          </div>
          <div v-for="(item, i) in form.items" :key="i" class="li-row">
            <div class="li-field li-desc"><textarea v-model="item.description" class="input li-input" rows="3" placeholder="Elevator specification…"></textarea></div>
            <div class="li-field li-qty"><input v-model.number="item.qty" class="input li-input" type="number" min="0" step="1" /></div>
            <div class="li-field li-rate"><input v-model.number="item.rate" class="input li-input" type="number" min="0" /></div>
            <div class="li-field li-amt"><input :value="formatCurrency((item.qty || 0) * (item.rate || 0))" class="input li-input li-amt-input" readonly /></div>
            <button class="btn-danger btn-sm btn-icon li-del" @click="removeItem(i)"><Trash2 :size="13" /></button>
          </div>
        </div>
      </div>

      <!-- GST Toggle -->
      <div class="form-group form-full" style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.18);border-radius:10px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <Tag :size="14" style="color:#f59e0b;" />
            <span style="font-size:13px;font-weight:600;color:var(--ct-primary);">GST @ Extra (as per Price Schedule note)</span>
          </div>
          <button type="button" @click="form.gstEnabled = !form.gstEnabled"
            :style="`width:40px;height:22px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${form.gstEnabled ? '#f59e0b' : 'rgba(255,255,255,0.12)'};position:relative;`">
            <span :style="`position:absolute;top:2px;width:18px;height:18px;background:#fff;border-radius:50%;transition:all .2s;left:${form.gstEnabled ? '20px' : '2px'};`"></span>
          </button>
        </div>
        <div v-if="form.gstEnabled" style="margin-top:8px;max-width:200px;">
          <label class="label">GST %</label>
          <select v-model.number="form.gstPercent" class="input">
            <option :value="0">0%</option>
            <option :value="5">5%</option>
            <option :value="12">12%</option>
            <option :value="18">18%</option>
          </select>
        </div>
      </div>

      <!-- Totals preview -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:20px;">
        <div class="glass" style="padding:14px 18px;border-radius:12px;min-width:240px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;">
            <span style="color:var(--ct-muted);">Subtotal</span>
            <span style="color:var(--ct-sub);">{{ formatCurrency(subtotal) }}</span>
          </div>
          <div v-if="form.gstEnabled" style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;">
            <span style="color:var(--ct-muted);">GST ({{ form.gstPercent }}%)</span>
            <span style="color:var(--ct-sub);">{{ formatCurrency(gstAmount) }}</span>
          </div>
          <hr class="divider" style="margin:6px 0;" />
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;">
            <span style="color:var(--ct-primary);">Total</span>
            <span style="color:var(--ct-accent);">{{ formatCurrency(total) }}</span>
          </div>
        </div>
      </div>

      <!-- Client Scope Work -->
      <div style="margin-bottom:18px;">
        <div style="font-size:12px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Client Scope Work</div>
        <div class="glass" style="border-radius:12px;overflow:hidden;">
          <div v-for="(s, i) in form.clientScope" :key="i" class="scope-row">
            <span class="scope-label">{{ s.label }}</span>
            <select v-model="s.value" class="input scope-yn">
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
            <input v-model="s.remarks" class="input scope-remark" placeholder="Remarks" />
          </div>
        </div>
      </div>

      <!-- Payment Split -->
      <div style="margin-bottom:6px;">
        <div style="font-size:12px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Payment Terms Split (%)</div>
        <div style="display:flex;gap:10px;">
          <div style="flex:1;">
            <label class="label">Against Order Booking</label>
            <input v-model.number="form.paymentSplit.adv" class="input" type="number" min="0" max="100" />
          </div>
          <div style="flex:1;">
            <label class="label">Before Dispatch</label>
            <input v-model.number="form.paymentSplit.dispatch" class="input" type="number" min="0" max="100" />
          </div>
          <div style="flex:1;">
            <label class="label">After Completion</label>
            <input v-model.number="form.paymentSplit.completion" class="input" type="number" min="0" max="100" />
          </div>
        </div>
        <div v-if="paymentSplitTotal !== 100" style="font-size:11px;color:#f59e0b;margin-top:6px;">Split totals {{ paymentSplitTotal }}% — typically should add up to 100%.</div>
      </div>

      <template #footer>
        <button class="btn-secondary" @click="showModal = false">Cancel</button>
        <button class="btn-primary" :disabled="saving" @click="save">
          <Save :size="14" /> {{ saving ? 'Saving…' : (editing ? 'Update' : 'Create Proposal') }}
        </button>
      </template>
    </AppModal>

    <ConfirmDialog ref="confirmRef" title="Delete Installation Proposal" @confirm="doDelete" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Plus, Search, Pencil, Trash2, Save, FileDown, FolderOpen, Tag, Loader2, Wand2 } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import { useCollection } from '@/composables/useCollection'
import { useUIStore } from '@/stores/ui'
import { Collections } from '@/firebase/collections'
import { generateOrGetPdf, downloadPdfToDownloads } from '@/composables/usePdfApiService'
import { getHeaderImgDataUri, getFooterImgDataUri, getStampDataUri } from '@/utils/pdfLogo'
import {
  LIFT_SPEC_ITEMS, DEFAULT_LIFT_SPEC_REMARKS, CLIENT_SCOPE_WORK_ITEMS,
  DEFAULT_ELEVATOR_ITEM, renderInstallationProposalHtml,
} from '@/utils/installationProposalTemplate'

const ui = useUIStore()
const { items, loading, add, edit, del } = useCollection(Collections.INSTALLATION_PROPOSALS)
const { items: allProjects } = useCollection(Collections.PROJECTS)

// ── Project Link ─────────────────────────────────────────────────────
const useProject = ref(false)
const projectSearch = ref('')
const showProjectDropdown = ref(false)

const filteredProjects = computed(() => {
  const q = projectSearch.value.toLowerCase()
  return allProjects.value.filter(p =>
    (p.projectName || '').toLowerCase().includes(q) || (p.clientName || '').toLowerCase().includes(q)
  )
})

function selectProject(p) {
  form.value.projectId = p.id
  projectSearch.value = p.projectName
  showProjectDropdown.value = false
  form.value.projectName = p.projectName || ''
  form.value.clientName = p.clientName || ''
  form.value.clientPhone = p.phone || p.clientPhone || ''
  form.value.clientAddress = p.address || p.clientAddress || ''
  form.value.city = p.city || form.value.city
}
function delayCloseDropdown() { setTimeout(() => { showProjectDropdown.value = false }, 200) }
function getProjectName(projectId) {
  if (!projectId) return ''
  return allProjects.value.find(p => p.id === projectId)?.projectName || ''
}

// ── Table & Filtering ─────────────────────────────────────────────────
const search = ref('')
const page = ref(1)
const pageSize = 20

const filtered = computed(() => {
  let list = items.value
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(r => r.proposalNo?.toLowerCase().includes(q) || r.clientName?.toLowerCase().includes(q) || getProjectName(r.projectId)?.toLowerCase().includes(q))
  }
  return list
})
const pagedItems = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch(search, () => { page.value = 1 })

const columns = [
  { key: 'proposalNo', label: 'Proposal #' },
  { key: 'client', label: 'Client' },
  { key: 'total', label: 'Total / Items', width: '130px' },
  { key: 'status', label: 'Status', width: '110px' },
  { key: 'actions', label: 'Actions', width: '150px' },
]

function statusBadge(s) {
  const m = { draft: 'badge-inactive', sent: 'badge-info', accepted: 'badge-active', rejected: 'badge-danger' }
  return m[s] || 'badge-inactive'
}
function formatDate(ts) {
  if (!ts) return '—'
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}
function formatCurrency(v) {
  if (!v && v !== 0) return '—'
  return '₹' + Number(v).toLocaleString('en-IN')
}
function rowTotal(row) {
  const subtotal = (row.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0)
  const gst = row.gstEnabled ? Math.round(subtotal * (Number(row.gstPercent) || 0) / 100) : 0
  return subtotal + gst
}

// ── Form ─────────────────────────────────────────────────────────────
const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)
const pdfSavingToDownloads = ref({})

function defaultForm() {
  const today = new Date()
  return {
    projectId: '', projectName: '',
    proposalNo: '', date: today.toISOString().split('T')[0],
    status: 'draft',
    clientName: '', clientAddress: '', contactPerson: '', clientPhone: '', clientEmail: '', city: '',
    numberOfLifts: 1,
    liftSpecRemarks: [...DEFAULT_LIFT_SPEC_REMARKS],
    items: [DEFAULT_ELEVATOR_ITEM()],
    gstEnabled: true, gstPercent: 18,
    clientScope: CLIENT_SCOPE_WORK_ITEMS.map(i => ({ label: i.label, value: i.default, remarks: '' })),
    paymentSplit: { adv: 60, dispatch: 30, completion: 10 },
  }
}
const form = ref(defaultForm())

const subtotal = computed(() => form.value.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0))
const gstAmount = computed(() => form.value.gstEnabled ? Math.round(subtotal.value * (form.value.gstPercent || 0) / 100) : 0)
const total = computed(() => subtotal.value + gstAmount.value)
const paymentSplitTotal = computed(() => (Number(form.value.paymentSplit.adv) || 0) + (Number(form.value.paymentSplit.dispatch) || 0) + (Number(form.value.paymentSplit.completion) || 0))

function addItem() { form.value.items.push(DEFAULT_ELEVATOR_ITEM()) }
function removeItem(i) { form.value.items.splice(i, 1) }

function generateProposalNumber() {
  const today = new Date()
  const dd = String(today.getDate()).padStart(2, '0')
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  form.value.proposalNo = `IP/${today.getFullYear()}/${mm}${dd}/${String(items.value.length + 1).padStart(3, '0')}`
}

function openAdd() {
  editing.value = null
  form.value = defaultForm()
  useProject.value = false
  projectSearch.value = ''
  generateProposalNumber()
  showModal.value = true
}

function openEdit(row) {
  editing.value = row
  form.value = {
    ...defaultForm(), ...row,
    liftSpecRemarks: row.liftSpecRemarks?.length ? [...row.liftSpecRemarks] : [...DEFAULT_LIFT_SPEC_REMARKS],
    items: row.items?.length ? row.items.map(i => ({ ...i })) : [DEFAULT_ELEVATOR_ITEM()],
    clientScope: row.clientScope?.length ? row.clientScope.map(s => ({ ...s })) : CLIENT_SCOPE_WORK_ITEMS.map(i => ({ label: i.label, value: i.default, remarks: '' })),
    paymentSplit: row.paymentSplit ? { ...row.paymentSplit } : { adv: 60, dispatch: 30, completion: 10 },
  }
  useProject.value = !!row.projectId
  projectSearch.value = row.projectId ? (allProjects.value.find(p => p.id === row.projectId)?.projectName || '') : ''
  showModal.value = true
}

async function save() {
  if (!form.value.clientName) { ui.error('Client name is required.'); return }
  saving.value = true
  try {
    const data = { ...form.value, updatedAt: new Date() }
    if (editing.value) {
      await edit(editing.value.id, data, { action: 'updated', module: 'installationProposals', tab: 'Billing', summary: `Updated Installation Proposal ${data.proposalNo} for ${data.clientName}` })
      ui.success('Installation proposal updated.')
    } else {
      data.createdAt = new Date()
      await add(data, { action: 'created', module: 'installationProposals', tab: 'Billing', summary: `Created Installation Proposal ${data.proposalNo} for ${data.clientName}` })
      ui.success('Installation proposal created.')
    }
    showModal.value = false
  } catch { ui.error('Failed to save installation proposal.') }
  finally { saving.value = false }
}

const confirmRef = ref(null)
const deleteTarget = ref(null)
function confirmDel(row) { deleteTarget.value = row; confirmRef.value?.open(`Delete ${row.proposalNo}? This cannot be undone.`) }
async function doDelete() {
  try { await del(deleteTarget.value.id, { action: 'deleted', module: 'installationProposals', tab: 'Billing', summary: 'Deleted installation proposal' }); ui.success('Installation proposal deleted.') }
  catch { ui.error('Failed to delete.') }
}

async function resolveProposalPdfUrl(row) {
  const [headerImg, footerImg, stampImg] = await Promise.all([getHeaderImgDataUri(), getFooterImgDataUri(), getStampDataUri()])
  const html = renderInstallationProposalHtml(row, headerImg, footerImg, stampImg)
  const filename = `${row.proposalNo || 'Installation-Proposal'}.pdf`
  const url = await generateOrGetPdf(row, 'installationProposal', html, filename)
  return { url, filename }
}

async function downloadPDFToDownloads(row) {
  if (pdfSavingToDownloads.value[row.id]) return
  pdfSavingToDownloads.value[row.id] = true
  try {
    const { url, filename } = await resolveProposalPdfUrl(row)
    await downloadPdfToDownloads(url, filename, ui)
  } catch (e) {
    ui.error(e?.message || 'PDF generation failed. Please try again.')
  } finally {
    pdfSavingToDownloads.value[row.id] = false
  }
}
</script>

<style scoped>
.proj-dd { background: var(--ct-card, #1e293b); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
[data-theme="light"] .proj-dd { background: #ffffff; border-color: #e2e8f0; }
.proj-dd-item { color: var(--ct-primary); border-bottom: 1px solid rgba(255,255,255,0.05); }
[data-theme="light"] .proj-dd-item { border-bottom-color: #f1f5f9; }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.spec-row { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 12px; }
.spec-idx { width: 22px; flex-shrink: 0; color: var(--ct-muted); }
.spec-label { width: 150px; flex-shrink: 0; font-weight: 600; color: var(--ct-primary); }
.spec-value { flex: 1; color: var(--ct-sub); }
.spec-remark { width: 160px; flex-shrink: 0; font-size: 12px !important; padding: 6px 10px !important; }
[data-theme="light"] .spec-row { border-bottom-color: #f1f5f9; }

.scope-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.scope-label { flex: 1; font-size: 13px; color: var(--ct-primary); }
.scope-yn { width: 90px; flex-shrink: 0; }
.scope-remark { width: 220px; flex-shrink: 0; }
[data-theme="light"] .scope-row { border-bottom-color: #f1f5f9; }

/* ── Line items layout (mirrors QuotationsTab) ── */
.li-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em;
  color: #64748b;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.li-row {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.li-row:last-child { border-bottom: none; }
.li-field { display: flex; flex-direction: column; }
.li-desc { flex: 1; min-width: 0; }
.li-qty  { width: 82px;  flex-shrink: 0; }
.li-rate { width: 130px; flex-shrink: 0; }
.li-amt  { width: 130px; flex-shrink: 0; }
.li-del  { flex-shrink: 0; width: 36px; padding: 7px !important; margin-top: 2px; }
.li-input { font-size: 13px !important; padding: 9px 12px !important; width: 100%; }
.li-amt-input { opacity: .65; }
[data-theme="light"] .li-header { border-bottom-color: #e2e8f0; }
[data-theme="light"] .li-row { border-bottom-color: #f1f5f9; }

@media (max-width: 700px) {
  .li-header { display: none; }
  .li-row { flex-wrap: wrap; padding: 14px 12px 10px; gap: 8px; }
  .li-desc { width: 100%; flex: none; }
  .li-qty, .li-rate, .li-amt { width: calc(50% - 4px); flex: none; }
  .li-del { width: auto; margin-left: auto; }
  .spec-row { flex-wrap: wrap; }
  .spec-label, .spec-value { width: 100%; }
  .spec-remark { width: 100%; }
  .scope-row { flex-wrap: wrap; }
  .scope-remark { width: 100%; }
}
</style>
