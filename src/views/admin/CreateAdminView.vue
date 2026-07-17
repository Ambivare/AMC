<template>
  <div class="admin-setup-wrap">
    <div class="admin-setup-card">
      <div class="brand">
        <div class="brand-name">TAB Elevators</div>
        <div class="brand-sub">Admin Account Management</div>
      </div>

      <!-- Existing admins list -->
      <div v-if="admins.length" style="margin-bottom:24px;">
        <div class="section-title">Existing Admin Accounts</div>
        <div v-for="a in admins" :key="a.id" class="admin-row">
          <div style="flex:1;min-width:0;">
            <div class="admin-name">{{ a.fullName || a.username }}</div>
            <div class="admin-meta">{{ a.username }} · {{ a.email || 'No email' }}</div>
          </div>
          <button class="btn-edit" @click="startEdit(a)">Edit</button>
        </div>
      </div>

      <div v-if="fetchError" class="alert-error">{{ fetchError }}</div>

      <!-- Form: create or edit -->
      <div v-if="done" class="success-block">
        <div class="success-icon">✓</div>
        <h2>{{ editingId ? 'Admin updated!' : 'Admin created!' }}</h2>
        <p>You can now log in with those credentials.</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:18px;">
          <a href="/login" class="btn-primary" style="text-decoration:none;">Go to Login</a>
          <button class="btn-secondary" @click="resetForm">Add Another Admin</button>
        </div>
      </div>

      <form v-else @submit.prevent="submit">
        <h2 class="form-title">{{ editingId ? 'Edit Admin Account' : 'Create New Admin' }}</h2>

        <div class="field">
          <label>Username *</label>
          <input v-model="form.username" class="input" required autocomplete="off" placeholder="e.g. admin" :disabled="checking" />
        </div>

        <div class="field">
          <label>Full Name *</label>
          <input v-model="form.fullName" class="input" required placeholder="Administrator" :disabled="checking" />
        </div>

        <div class="field">
          <label>Email</label>
          <input v-model="form.email" class="input" type="email" placeholder="admin@company.com" :disabled="checking" />
        </div>

        <div class="field">
          <label>{{ editingId ? 'New Password' : 'Password *' }} <span v-if="editingId" style="font-weight:400;color:var(--ct-muted,#64748b);font-size:11px;">(leave blank to keep current)</span></label>
          <div class="pw-wrap">
            <input
              v-model="form.password"
              class="input"
              :type="showPw ? 'text' : 'password'"
              :required="!editingId"
              :minlength="form.password ? 6 : undefined"
              autocomplete="new-password"
              placeholder="Min. 6 characters"
              :disabled="checking"
            />
            <button type="button" class="pw-toggle" @click="showPw = !showPw" tabindex="-1">{{ showPw ? '🙈' : '👁' }}</button>
          </div>
        </div>

        <div class="field" v-if="form.password">
          <label>Confirm Password *</label>
          <input
            v-model="form.confirmPassword"
            class="input"
            :type="showPw ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="Re-enter password"
            :disabled="checking"
          />
          <span v-if="form.confirmPassword && form.password !== form.confirmPassword" class="field-error">
            Passwords do not match.
          </span>
        </div>

        <div v-if="submitError" class="alert-error">{{ submitError }}</div>

        <div style="display:flex;gap:10px;margin-top:8px;">
          <button v-if="editingId" type="button" class="btn-secondary btn-full" @click="cancelEdit" :disabled="checking">
            Cancel
          </button>
          <button type="submit" class="btn-primary btn-full" :disabled="checking || !canSubmit">
            <span v-if="checking" class="spinner" />
            {{ editingId ? 'Update Admin' : 'Create Admin' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getAll, create, update } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { auth as firebaseAuth } from '@/firebase/config'
import { signInAnonymously } from 'firebase/auth'

const emptyForm = () => ({ username: '', fullName: '', email: '', password: '', confirmPassword: '' })

const form = ref(emptyForm())
const showPw = ref(false)
const checking = ref(false)
const done = ref(false)
const editingId = ref(null)
const admins = ref([])
const fetchError = ref('')
const submitError = ref('')

const canSubmit = computed(() => {
  if (!form.value.username.trim() || !form.value.fullName.trim()) return false
  if (!editingId.value && form.value.password.length < 6) return false
  if (form.value.password && form.value.password !== form.value.confirmPassword) return false
  return true
})

onMounted(async () => {
  try {
    checking.value = true
    await signInAnonymously(firebaseAuth).catch(() => {})
    const users = await getAll(Collections.USERS)
    admins.value = users.filter(u => u.role === 'admin')
  } catch (e) {
    fetchError.value = 'Could not connect to database. Check your Firebase config.'
  } finally {
    checking.value = false
  }
})

function startEdit(admin) {
  editingId.value = admin.id
  form.value = {
    username: admin.username || '',
    fullName: admin.fullName || '',
    email: admin.email || '',
    password: '',
    confirmPassword: '',
  }
  done.value = false
  submitError.value = ''
}

function cancelEdit() {
  editingId.value = null
  form.value = emptyForm()
  submitError.value = ''
}

function resetForm() {
  editingId.value = null
  form.value = emptyForm()
  done.value = false
  submitError.value = ''
}

async function submit() {
  submitError.value = ''
  if (!canSubmit.value) return
  checking.value = true
  try {
    const payload = {
      username: form.value.username.trim(),
      fullName: form.value.fullName.trim(),
      email: form.value.email.trim(),
      role: 'admin',
      status: 'active',
    }
    if (form.value.password) {
      payload.password = form.value.password
    }

    if (editingId.value) {
      await update(Collections.USERS, editingId.value, payload)
      // Refresh admins list
      const users = await getAll(Collections.USERS)
      admins.value = users.filter(u => u.role === 'admin')
    } else {
      const newId = await create(Collections.USERS, payload)
      admins.value.push({ id: newId, ...payload })
    }
    done.value = true
  } catch (e) {
    submitError.value = `Failed to save: ${e.message || e}`
  } finally {
    checking.value = false
  }
}
</script>

<style scoped>
.admin-setup-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ct-bg, #0a0a14);
  padding: 24px;
}

