<template>
  <div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
      <div class="search-box" style="flex:1;min-width:220px;">
        <Search :size="14" class="search-icon" />
        <input v-model="search" class="input" placeholder="Search tax invoices…" />
      </div>
      <select v-model="statusFilter" class="input" style="width:160px;">
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="sent">Sent</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <select v-model="paymentFilter" class="input" style="width:155px;">
        <option value="">All Payments</option>
        <option value="unpaid">Unpaid</option>
        <option value="partial">Partial</option>
        <option value="paid">Paid</option>
      </select>
      <button class="btn-primary" @click="openAdd">
        <Plus :size="16" /> New Tax Invoice
      </button>
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:20px;">
      <div class="glass" style="padding:16px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:var(--ct-green);">{{ formatCurrency(paidTotal) }}</div>
        <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Paid</div>
      </div>
      <div class="glass" style="padding:16px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:#fbbf24;">{{ formatCurrency(pendingTotal) }}</div>
        <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Pending</div>
      </div>
      <div class="glass" style="padding:16px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:#f87171;">{{ formatCurrency(overdueTotal) }}</div>
        <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Overdue</div>
      </div>
      <div class="glass" style="padding:16px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:var(--ct-accent);">{{ items.length }}</div>
        <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Total</div>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="pagedItems"
      :loading="loading"
      :total="filtered.length"
      :page="page"
      :pageSize="pageSize"
      empty-text="No tax invoices found."
      :on-row-click="openView"
      @page="page = $event"
    >
      <template #default="{ row }">
        <td>
          <div style="font-weight:500;color:var(--ct-primary);">{{ row.docNumber }}</div>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ formatDate(row.date) }}</div>
        </td>
        <td>
          <div class="db-s" style="color:var(--ct-sub);">{{ row.projectId ? getProjectName(row.projectId) : row.clientName }}</div>
          <div class="db-s" style="font-size:11px;color:var(--ct-muted);">{{ row.projectId ? row.clientName : row.clientGST }}</div>
        </td>
        <td style="color:var(--ct-accent);font-weight:600;">{{ formatCurrency(row.total) }}</td>
        <td>
          <div><span :class="['badge', statusBadge(row.status)]">{{ row.status || 'draft' }}</span></div>
          <div style="margin-top:4px;"><span :class="['badge', paymentBadge(row.paymentStatus)]">{{ row.paymentStatus || 'unpaid' }}</span></div>
        </td>
        <td style="color:var(--ct-muted);font-size:12px;">{{ formatCurrency(row.paidAmount) }}</td>
        <td>{{ row.dueDate ? formatDate(row.dueDate) : '—' }}</td>
        <td @click.stop>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn-secondary btn-sm" @click="openEdit(row)"><Pencil :size="12" /></button>
            <PDFDownloadButton class="btn-success btn-sm" :row="resolveRow(row)" template-key="taxInvoice" title="Download PDF"><Download :size="12" /></PDFDownloadButton>
            <button class="btn-excel btn-sm" @click="downloadRowExcel(row)" title="Download Excel"><FileSpreadsheet :size="12" /></button>
            <button style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:8px;font-size:12px;background:rgba(34,197,94,0.1);color:#4ade80;border:1px solid rgba(34,197,94,0.2);cursor:pointer;" @click="openEmail(row)" title="Send Email"><Mail :size="12" /></button>
            <button class="btn-warning btn-sm" @click="openPayment(row)" title="Record Payment"><CreditCard :size="12" /></button>
            <button class="btn-danger btn-sm" @click="confirmDel(row)"><Trash2 :size="12" /></button>
          </div>
        </td>
      </template>
    </DataTable>

    <!-- Add/Edit Modal -->
    <AppModal v-model="showModal" :title="editing ? 'Edit Tax Invoice' : 'New Tax Invoice'" width="820px">
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
          <div v-if="form.projectId" style="margin-top:6px;font-size:12px;color:var(--ct-green);">✓ Project linked — client details auto-filled below</div>
        </div>
        <div class="form-group">
          <label class="label">Invoice Number</label>
          <input v-model="form.docNumber" class="input" placeholder="TI-0001" />
        </div>
        <div class="form-group">
          <label class="label">Date</label>
          <input v-model="form.date" class="input" type="date" />
        </div>
        <div class="form-group">
          <label class="label">Due Date</label>
          <input v-model="form.dueDate" class="input" type="date" />
        </div>
        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Client Name *</label>
          <input v-model="form.clientName" class="input" placeholder="Client / Company"
            :readonly="billUseProject && !!form.projectId"
            :style="billUseProject && form.projectId ? 'opacity:.8;' : ''" />
        </div>
        <div class="form-group">
          <label class="label">Client GST</label>
          <input v-model="form.clientGST" class="input" placeholder="22AAAAA0000A1Z5" />
        </div>
        <div class="form-group form-full">
          <label class="label">Client Address</label>
          <textarea v-model="form.clientAddress" class="input" rows="2" placeholder="Address…"
            :readonly="billUseProject && !!form.projectId"
            :style="billUseProject && form.projectId ? 'opacity:.8;' : ''"></textarea>
        </div>
        <div class="form-group">
          <label class="label">Contact Person</label>
          <input v-model="form.contactPerson" class="input" placeholder="Name of contact person" />
        </div>
        <div class="form-group">
          <label class="label">Phone</label>
          <input v-model="form.clientPhone" class="input" placeholder="+91 98765 43210"
            :readonly="billUseProject && !!form.projectId"
            :style="billUseProject && form.projectId ? 'opacity:.8;' : ''" />
        </div>
        <div class="form-group">
          <label class="label">Email</label>
          <input v-model="form.clientEmail" class="input" type="email" placeholder="client@example.com" />
        </div>
        <div class="form-group">
          <label class="label">Contact Person 2</label>
          <input v-model="form.contactPerson2" class="input" placeholder="Secondary contact name" />
        </div>
        <div class="form-group">
          <label class="label">Phone 2</label>
          <input v-model="form.clientPhone2" class="input" placeholder="+91 98765 43210" />
        </div>
        <div class="form-group form-full">
          <label class="label">Lift Description</label>
          <input v-model="form.liftDescription" class="input" placeholder="e.g. 8-Passenger MRL Elevator" />
        </div>
        <div class="form-group">
          <label class="label">Client State</label>
          <input v-model="form.clientState" class="input" placeholder="e.g. MAHARASHTRA" />
        </div>
        <div class="form-group">
          <label class="label">Client GST State Code</label>
          <input v-model="form.clientGSTCode" class="input" placeholder="e.g. 27" />
        </div>
        <div class="form-group">
          <label class="label">Contract No</label>
          <input v-model="form.contractNo" class="input" placeholder="Contract / PO number" />
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
        <div class="form-group">
          <label class="label">Payment Method</label>
          <select v-model="form.paymentMethod" class="input">
            <option value="">—</option>
            <option value="cash">Cash</option>
            <option value="bank-transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
            <option value="upi">UPI</option>
          </select>
        </div>
        <div class="form-group form-full">
          <label class="label">Notes</label>
          <textarea v-model="form.notes" class="input" rows="2" placeholder="Payment terms, notes…"></textarea>
        </div>
      </div>

      <!-- Line Items -->
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:12px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;">Line Items</div>
          <button class="btn-secondary btn-sm" @click="addLine"><Plus :size="12" /> Add Row</button>
        </div>
        <div class="glass" style="border-radius:12px;overflow:hidden;">
          <div class="li-header">
            <span class="li-desc">Description</span>
            <span class="li-qty">Qty</span>
            <span class="li-unit">UOM</span>
            <span class="li-hsn">HSN/SAC</span>
            <span class="li-rate">Unit Price (₹)</span>
            <span class="li-amt">Amount (₹)</span>
            <span style="width:36px;flex-shrink:0;"></span>
          </div>
          <div v-for="(line, idx) in form.lines" :key="idx" class="li-row">
            <div class="li-field li-desc"><span class="li-label">Description</span><input v-model="line.description" class="input li-input" placeholder="Item description" @input="recalc" /></div>
            <div class="li-field li-qty"><span class="li-label">Qty</span><input v-model.number="line.qty" class="input li-input" type="number" min="1" placeholder="1" @input="recalc" /></div>
            <div class="li-field li-unit"><span class="li-label">UOM</span><input v-model="line.unit" class="input li-input" placeholder="Nos" /></div>
            <div class="li-field li-hsn"><span class="li-label">HSN/SAC</span><input v-model="line.hsnCode" class="input li-input" placeholder="998718" /></div>
            <div class="li-field li-rate"><span class="li-label">Unit Price (₹)</span><input v-model.number="line.unitPrice" class="input li-input" type="number" min="0" placeholder="0" @input="recalc" /></div>
            <div class="li-field li-amt"><span class="li-label">Amount (₹)</span><input :value="formatCurrencyRaw(line.qty * line.unitPrice || 0)" class="input li-input li-amt-input" readonly /></div>
            <button class="btn-danger btn-sm btn-icon li-del" @click="removeLine(idx)"><Trash2 :size="13" /></button>
          </div>
        </div>
      </div>

      <!-- Totals -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
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

      <template #footer>
        <button class="btn-secondary" @click="showModal = false">Cancel</button>
        <button class="btn-primary" @click="save" :disabled="saving">
          <Save :size="14" /> {{ saving ? 'Saving…' : (editing ? 'Update Invoice' : 'Create Invoice') }}
        </button>
      </template>
    </AppModal>

    <!-- Payment Modal -->
    <AppModal v-model="showPaymentModal" title="Record Payment" :subtitle="paymentTarget?.docNumber" width="440px">
      <div class="form-grid">
        <div class="form-group">
          <label class="label">Total Amount</label>
          <input :value="formatCurrency(paymentTarget?.total)" class="input" readonly style="opacity:.7;" />
        </div>
        <div class="form-group">
          <label class="label">Amount Paid (₹) *</label>
          <input v-model.number="paymentForm.paidAmount" class="input" type="number" min="0" :max="paymentTarget?.total" />
        </div>
        <div class="form-group">
          <label class="label">Payment Date</label>
          <input v-model="paymentForm.paymentDate" class="input" type="date" />
        </div>
        <div class="form-group">
          <label class="label">Payment Mode</label>
          <select v-model="paymentForm.paymentMode" class="input">
            <option value="cash">Cash</option>
            <option value="bank-transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
            <option value="upi">UPI</option>
          </select>
        </div>
        <div class="form-group form-full">
          <label class="label">Remarks</label>
          <input v-model="paymentForm.remarks" class="input" placeholder="Reference number, note…" />
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showPaymentModal = false">Cancel</button>
        <button class="btn-success" :disabled="saving" @click="savePayment">
          <CreditCard :size="14" /> {{ saving ? 'Saving…' : 'Record Payment' }}
        </button>
      </template>
    </AppModal>

    <ConfirmDialog ref="confirmRef" title="Delete Tax Invoice" @confirm="doDelete" />
    <EmailModal :show="showEmailModal" :row="emailRow" template-key="taxInvoice" @close="showEmailModal = false" />

    <!-- Tax Invoice Detail View Modal -->
    <AppModal v-model="showViewModal" :title="viewTarget ? (viewTarget.docNumber || 'Tax Invoice') : 'Tax Invoice'" width="580px">
      <template v-if="viewTarget">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="padding:14px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;">
            <div v-if="viewTarget.projectId" style="font-size:11px;color:var(--ct-accent);margin-bottom:2px;">{{ getProjectName(viewTarget.projectId) }}</div>
            <div style="font-size:16px;font-weight:700;color:var(--ct-primary);">{{ viewTarget.clientName }}</div>
            <div style="font-size:12px;color:var(--ct-muted);margin-top:2px;">{{ viewTarget.docNumber }} &bull; {{ formatDate(viewTarget.date) }}</div>
            <div style="display:flex;gap:6px;margin-top:8px;">
              <span :class="['badge', statusBadge(viewTarget.status)]">{{ viewTarget.status || 'draft' }}</span>
              <span :class="['badge', paymentBadge(viewTarget.paymentStatus)]">{{ viewTarget.paymentStatus || 'unpaid' }}</span>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Total</div>
              <div style="color:var(--ct-accent);font-weight:700;font-size:15px;">{{ formatCurrency(viewTarget.total) }}</div>
            </div>
            <div class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Paid</div>
              <div style="color:#10b981;font-weight:600;">{{ formatCurrency(viewTarget.paidAmount) }}</div>
            </div>
            <div v-if="viewTarget.dueDate" class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Due Date</div>
              <div style="color:var(--ct-sub);">{{ formatDate(viewTarget.dueDate) }}</div>
            </div>
            <div v-if="viewTarget.clientPhone" class="glass" style="padding:12px 14px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Phone</div>
              <div style="color:var(--ct-sub);">{{ viewTarget.clientPhone }}</div>
            </div>
            <div v-if="viewTarget.liftDescription" class="glass" style="padding:12px 14px;grid-column:1/-1;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Description</div>
              <div style="color:var(--ct-sub);">{{ viewTarget.liftDescription }}</div>
            </div>
            <div v-if="viewTarget.clientAddress" class="glass" style="padding:12px 14px;grid-column:1/-1;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Address</div>
              <div style="color:var(--ct-sub);">{{ viewTarget.clientAddress }}</div>
            </div>
          </div>
          <div v-if="(viewTarget.lines || []).length" class="glass" style="padding:12px 14px;border-radius:10px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Line Items</div>
            <div v-for="(item, i) in viewTarget.lines" :key="i" style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="color:var(--ct-sub);">{{ item.description }}</span>
              <span style="color:var(--ct-accent);font-weight:600;">{{ formatCurrency((item.qty || 0) * (item.unitPrice || 0)) }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-top:8px;">
              <span style="color:var(--ct-sub);">Total</span>
              <span style="color:var(--ct-accent);">{{ formatCurrency(viewTarget.total) }}</span>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <button class="btn-secondary" @click="showViewModal = false">Close</button>
        <button class="btn-primary" @click="showViewModal = false; openEdit(viewTarget)">Edit</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Search, Plus, Pencil, Trash2, Download, Save, CreditCard, FileSpreadsheet, FolderOpen, Mail } from 'lucide-vue-next'
