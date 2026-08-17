<template>
  <div>
    <!-- Toolbar -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
      <div class="search-box" style="flex:1;min-width:220px;">
        <Search :size="14" class="search-icon" />
        <input v-model="search" class="input" placeholder="Search purchase orders…" />
      </div>
      <select v-model="statusFilter" class="input" style="width:160px;">
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="issued">Issued</option>
        <option value="received">Received</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <button class="btn-primary" @click="openAdd">
        <Plus :size="16" /> New Purchase Order
      </button>
    </div>

    <DataTable
      :columns="columns"
      :rows="pagedItems"
      :loading="loading"
      :total="filtered.length"
      :page="page"
      :pageSize="pageSize"
      empty-text="No purchase orders found."
      :on-row-click="openView"
      @page="page = $event"
    >
      <template #default="{ row }">
        <td>
          <div style="font-weight:500;color:var(--ct-primary);">{{ row.docNumber }}</div>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ formatDate(row.date) }}</div>
        </td>
        <td>
          <div style="color:var(--ct-sub);">{{ row.projectId ? getProjectName(row.projectId) : row.clientName }}</div>
          <div style="font-size:11px;color:var(--ct-muted);">{{ row.projectId ? row.clientName : row.clientGST }}</div>
        </td>
        <td style="color:var(--ct-accent);font-weight:600;">{{ formatCurrency(row.total) }}</td>
        <td><span :class="['badge', statusBadge(row.status)]">{{ row.status || 'draft' }}</span></td>
        <td @click.stop>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn-secondary btn-sm" @click="openEdit(row)"><Pencil :size="12" /></button>
            <PDFDownloadButton class="btn-success btn-sm" :row="row" template-key="purchaseOrder" title="PDF"><Download :size="12" /></PDFDownloadButton>
            <button class="btn-excel btn-sm" @click="downloadRowExcel(row)" title="Download Excel"><FileSpreadsheet :size="12" /></button>
            <button class="btn-danger btn-sm" @click="confirmDel(row)"><Trash2 :size="12" /></button>
          </div>
        </td>
      </template>
    </DataTable>

    <!-- Add/Edit Modal -->
    <AppModal v-model="showModal" :title="editing ? 'Edit Purchase Order' : 'New Purchase Order'" width="800px">
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
                <div style="font-size:11px;color:var(--ct-muted);">Associate this PO with a project for reference</div>
              </div>
            </div>
            <button type="button" @click="billUseProject = !billUseProject"
              :style="`width:44px;height:24px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${billUseProject ? '#6366f1' : 'rgba(255,255,255,0.12)'};position:relative;`">
              <span :style="`position:absolute;top:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:all .2s;left:${billUseProject ? '23px' : '3px'};`"></span>
            </button>
          </div>
        </div>
        <!-- Project Search (when toggle ON) -->
        <div v-if="billUseProject" class="form-group form-full">
          <label class="label">Select Project</label>
          <div style="position:relative;">
            <input v-model="billProjectSearch" class="input" placeholder="Search project name…"
              @focus="billShowProjectDropdown = true" @blur="billDelayCloseDropdown" />
            <div v-if="billShowProjectDropdown && billFilteredProjects.length" class="proj-dd" style="position:absolute;top:100%;left:0;right:0;border-radius:8px;z-index:200;max-height:200px;overflow-y:auto;margin-top:4px;">
              <div v-for="p in billFilteredProjects" :key="p.id" @mousedown.prevent="selectBillProject(p)"
                class="proj-dd-item" style="padding:10px 14px;cursor:pointer;font-size:13px;"
                :style="form.projectId === p.id ? 'background:rgba(99,102,241,0.15);' : ''">
                <div>{{ p.projectName }}</div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ p.clientName }} · {{ p.city || p.address || '—' }}</div>
              </div>
            </div>
          </div>
          <div v-if="form.projectId" style="margin-top:6px;font-size:12px;color:var(--ct-green);">✓ Project linked: {{ form.linkedProjectName }}</div>
        </div>
        <div class="form-group">
          <label class="label">PO Number</label>
          <input v-model="form.docNumber" class="input" :placeholder="`PO-${String(items.length + 1).padStart(3, '0')}`" />
        </div>
        <div class="form-group">
          <label class="label">Date</label>
          <input v-model="form.date" class="input" type="date" />
        </div>
        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Vendor / Supplier *</label>
          <input v-model="form.clientName" class="input" placeholder="Vendor / Company name" />
        </div>
        <div class="form-group form-full">
          <label class="label">Vendor Address</label>
          <textarea v-model="form.clientAddress" class="input" rows="2" placeholder="Vendor address…"></textarea>
        </div>
        <div class="form-group">
          <label class="label">Vendor GST Number</label>
          <input v-model="form.clientGST" class="input" placeholder="22AAAAA0000A1Z5" />
        </div>
        <div class="form-group">
          <label class="label">Contact Person</label>
          <input v-model="form.contactPerson" class="input" placeholder="Name of contact person" />
        </div>
        <div class="form-group">
          <label class="label">Phone</label>
          <input v-model="form.clientPhone" class="input" placeholder="+91 98765 43210" />
        </div>
        <div class="form-group">
          <label class="label">Email</label>
          <input v-model="form.clientEmail" class="input" type="email" placeholder="vendor@example.com" />
        </div>
        <div class="form-group form-full">
          <label class="label">Lift Description</label>
          <input v-model="form.liftDescription" class="input" placeholder="e.g. 8-Passenger MRL Elevator" />
        </div>
        <div class="form-group">
          <label class="label">GST (%)</label>
          <select v-model.number="form.gstPercent" class="input" @change="recalc">
            <option :value="0">0%</option>
            <option :value="5">5%</option>
            <option :value="12">12%</option>
            <option :value="18">18%</option>
          </select>
        </div>
      </div>

      <!-- Line Items -->
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:12px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;">Line Items</div>
          <button class="btn-secondary btn-sm" @click="addLineItem"><Plus :size="12" /> Add Item</button>
        </div>
        <div class="glass" style="border-radius:12px;overflow:hidden;">
          <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="width:90px;">Qty</th>
                <th style="width:120px;">Rate (₹)</th>
                <th style="width:120px;">Amount (₹)</th>
                <th style="width:44px;"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in form.items" :key="i">
                <td><input v-model="item.description" class="input" placeholder="Item description" @input="recalc" /></td>
                <td><input v-model.number="item.quantity" class="input" type="number" min="0" @input="calcLine(item); recalc()" /></td>
                <td><input v-model.number="item.rate" class="input" type="number" min="0" @input="calcLine(item); recalc()" /></td>
                <td><input :value="item.amount" class="input" readonly style="opacity:.7;" /></td>
                <td><button class="btn-danger btn-sm btn-icon" style="padding:6px;" @click="removeLineItem(i)"><Trash2 :size="12" /></button></td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <!-- Totals -->
      <div style="display:flex;justify-content:flex-end;">
        <div class="glass" style="padding:16px 20px;border-radius:12px;min-width:240px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
            <span style="color:var(--ct-muted);">Subtotal</span>
            <span style="color:var(--ct-sub);">{{ formatCurrency(form.subtotal) }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
            <span style="color:var(--ct-muted);">GST ({{ form.gstPercent }}%)</span>
            <span style="color:var(--ct-sub);">{{ formatCurrency(form.gstAmount) }}</span>
          </div>
          <hr class="divider" style="margin:8px 0;" />
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;">
            <span style="color:var(--ct-primary);">Total</span>
            <span style="color:var(--ct-accent);">{{ formatCurrency(form.total) }}</span>
          </div>
        </div>
      </div>

      <div class="form-group form-full" style="margin-top:16px;">
        <label class="label">Notes / Terms</label>
        <textarea v-model="form.notes" class="input" rows="3" placeholder="Delivery terms, payment terms…"></textarea>
      </div>

      <template #footer>
        <SwipeToConfirm
          ref="poSwipeRef"
          style="width:100%;"
          :label="editing ? 'Swipe to update PO' : 'Swipe to create PO'"
          :done-label="editing ? 'PO updated' : 'PO created'"
          :loading="saving"
          @confirm="save"
        />
      </template>
    </AppModal>

    <ConfirmDialog ref="confirmRef" title="Delete Purchase Order" @confirm="doDelete" />

    <!-- Purchase Order Detail View Modal -->
    <AppModal v-model="showViewModal" :title="viewTarget ? (viewTarget.docNumber || 'Purchase Order') : 'Purchase Order'" width="580px">
      <template v-if="viewTarget">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="padding:14px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;">
            <div v-if="viewTarget.projectId" style="font-size:11px;color:var(--ct-accent);margin-bottom:2px;">{{ getProjectName(viewTarget.projectId) }}</div>
            <div style="font-size:16px;font-weight:700;color:var(--ct-primary);">{{ viewTarget.clientName || viewTarget.supplierName || '—' }}</div>
            <div style="font-size:12px;color:var(--ct-muted);margin-top:2px;">{{ viewTarget.docNumber }} &bull; {{ formatDate(viewTarget.date) }}</div>
            <div style="margin-top:8px;"><span :class="['badge', statusBadge(viewTarget.status)]">{{ viewTarget.status || 'draft' }}</span></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Total</div>
              <div style="color:var(--ct-accent);font-weight:700;font-size:15px;">{{ formatCurrency(viewTarget.total) }}</div>
            </div>
            <div v-if="viewTarget.clientGST" class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">GST</div>
              <div style="color:var(--ct-sub);">{{ viewTarget.clientGST }}</div>
            </div>
            <div v-if="viewTarget.notes" class="glass" style="padding:12px 14px;grid-column:1/-1;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Notes</div>
              <div style="color:var(--ct-sub);">{{ viewTarget.notes }}</div>
            </div>
          </div>
          <div v-if="(viewTarget.items || []).length" class="glass" style="padding:12px 14px;border-radius:10px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Line Items</div>
            <div v-for="(item, i) in viewTarget.items" :key="i" style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="color:var(--ct-sub);">{{ item.description }}</span>
              <span style="color:var(--ct-accent);font-weight:600;">{{ formatCurrency(item.amount) }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-top:8px;">
              <span style="color:var(--ct-sub);">Total</span>
              <span style="color:var(--ct-accent);">{{ formatCurrency(viewTarget.total) }}</span>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div style="display:flex;gap:6px;flex-wrap:wrap;width:100%;">
          <button class="btn-secondary" @click="showViewModal = false">Close</button>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-left:auto;">
            <PDFDownloadButton v-if="viewTarget" class="btn-success btn-sm" :row="viewTarget" template-key="purchaseOrder" title="PDF"><Download :size="12" /></PDFDownloadButton>
            <button class="btn-excel btn-sm" @click="downloadRowExcel(viewTarget)" title="Download Excel"><FileSpreadsheet :size="12" /></button>
            <button class="btn-danger btn-sm" @click="showViewModal = false; confirmDel(viewTarget)"><Trash2 :size="12" /></button>
            <button class="btn-primary" @click="showViewModal = false; openEdit(viewTarget)">Edit</button>
          </div>
        </div>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Plus, Search, Pencil, Trash2, Download, FileSpreadsheet, FolderOpen } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import PDFDownloadButton from '@/components/ui/PDFDownloadButton.vue'
import SwipeToConfirm from '@/components/ui/SwipeToConfirm.vue'
import { useCollection } from '@/composables/useCollection'
import { useUIStore } from '@/stores/ui'
import { Collections } from '@/firebase/collections'
import { downloadExcel } from '@/composables/useBillingExcel'

const ui = useUIStore()
const { items, loading, add, edit, del } = useCollection(Collections.PURCHASE_ORDERS)
const { items: allProjects } = useCollection(Collections.PROJECTS)

// ── Project Link ─────────────────────────────────────────────────────
const billUseProject = ref(false)
const billProjectSearch = ref('')
const billShowProjectDropdown = ref(false)

const billFilteredProjects = computed(() => {
  const q = billProjectSearch.value.toLowerCase()
  return allProjects.value.filter(p =>
    (p.projectName || '').toLowerCase().includes(q) ||
    (p.clientName || '').toLowerCase().includes(q)
  )
})

function getProjectName(projectId) {
  if (!projectId) return ''
  return allProjects.value.find(p => p.id === projectId)?.projectName || ''
}

function selectBillProject(p) {
  form.value.projectId = p.id
  form.value.linkedProjectName = p.projectName || ''
  billProjectSearch.value = p.projectName
  billShowProjectDropdown.value = false
}

function billDelayCloseDropdown() {
  setTimeout(() => { billShowProjectDropdown.value = false }, 200)
}

const search = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = 20

const filtered = computed(() => {
  let list = items.value
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(r => r.docNumber?.toLowerCase().includes(q) || r.clientName?.toLowerCase().includes(q) || r.linkedProjectName?.toLowerCase().includes(q) || r.projectName?.toLowerCase().includes(q) || getProjectName(r.projectId)?.toLowerCase().includes(q))
  }
  if (statusFilter.value) list = list.filter(r => r.status === statusFilter.value)
  return list
})
const pagedItems = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch([search, statusFilter], () => { page.value = 1 })

