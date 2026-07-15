<template>
  <Teleport to="body">
    <div v-if="secStore.requiresVerification || secStore.suspiciousLocked" class="sec-overlay">
      <div class="sec-modal">

        <!-- LOCKED STATE -->
        <template v-if="secStore.suspiciousLocked">
          <div class="sec-icon locked">
            <ShieldAlert :size="40" />
          </div>
          <h2 class="sec-title" style="color:#ef4444;">Session Locked</h2>
          <p class="sec-sub">
            Too many failed verification attempts detected.<br />
            An alert has been sent to admin devices.<br />
            Please close and re-login.
          </p>
          <button class="btn btn-danger" style="width:100%;margin-top:8px;" @click="forceLogout">
            Log Out
          </button>
        </template>

        <!-- VERIFY STATE -->
        <template v-else>
          <div class="sec-icon warn">
            <ShieldCheck :size="40" />
          </div>
          <h2 class="sec-title">Admin Verification Required</h2>
          <p class="sec-sub">
            Suspicious activity detected ({{ secStore.deleteCount }} deletes).<br />
            Please verify your admin credentials to continue.
          </p>

          <div v-if="error" class="sec-error">{{ error }}</div>

          <div class="sec-field">
            <label>Username</label>
            <input v-model="username" class="input" placeholder="Admin username" autocomplete="username" />
          </div>
          <div class="sec-field">
            <label>Password</label>
            <div style="position:relative;">
              <input
                v-model="password"
                :type="showPwd ? 'text' : 'password'"
                class="input"
                placeholder="Admin password"
                autocomplete="current-password"
                @keydown.enter="verify"
              />
              <button class="pwd-eye" @click="showPwd = !showPwd" type="button">
                <Eye v-if="!showPwd" :size="14" />
                <EyeOff v-else :size="14" />
              </button>
            </div>
          </div>

          <div v-if="secStore.failedVerifyCount > 0" class="sec-attempts">
            {{ MAX_FAILED - secStore.failedVerifyCount }} attempt(s) remaining before session lock
          </div>

          <button class="btn btn-primary" style="width:100%;margin-top:4px;" :disabled="verifying" @click="verify">
            <Loader2 v-if="verifying" :size="14" class="spin" />
            <span v-else>Verify & Continue</span>
          </button>
        </template>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import { ShieldAlert, ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-vue-next'
import { useSecurityStore } from '@/stores/security'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const MAX_FAILED = 3

const secStore  = useSecurityStore()
const authStore = useAuthStore()
const router    = useRouter()

const username  = ref(authStore.user?.username || '')
const password  = ref('')
const showPwd   = ref(false)
const verifying = ref(false)
const error     = ref('')

async function verify() {
  if (!username.value || !password.value) {
    error.value = 'Both fields are required.'
    return
  }
  verifying.value = true
  error.value = ''
  const ok = await secStore.verifyPassword(username.value, password.value)
  verifying.value = false
  if (!ok) {
    password.value = ''
    if (!secStore.suspiciousLocked) {
      error.value = 'Incorrect credentials. Try again.'
    }
  }
}

async function forceLogout() {
  await authStore.logout?.()
  router.push('/login')
}
</script>

<style scoped>
.sec-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.sec-modal {
  background: #1e1b33;
  border: 1px solid #312e56;
  border-radius: 20px;
  padding: 36px 32px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 24px 60px rgba(0,0,0,.7);
}

.sec-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  margin: 0 auto 20px;
}
.sec-icon.warn  { background: rgba(251,191,36,.12); color: #fbbf24; }
.sec-icon.locked { background: rgba(239,68,68,.12); color: #ef4444; }

.sec-title {
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
  text-align: center;
  margin: 0 0 8px;
}

.sec-sub {
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
  line-height: 1.6;
  margin: 0 0 20px;
}

.sec-error {
  background: rgba(239,68,68,.1);
  border: 1px solid rgba(239,68,68,.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 13px;
  padding: 10px 14px;
  margin-bottom: 14px;
  text-align: center;
}

.sec-field {
  margin-bottom: 14px;
}
.sec-field label {
  display: block;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 6px;
  font-weight: 500;
}

.sec-attempts {
  font-size: 12px;
  color: #fbbf24;
  text-align: center;
  margin-bottom: 10px;
}

.pwd-eye {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
}

.spin { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