import DataTable from '@/components/ui/DataTable.vue'
import AppModal from '@/components/ui/AppModal.vue'
import PDFDownloadButton from '@/components/ui/PDFDownloadButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmailModal from '@/components/ui/EmailModal.vue'
import { useCollection } from '@/composables/useCollection'
import { useUIStore } from '@/stores/ui'
import { Collections } from '@/firebase/collections'
import { downloadExcel } from '@/composables/useBillingExcel'

const ui = useUIStore()
const { items, loading, add, edit, del } = useCollection(Collections.TAX_INVOICES)
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

function resolveRow(row) {
  if (row.projectName || !row.projectId) return row
  return { ...row, projectName: getProjectName(row.projectId) }
}

function selectBillProject(p) {
  form.value.projectId = p.id
  billProjectSearch.value = p.projectName
  billShowProjectDropdown.value = false
  form.value.projectName = p.projectName || ''
  form.value.clientName = p.clientName || ''
  form.value.clientPhone = p.phone || p.clientPhone || ''
  form.value.clientAddress = p.address || p.clientAddress || ''
  form.value.clientEmail = p.email || p.clientEmail || ''
}

function billDelayCloseDropdown() {
  setTimeout(() => { billShowProjectDropdown.value = false }, 200)
}

const search = ref('')
const statusFilter = ref('')
const paymentFilter = ref('')
const page = ref(1)
const pageSize = 20