.admin-setup-card {
  width: 100%;
  max-width: 480px;
  background: var(--ct-surface, #13131f);
  border: 1px solid rgba(99,102,241,0.2);
  border-radius: 20px;
  padding: 36px 32px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5);
}

.brand { text-align: center; margin-bottom: 28px; }
.brand-name { font-size: 18px; font-weight: 700; color: var(--ct-primary, #e2e8f0); }
.brand-sub { font-size: 12px; color: var(--ct-muted, #64748b); margin-top: 4px; }

.section-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: var(--ct-muted, #64748b); margin-bottom: 10px;
}

.admin-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 10px;
  background: rgba(99,102,241,0.06); border: 1px solid rgba(99,102,241,0.12);
  margin-bottom: 8px;
}
.admin-name { font-size: 13px; font-weight: 600; color: var(--ct-primary, #e2e8f0); }
.admin-meta { font-size: 11px; color: var(--ct-muted, #64748b); margin-top: 2px; }
.btn-edit {
  padding: 4px 12px; font-size: 12px; font-weight: 600;
  background: rgba(99,102,241,0.12); color: #818cf8;
  border: 1px solid rgba(99,102,241,0.2); border-radius: 7px;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
}
.btn-edit:hover { background: rgba(99,102,241,0.2); }

.form-title { font-size: 17px; font-weight: 700; color: var(--ct-primary, #e2e8f0); margin: 0 0 20px; }

.field { margin-bottom: 16px; }
.field label {
  display: block; font-size: 12px; font-weight: 600;
  color: var(--ct-sub, #94a3b8); margin-bottom: 6px;
  text-transform: uppercase; letter-spacing: .04em;
}
.field-error { font-size: 11px; color: #f87171; margin-top: 4px; display: block; }

.pw-wrap { position: relative; }
.pw-toggle {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; font-size: 16px; padding: 0; line-height: 1;
}

.btn-full { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; }

.btn-primary {
  background: #6366f1; color: #fff; border: none; border-radius: 10px;
  padding: 11px 20px; font-size: 14px; font-weight: 600; cursor: pointer;
}
.btn-primary:hover:not(:disabled) { background: #4f52e0; }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }

.btn-secondary {
  background: rgba(255,255,255,0.06); color: var(--ct-sub, #94a3b8);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
  padding: 11px 20px; font-size: 14px; font-weight: 600; cursor: pointer;
}
.btn-secondary:hover:not(:disabled) { background: rgba(255,255,255,0.1); }

.input {
  width: 100%; padding: 10px 13px; border-radius: 10px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  color: var(--ct-primary, #e2e8f0); font-size: 14px; outline: none; box-sizing: border-box;
}
.input:focus { border-color: rgba(99,102,241,0.5); }

.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

.alert-error {
  background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
  border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #f87171; margin-bottom: 16px;
}

.success-block { text-align: center; padding: 16px 0; }
.success-icon {
  width: 60px; height: 60px; background: rgba(74,222,128,0.15);
  border: 2px solid #4ade80; border-radius: 50%; font-size: 28px; color: #4ade80;
  display: flex; align-items: center; justify-content: center; margin: 0 auto 18px;
}
.success-block h2 { font-size: 18px; font-weight: 700; color: var(--ct-primary, #e2e8f0); margin: 0 0 8px; }
.success-block p { font-size: 13px; color: var(--ct-muted, #64748b); margin: 0; }
</style>
