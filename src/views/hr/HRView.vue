<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <Users :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          HR
        </h1>
        <p class="page-sub">Manage technician and staff accounts.</p>
      </div>
      <button class="btn-primary" @click="openAdd">
        <Plus :size="14" /> Add Employee
      </button>
    </div>

    <div class="search-box" style="margin-bottom:20px;max-width:340px;">
      <Search :size="14" class="search-icon" />
      <input v-model="search" class="input" placeholder="Search name or username…" />
    </div>

    <div v-if="loading" style="text-align:center;padding:60px;color:var(--ct-muted);">Loading…</div>
    <div v-else-if="!filteredEmployees.length" class="glass empty-state" style="padding:60px;">
      <Users :size="36" style="margin:0 auto 16px;opacity:.3;" />
      <p>No employees yet. Add your first technician above.</p>
    </div>
    <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
      <div v-for="emp in filteredEmployees" :key="emp.id" class="glass" style="padding:16px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
          <div style="min-width:0;">
            <div style="font-weight:600;color:var(--ct-primary);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ emp.fullName }}</div>
            <div style="font-size:12px;color:var(--ct-muted);margin-top:2px;">@{{ emp.username }}</div>
          </div>
          <span class="badge" :class="emp.status === 'inactive' ? 'badge-inactive' : 'badge-active'" style="flex-shrink:0;">{{ emp.status === 'inactive' ? 'Inactive' : 'Active' }}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <span class="badge badge-info" style="text-transform:capitalize;">{{ emp.role || 'technician' }}</span>
          <span v-if="emp.phone" style="font-size:12px;color:var(--ct-muted);">{{ emp.phone }}</span>
        </div>
        <div style="display:flex;gap:6px;margin-top:12px;">
          <button class="btn-secondary btn-sm" style="flex:1;justify-content:center;" @click="openEdit(emp)">
            <Pencil :size="12" /> Edit
          </button>
          <button class="btn-secondary btn-sm" style="justify-content:center;" @click="toggleStatus(emp)" :title="emp.status === 'inactive' ? 'Activate' : 'Deactivate'">
            <component :is="emp.status === 'inactive' ? CheckCircle2 : Ban" :size="12" />
          </button>
          <button class="btn-danger btn-sm" style="justify-content:center;" @click="confirmDelete(emp)">
            <Trash2 :size="12" />
          </button>
        </div>
      </div>
    </div>

    <AppModal v-model="showModal" :title="editing ? 'Edit Employee' : 'Add Employee'" width="480px">
      <div class="form-grid">
        <div class="form-group form-full">
          <label class="label">Full Name *</label>
          <input v-model="form.fullName" class="input" placeholder="e.g. Ramesh Kumar" />
        </div>
        <div class="form-group">
          <label class="label">Username *</label>
          <input v-model="form.username" class="input" placeholder="e.g. ramesh" autocomplete="off" />
        </div>
        <div class="form-group">
          <label class="label">Role</label>
          <select v-model="form.role" class="input">
            <option value="technician">Technician</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">{{ editing ? 'New Password' : 'Password *' }}<span v-if="editing" style="font-weight:400;color:var(--ct-muted);font-size:11px;"> (leave blank to keep current)</span></label>
          <input v-model="form.password" type="password" class="input" placeholder="Min. 6 characters" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <label class="label">Phone</label>
          <input v-model="form.phone" class="input" placeholder="Optional" />
        </div>
        <div class="form-group form-full" v-if="editing">
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showModal = false">Cancel</button>
        <button class="btn-primary" :disabled="saving || !canSubmit" @click="save">
          <Save :size="14" /> {{ saving ? 'Saving…' : (editing ? 'Update' : 'Add Employee') }}
        </button>
      </template>
    </AppModal>

    <ConfirmDialog ref="confirmRef" title="Delete Employee" @confirm="doDelete" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Users, Plus, Search, Pencil, Trash2, Save, CheckCircle2, Ban } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useCollection } from '@/composables/useCollection'
import { useUIStore } from '@/stores/ui'
import { useActivityStore } from '@/stores/activity'
import { Collections } from '@/firebase/collections'

const ui = useUIStore()
const activity = useActivityStore()
const { items: employees, loading, add, edit, del } = useCollection(Collections.EMPLOYEES)

const search = ref('')
const filteredEmployees = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = q
    ? employees.value.filter(e => (e.fullName || '').toLowerCase().includes(q) || (e.username || '').toLowerCase().includes(q))
    : employees.value
  return [...list].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''))
})

const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)
const defaultForm = () => ({ fullName: '', username: '', role: 'technician', password: '', phone: '', status: 'active' })
const form = ref(defaultForm())

const canSubmit = computed(() => {
  if (!form.value.fullName.trim() || !form.value.username.trim()) return false
  if (!editing.value && form.value.password.length < 6) return false
  if (form.value.password && form.value.password.length < 6) return false
  return true
})

function openAdd() {
  editing.value = null
  form.value = defaultForm()
  showModal.value = true
}

function openEdit(emp) {
  editing.value = emp
  form.value = {
    fullName: emp.fullName || '',
    username: emp.username || '',
    role: emp.role || 'technician',
    password: '',
    phone: emp.phone || '',
    status: emp.status || 'active',
  }
  showModal.value = true
}

async function save() {
  if (!canSubmit.value) return
  const username = form.value.username.trim().toLowerCase()
  const dup = employees.value.find(e =>
    (e.username || '').toLowerCase() === username && (!editing.value || e.id !== editing.value.id)
  )
  if (dup) { ui.error('That username is already taken.'); return }

  saving.value = true
  try {
    const data = {
      fullName: form.value.fullName.trim(),
      username,
      role: form.value.role,
      phone: form.value.phone.trim(),
      status: form.value.status || 'active',
    }
    if (form.value.password) data.password = form.value.password

    if (editing.value) {
      await edit(editing.value.id, data)
      activity.log({ action: 'updated', module: 'hr', tab: 'HR', summary: `Updated employee ${data.fullName}` })
      ui.success('Employee updated.')
    } else {
      await add(data, { action: 'created', module: 'hr', tab: 'HR', summary: `Added employee ${data.fullName}` })
      ui.success('Employee added.')
    }
    showModal.value = false
  } catch (e) {
    ui.error('Failed to save employee.')
  } finally {
    saving.value = false
  }
}

async function toggleStatus(emp) {
  const newStatus = emp.status === 'inactive' ? 'active' : 'inactive'
  await edit(emp.id, { status: newStatus })
  ui.success(newStatus === 'inactive' ? 'Employee deactivated.' : 'Employee activated.')
}

const confirmRef = ref(null)
let pendingDeleteId = null
function confirmDelete(emp) {
  pendingDeleteId = emp.id
  confirmRef.value?.open(`Delete ${emp.fullName}? This cannot be undone.`)
}
async function doDelete() {
  if (!pendingDeleteId) return
  await del(pendingDeleteId)
  ui.success('Employee deleted.')
  pendingDeleteId = null
}
</script>