const showModal = ref(false)
const showViewModal = ref(false)
const viewTarget = ref(null)
function openView(row) { viewTarget.value = row; showViewModal.value = true }
const editing = ref(null)
const saving = ref(false)
const confirmRef = ref(null)
const deleteTarget = ref(null)

const emptyForm = () => ({
  projectId: '', projectName: '',
  docNumber: '', date: new Date().toISOString().slice(0, 10), dueDate: '',
  status: 'draft', clientName: '', clientGST: '', clientAddress: '',
  clientState: '', clientGSTCode: '',
  contactPerson: '', clientPhone: '', clientEmail: '', contactPerson2: '', clientPhone2: '',
  liftDescription: '', contractNo: '',
  gstPercent: 18, paymentMethod: '', notes: '',
  lines: [{ description: '', qty: 1, unit: '', hsnCode: '', unitPrice: 0 }],
  subtotal: 0, gstAmount: 0, total: 0,
  paymentStatus: 'unpaid', paidAmount: 0,
})
const form = ref(emptyForm())

const columns = [
  { key: 'docNumber', label: 'Invoice #' },
  { key: 'clientName', label: 'Client' },
  { key: 'total', label: 'Total', width: '110px' },
  { key: 'status', label: 'Status', width: '130px' },
  { key: 'paidAmount', label: 'Paid', width: '110px' },
  { key: 'dueDate', label: 'Due Date', width: '110px' },
  { key: 'actions', label: 'Actions', width: '180px' },
]

