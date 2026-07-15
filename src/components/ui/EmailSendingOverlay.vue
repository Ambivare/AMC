<template>
  <Teleport to="body">
    <Transition name="overlay-fade">
      <div
        v-if="show"
        style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:24px;"
      >
        <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:20px;width:100%;max-width:380px;padding:40px 32px;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.7);">

          <!-- Loading state -->
          <template v-if="!success && !error">
            <div style="width:72px;height:72px;margin:0 auto 28px;background:rgba(99,102,241,0.12);border-radius:18px;display:flex;align-items:center;justify-content:center;">
              <Send :size="30" class="send-pulse" style="color:#818cf8;" />
            </div>
            <div style="font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:8px;">Sending Email</div>
            <div style="font-size:13px;color:#94a3b8;margin-bottom:28px;min-height:20px;">{{ step || 'Please wait…' }}</div>
            <div style="height:5px;background:rgba(255,255,255,0.07);border-radius:99px;overflow:hidden;">
              <div class="progress-bar" style="height:100%;width:45%;background:linear-gradient(90deg,#6366f1,#a78bfa);border-radius:99px;"></div>
            </div>
            <div style="margin-top:16px;font-size:11px;color:rgba(148,163,184,0.5);">Do not close this window</div>
          </template>

          <!-- Success state -->
          <template v-else-if="success">
            <div style="width:72px;height:72px;margin:0 auto 28px;background:rgba(34,197,94,0.12);border-radius:18px;display:flex;align-items:center;justify-content:center;">
              <CheckCircle :size="34" style="color:#4ade80;" />
            </div>
            <div style="font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:8px;">Email Sent!</div>
            <div style="font-size:13px;color:#94a3b8;">Closing automatically…</div>
          </template>

          <!-- Error state -->
          <template v-else-if="error">
            <div style="width:72px;height:72px;margin:0 auto 28px;background:rgba(239,68,68,0.12);border-radius:18px;display:flex;align-items:center;justify-content:center;">
              <XCircle :size="34" style="color:#f87171;" />
            </div>
            <div style="font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:10px;">Failed to Send</div>
            <div style="font-size:12px;color:#f87171;margin-bottom:28px;word-break:break-word;line-height:1.6;max-height:100px;overflow-y:auto;">{{ error }}</div>
            <button
              @click="$emit('close')"
              style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#f87171;padding:10px 28px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;transition:background .15s;"
              @mouseover="e => e.target.style.background='rgba(239,68,68,0.25)'"
              @mouseout="e => e.target.style.background='rgba(239,68,68,0.15)'"
            >Dismiss</button>
          </template>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { Send, CheckCircle, XCircle } from 'lucide-vue-next'

defineProps({
  show:    { type: Boolean, default: false },
  step:    { type: String,  default: '' },
  success: { type: Boolean, default: false },
  error:   { type: String,  default: '' },
})
defineEmits(['close'])
</script>

<style scoped>
@keyframes indeterminate {
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(320%); }
}
@keyframes sendPulse {
  0%, 100% { transform: scale(1) rotate(0deg);   opacity: 1; }
  50%       { transform: scale(1.18) rotate(8deg); opacity: 0.75; }
}
.send-pulse  { animation: sendPulse 1.3s ease-in-out infinite; }
.progress-bar { animation: indeterminate 1.6s ease-in-out infinite; }
.overlay-fade-enter-active, .overlay-fade-leave-active { transition: opacity 0.2s ease; }
.overlay-fade-enter-from, .overlay-fade-leave-to       { opacity: 0; }
</style>
