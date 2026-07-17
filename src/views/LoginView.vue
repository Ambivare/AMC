<template>
  <div class="login-page">
    <div class="blob blob-1" /><div class="blob blob-2" /><div class="blob blob-3" />

    <div class="login-wrapper">
      <!-- Left branding -->
      <div class="login-brand">
        <div class="brand-logo">
          <img src="/favicon.png" alt="TAB Elevators" style="width:36px;height:36px;object-fit:contain;" onerror="this.style.display='none'" />
        </div>
        <h1 class="brand-title">TAB Elevators</h1>
        <p class="brand-subtitle">AMC &amp; Maintenance Manager</p>
        <div class="brand-stats">
          <div class="brand-stat" v-for="s in stats" :key="s.label">
            <div class="stat-val">{{ s.val }}</div>
            <div class="stat-lbl">{{ s.label }}</div>
          </div>
        </div>
        <div class="brand-features">
          <div class="feature-item" v-for="f in features" :key="f">
            <Check :size="13" class="feature-check" /><span>{{ f }}</span>
          </div>
        </div>
      </div>

      <!-- Right panel -->
      <div class="login-card">
        <div class="card-header">
          <h2 class="card-title">Welcome back</h2>
          <p class="card-sub">Sign in to your account</p>
        </div>
        <form class="login-form" @submit.prevent="handleLogin">
          <div class="form-group">
            <label class="label">Username</label>
            <div class="input-icon-wrap">
              <User :size="15" class="input-icon" />
              <input v-model="form.username" type="text" class="input pl-input"
                placeholder="Enter your username" autocomplete="username" required />
            </div>
          </div>
          <div class="form-group">
            <label class="label">Password</label>
            <div class="input-icon-wrap">
              <Lock :size="15" class="input-icon" />
              <input v-model="form.password" :type="showPass ? 'text' : 'password'"
                class="input pl-input pr-input" placeholder="Enter your password"
                autocomplete="current-password" required />
              <button type="button" class="input-icon-right" @click="showPass = !showPass">
                <component :is="showPass ? EyeOff : Eye" :size="15" />
              </button>
            </div>
          </div>
          <transition name="slide-up">
            <div class="error-msg" v-if="auth.error">
              <AlertCircle :size="14" /> {{ auth.error }}
            </div>
          </transition>
          <button type="submit" class="btn-primary w-full justify-center py-3" :disabled="auth.loading">
            <Loader2 v-if="auth.loading" :size="15" class="spin" />
            <LogIn v-else :size="15" />
            {{ auth.loading ? 'Signing in…' : 'Sign In' }}
          </button>
        </form>

        <div class="login-footer">
          <span>v1.0.0</span><span>·</span><span>Powered by Ambivare</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { User, Lock, Eye, EyeOff, AlertCircle, LogIn, Loader2, Check } from 'lucide-vue-next'

const auth   = useAuthStore()
const router = useRouter()

const form     = ref({ username: '', password: '' })
const showPass = ref(false)

const stats    = [{ val: '6', label: 'Modules' }, { val: '2', label: 'User Roles' }, { val: '24/7', label: 'Reminders' }]
const features = ['AMC contract & renewal tracking', 'Monthly maintenance scheduling', 'Complete billing pipeline', 'Automated due-date reminders', 'Admin & technician access']

async function handleLogin() {
  const result = await auth.login(form.value.username, form.value.password)
  if (result.success) router.push('/dashboard')
}
</script>

<style scoped>
.login-page {
  min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;
  padding:24px;background:url('/background.png') center/cover no-repeat fixed;
  position:relative;overflow:hidden;
}
.login-page::before { content:'';position:absolute;inset:0;background:rgba(0,0,0,.35);z-index:0; }

.blob { position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none; }
.blob-1 { width:500px;height:500px;background:rgba(99,102,241,.07);top:-100px;left:-100px; }
.blob-2 { width:400px;height:400px;background:rgba(168,85,247,.06);bottom:-80px;right:0; }
.blob-3 { width:300px;height:300px;background:rgba(59,130,246,.05);top:40%;left:40%; }

.login-wrapper {
  display:flex;width:100%;max-width:900px;border-radius:24px;overflow:hidden;
  border:1px solid rgba(255,255,255,.18);box-shadow:0 40px 120px rgba(0,0,0,.6);
  position:relative;z-index:1;backdrop-filter:blur(18px);
}

.login-brand {
  flex:1;padding:48px 40px;
  background:linear-gradient(145deg,rgba(30,30,60,.82),rgba(15,15,35,.88));
  border-right:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;
}
.brand-logo {
  width:52px;height:52px;border-radius:16px;
  background:linear-gradient(135deg,rgba(99,102,241,.3),rgba(168,85,247,.2));
  border:1px solid rgba(99,102,241,.3);display:flex;align-items:center;justify-content:center;margin-bottom:20px;
}
.brand-title { font-size:24px;font-weight:700;color:#f1f5f9;margin:0 0 6px;letter-spacing:-.5px; }
.brand-subtitle { font-size:13px;color:var(--ct-muted);margin:0 0 36px; }
.brand-stats { display:flex;gap:24px;margin-bottom:36px;padding-bottom:28px;border-bottom:1px solid rgba(255,255,255,.06); }
.stat-val { font-size:24px;font-weight:700;color:#6366f1;letter-spacing:-.5px; }
.stat-lbl { font-size:11px;color:var(--ct-muted);margin-top:2px; }
.brand-features { display:flex;flex-direction:column;gap:12px; }
.feature-item { display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ct-sub); }
.feature-check { color:var(--ct-green);flex-shrink:0; }

.login-card {
  width:380px;padding:48px 40px;
  background:rgba(8,8,22,.88);backdrop-filter:blur(24px);display:flex;flex-direction:column;
}
.card-title { font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 6px;letter-spacing:-.4px; }
.card-sub { font-size:13px;color:var(--ct-muted);margin:0 0 32px; }

.login-form { display:flex;flex-direction:column;gap:18px; }
.form-group { display:flex;flex-direction:column;gap:6px; }
.input-icon-wrap { position:relative; }
.input-icon { position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--ct-muted);pointer-events:none; }
.input-icon-right { position:absolute;right:12px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:var(--ct-muted);cursor:pointer;padding:0;display:flex; }
.pl-input { padding-left:38px !important; }
.pr-input { padding-right:38px !important; }

.error-msg {
  display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;
  background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.2);font-size:13px;
}

.w-full { width:100%; }
.justify-center { justify-content:center; }
.py-3 { padding-top:12px !important;padding-bottom:12px !important; }
.spin { animation:spin 1s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

.login-footer { display:flex;gap:8px;align-items:center;margin-top:auto;padding-top:32px;font-size:11px;color:#334155; }
.slide-up-enter-active,.slide-up-leave-active { transition:all .2s ease; }
.slide-up-enter-from,.slide-up-leave-to { opacity:0;transform:translateY(-4px); }

@media (max-width:700px) {
  .login-page { padding:0;align-items:stretch; }
  .login-wrapper { flex-direction:column;border-radius:0;border:none;box-shadow:none;max-width:100%;min-height:100dvh; }
  .login-brand { padding:36px 24px 24px;flex:0;border-right:none;border-bottom:1px solid rgba(255,255,255,.1); }
  .brand-title { font-size:20px; }
  .brand-subtitle { margin-bottom:20px; }
  .brand-stats { margin-bottom:0;padding-bottom:0;border-bottom:none;gap:20px; }
  .brand-features { display:none; }
  .login-card { width:100%;padding:28px 24px 36px;flex:1; }
  .card-sub { margin-bottom:24px; }
}
</style>