const filtered = computed(() => {
  let list = items.value
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(i => i.docNumber?.toLowerCase().includes(q) || i.clientName?.toLowerCase().includes(q) || i.projectName?.toLowerCase().includes(q) || getProjectName(i.projectId)?.toLowerCase().includes(q))
  }
  if (statusFilter.value) list = list.filter(i => i.status === statusFilter.value)
  if (paymentFilter.value) list = list.filter(i => (i.paymentStatus || 'unpaid') === paymentFilter.value)
  return list
})
const pagedItems = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch([search, statusFilter, paymentFilter], () => { page.value = 1 })

const paidTotal = computed(() => items.value.filter(i => i.paymentStatus === 'paid').reduce((s, i) => s + (i.total || 0), 0))
const pendingTotal = computed(() => items.value.filter(i => (i.paymentStatus || 'unpaid') === 'unpaid').reduce((s, i) => s + (i.total || 0), 0))
const overdueTotal = computed(() => items.value.filter(i => i.status === 'overdue').reduce((s, i) => s + (i.total || 0), 0))

function recalc() {
  const sub = form.value.lines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0)
  form.value.subtotal = sub
  form.value.gstAmount = Math.round(sub * (form.value.gstPercent || 0) / 100)
  form.value.total = form.value.subtotal + form.value.gstAmount
}