const columns = [
  { key: 'docNumber', label: 'PO Number' },
  { key: 'vendor', label: 'Vendor / Supplier' },
  { key: 'total', label: 'Total', width: '120px' },
  { key: 'status', label: 'Status', width: '120px' },
  { key: 'actions', label: 'Actions', width: '160px' },
]

function statusBadge(s) {
  const m = { draft: 'badge-inactive', issued: 'badge-info', received: 'badge-active', cancelled: 'badge-danger' }
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

const showModal = ref(false)
const showViewModal = ref(false)
const viewTarget = ref(null)
function openView(row) { viewTarget.value = row; showViewModal.value = true }
const editing = ref(null)
const saving = ref(false)

const defaultForm = () => ({
  projectId: '', linkedProjectName: '',
  docNumber: '', date: new Date().toISOString().split('T')[0],
  status: 'draft', clientName: '', clientAddress: '', clientGST: '',
  contactPerson: '', clientPhone: '', clientEmail: '', liftDescription: '',
  items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
  subtotal: 0, gstPercent: 18, gstAmount: 0, total: 0, notes: '',
})
const form = ref(defaultForm())

function addLineItem() { form.value.items.push({ description: '', quantity: 1, rate: 0, amount: 0 }) }
function removeLineItem(i) { form.value.items.splice(i, 1); recalc() }
function calcLine(item) { item.amount = Math.round((item.quantity || 0) * (item.rate || 0) * 100) / 100 }
function recalc() {
  form.value.subtotal = form.value.items.reduce((s, i) => s + (i.amount || 0), 0)
  form.value.gstAmount = Math.round(form.value.subtotal * (form.value.gstPercent || 0) / 100)
  form.value.total = form.value.subtotal + form.value.gstAmount
}

function openAdd() {
  editing.value = null
  const num = `PO-${String(items.value.length + 1).padStart(3, '0')}`
  form.value = { ...defaultForm(), docNumber: num }
  billUseProject.value = false
  billProjectSearch.value = ''
  showModal.value = true
}
function openEdit(row) {
  editing.value = row
  form.value = { ...defaultForm(), ...row, items: row.items?.map(i => ({ ...i })) || [{ description: '', quantity: 1, rate: 0, amount: 0 }] }
  billUseProject.value = !!row.projectId
  if (row.projectId) {
    const proj = allProjects.value.find(p => p.id === row.projectId)
    billProjectSearch.value = proj?.projectName || row.linkedProjectName || ''
  } else {
    billProjectSearch.value = ''
  }
  showModal.value = true
}

const poSwipeRef = ref(null)
async function save() {
  if (!form.value.clientName) { ui.error('Vendor name is required.'); poSwipeRef.value?.reset(); return }
  if (!form.value.items?.length) { ui.error('At least one line item is required.'); poSwipeRef.value?.reset(); return }
  saving.value = true
  try {
    const data = { ...form.value, updatedAt: new Date() }
    if (editing.value) {
      await edit(editing.value.id, data, { action: 'updated', module: 'purchaseOrders', tab: 'Billing', summary: `Updated Purchase Order ${data.docNumber} for ${data.clientName}`, details: { docNumber: data.docNumber, clientName: data.clientName, amount: data.total } })
      ui.success('Purchase order updated.')
    } else {
      data.createdAt = new Date()
      await add(data, { action: 'created', module: 'purchaseOrders', tab: 'Billing', summary: `Created Purchase Order ${data.docNumber} for ${data.clientName}`, details: { docNumber: data.docNumber, clientName: data.clientName, amount: data.total } })
      ui.success('Purchase order created.')
    }
    showModal.value = false
  } catch { ui.error('Failed to save purchase order.'); poSwipeRef.value?.reset() }
  finally { saving.value = false }
}

const confirmRef = ref(null)
const deleteTarget = ref(null)
async function downloadRowExcel(row) {
  try { await downloadExcel(row, 'purchaseOrder', ui) }
  catch (e) { ui.error('Failed to generate Excel: ' + (e?.message || e)) }
}

function confirmDel(row) { deleteTarget.value = row; confirmRef.value?.open(`Delete ${row.docNumber}? This cannot be undone.`) }
async function doDelete() {
  try { await del(deleteTarget.value.id, { action: 'deleted', module: 'purchaseOrders', tab: 'Billing', summary: 'Deleted purchase order', details: { id: deleteTarget.value.id } }); ui.success('Purchase order deleted.') }
  catch { ui.error('Failed to delete.') }
}

</script>

<style scoped>
.proj-dd { background: var(--ct-card, #1e293b); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
[data-theme="light"] .proj-dd { background: #ffffff; border-color: #e2e8f0; }
.proj-dd-item { color: var(--ct-primary); border-bottom: 1px solid rgba(255,255,255,0.05); }
[data-theme="light"] .proj-dd-item { border-bottom-color: #f1f5f9; }
</style>