function addLine() { form.value.lines.push({ description: '', qty: 1, unit: '', hsnCode: '', unitPrice: 0 }) }
function removeLine(i) { form.value.lines.splice(i, 1); recalc() }

function openAdd() {
  editing.value = null
  form.value = emptyForm()
  form.value.docNumber = `TI-${String(items.value.length + 1).padStart(3, '0')}`
  billUseProject.value = false
  billProjectSearch.value = ''
  showModal.value = true
}
function openEdit(row) {
  editing.value = row
  form.value = { ...emptyForm(), ...row, lines: row.lines ? row.lines.map(l => ({ ...l })) : [{ description: '', qty: 1, unitPrice: 0 }] }
  billUseProject.value = !!row.projectId
  if (row.projectId) {
    const proj = allProjects.value.find(p => p.id === row.projectId)
    billProjectSearch.value = proj?.projectName || ''
  } else {
    billProjectSearch.value = ''
  }
  showModal.value = true
}

// Called from BillingView when converting a Proforma Invoice → Tax Invoice
function openWithData(piRow) {
  editing.value = null
  form.value = {
    ...emptyForm(),
    docNumber: `TI-${String(items.value.length + 1).padStart(3, '0')}`,
    clientName: piRow.clientName || '',
    clientAddress: piRow.clientAddress || '',
    clientGST: piRow.clientGST || '',
    contactPerson: piRow.contactPerson || '',
    clientPhone: piRow.clientPhone || '',
    clientEmail: piRow.clientEmail || '',
    liftDescription: piRow.liftDescription || '',
    contractNo: piRow.contractNo || '',
    gstPercent: piRow.gstPercent || 18,
    // Normalize PI items (quantity/rate) to TI lines (qty/unitPrice)
    lines: (piRow.items || []).map(i => ({
      description: i.description || '',
      qty: i.quantity || 1,
      unit: i.unit || '',
      hsnCode: i.hsnCode || '',
      unitPrice: i.rate || 0,
    })),
    subtotal: piRow.subtotal || 0,
    gstAmount: piRow.gstAmount || 0,
    total: piRow.total || 0,
    notes: piRow.notes || '',
    sourcePI: piRow.docNumber || '',
  }
  showModal.value = true
}

async function save() {
  if (!form.value.clientName) { ui.error('Client name required.'); return }
  if (!form.value.lines?.length) { ui.error('At least one line item is required.'); return }
  saving.value = true
  try {
    const data = { ...form.value, updatedAt: new Date() }
    if (editing.value) {
      await edit(editing.value.id, data, { action: 'updated', module: 'taxInvoices', tab: 'Billing', summary: `Updated Tax Invoice ${data.docNumber} for ${data.clientName}`, details: { docNumber: data.docNumber, clientName: data.clientName, amount: data.total } })
      ui.success('Tax invoice updated.')
    } else {
      data.createdAt = new Date()
      await add(data, { action: 'created', module: 'taxInvoices', tab: 'Billing', summary: `Created Tax Invoice ${data.docNumber} for ${data.clientName}`, details: { docNumber: data.docNumber, clientName: data.clientName, amount: data.total } })
      ui.success('Tax invoice created.')
    }
    showModal.value = false
  } catch { ui.error('Save failed.') }
  finally { saving.value = false }
}

async function downloadRowExcel(row) {
  const resolved = row.projectName || !row.projectId ? row
    : { ...row, projectName: allProjects.value.find(p => p.id === row.projectId)?.projectName || '' }
  try { await downloadExcel(resolved, 'taxInvoice') }
  catch (e) { ui.error('Failed to generate Excel: ' + (e?.message || e)) }
}

const showEmailModal = ref(false)
const emailRow = ref(null)
function openEmail(row) {
  if (!row.clientEmail) { ui.warning('No email address on this record. Edit the document and add a client email first.'); return }
  emailRow.value = row.projectName || !row.projectId ? row
    : { ...row, projectName: allProjects.value.find(p => p.id === row.projectId)?.projectName || '' }
  showEmailModal.value = true
}

function confirmDel(row) { deleteTarget.value = row; confirmRef.value?.open(`Delete invoice "${row.docNumber}"?`) }
async function doDelete() {
  try { await del(deleteTarget.value.id, { action: 'deleted', module: 'taxInvoices', tab: 'Billing', summary: 'Deleted tax invoice', details: { id: deleteTarget.value.id } }); ui.success('Invoice deleted.') }
  catch { ui.error('Failed to delete.') }
}

// Payment
const showPaymentModal = ref(false)
const paymentTarget = ref(null)
const paymentForm = ref({ paidAmount: 0, paymentDate: '', paymentMode: 'bank-transfer', remarks: '' })

function openPayment(row) {
  paymentTarget.value = row
  paymentForm.value = {
    paidAmount: row.paidAmount || 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: 'bank-transfer',
    remarks: '',
  }
  showPaymentModal.value = true
}

async function savePayment() {
  const paid = Number(paymentForm.value.paidAmount) || 0
  const total = Number(paymentTarget.value.total) || 0
  let paymentStatus = 'unpaid'
  if (paid >= total) paymentStatus = 'paid'
  else if (paid > 0) paymentStatus = 'partial'
  saving.value = true
  try {
    await edit(paymentTarget.value.id, {
      paidAmount: paid,
      paymentStatus,
      paymentDate: paymentForm.value.paymentDate,
      paymentMode: paymentForm.value.paymentMode,
      paymentRemarks: paymentForm.value.remarks,
      updatedAt: new Date(),
    }, { action: 'payment', module: 'taxInvoices', tab: 'Billing', summary: `Recorded payment for Invoice ${paymentTarget.value.docNumber}`, details: { docNumber: paymentTarget.value.docNumber, clientName: paymentTarget.value.clientName, paymentAmount: paid } })
    ui.success('Payment recorded.')
    showPaymentModal.value = false
  } catch { ui.error('Failed to record payment.') }
  finally { saving.value = false }
}


const statusBadge = (s) => ({ paid: 'badge-active', sent: 'badge-info', draft: 'badge-inactive', overdue: 'badge-danger', cancelled: 'badge-inactive' }[s] || 'badge-inactive')
const paymentBadge = (s) => ({ unpaid: 'badge-danger', partial: 'badge-warning', paid: 'badge-active' }[s] || 'badge-inactive')
const formatCurrency = (v) => v || v === 0 ? `₹${Number(v).toLocaleString('en-IN')}` : '—'
const formatCurrencyRaw = (v) => `₹${Number(v).toLocaleString('en-IN')}`
function formatDate(d) {
  if (!d) return '—'
  const dt = d?.toDate ? d.toDate() : new Date(d)
  if (isNaN(dt.getTime())) return '—'
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${dt.getFullYear()}`
}

defineExpose({ openWithData })
</script>

<style scoped>
.proj-dd { background: var(--ct-card, #1e293b); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
[data-theme="light"] .proj-dd { background: #ffffff; border-color: #e2e8f0; }
.proj-dd-item { color: var(--ct-primary); border-bottom: 1px solid rgba(255,255,255,0.05); }
[data-theme="light"] .proj-dd-item { border-bottom-color: #f1f5f9; }

/* ── Line items layout ── */
.li-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em;
  color: #64748b;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.li-row {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.li-row:last-child { border-bottom: none; }
.li-field { display: flex; flex-direction: column; }
.li-label { display: none; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #64748b; margin-bottom: 4px; }
.li-desc { flex: 1; min-width: 0; }
.li-qty  { width: 76px;  flex-shrink: 0; }
.li-unit { width: 70px;  flex-shrink: 0; }
.li-hsn  { width: 96px;  flex-shrink: 0; }
.li-rate { width: 116px; flex-shrink: 0; }
.li-amt  { width: 116px; flex-shrink: 0; }
.li-del  { flex-shrink: 0; width: 36px; padding: 7px !important; margin-bottom: 1px; }
.li-input { font-size: 14px !important; padding: 9px 12px !important; width: 100%; }
.li-amt-input { opacity: .65; }
[data-theme="light"] .li-header { border-bottom-color: #e2e8f0; }
[data-theme="light"] .li-row { border-bottom-color: #f1f5f9; }

@media (max-width: 700px) {
  .li-header { display: none; }
  .li-label { display: block; }
  .li-row { flex-wrap: wrap; padding: 14px 12px 10px; gap: 8px; align-items: flex-start; }
  .li-desc { width: 100%; flex: none; }
  .li-qty, .li-unit { width: calc(50% - 4px); flex: none; }
  .li-hsn, .li-rate { width: calc(50% - 4px); flex: none; }
  .li-amt { width: calc(50% - 4px); flex: none; }
  .li-del { width: auto; margin-left: auto; align-self: flex-end; }
}
</style>
