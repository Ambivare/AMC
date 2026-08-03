<template>
  <teleport to="body">
    <transition name="backdrop">
      <div v-if="modelValue" class="modal-backdrop" @mousedown.self="onBackdropClose">
        <transition name="modal">
          <div v-if="modelValue" class="modal-panel" :style="{ maxWidth: width }" @mousedown.stop>
            <!-- Header -->
            <div class="modal-header">
              <div>
                <h3 class="modal-title">{{ title }}</h3>
                <p v-if="subtitle" class="modal-subtitle">{{ subtitle }}</p>
              </div>
              <!-- X button ALWAYS closes, even when persistent -->
              <button class="modal-close-btn" @click="onXClose" type="button" title="Close">
                <X :size="16" />
              </button>
            </div>

            <div class="modal-body">
              <slot />
            </div>

            <div class="modal-footer" v-if="$slots.footer">
              <slot name="footer" />
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'
import { X } from 'lucide-vue-next'
import { pushBackHandler, removeBackHandler } from '@/utils/backHandlerStack'

const props = defineProps({
  modelValue: Boolean,
  title: String,
  subtitle: String,
  width: { type: String, default: '600px' },
  persistent: Boolean, // blocks backdrop click only — X button still closes
})

const emit = defineEmits(['update:modelValue', 'close'])

// Guards against the tap that OPENS the modal also being read as a tap that
// closes it. On some devices the modal's paint lands late enough after the
// opening tap that a user's instinctive follow-up tap — or a stray/ghost
// touch event the browser synthesizes for the same gesture — arrives at the
// same screen position now occupied by the backdrop, closing the form
// before it's even seen. Ignoring backdrop clicks for a brief window right
// after opening fixes that without weakening the "tap outside to close"
// behavior once the modal has actually settled.
const OPEN_GRACE_MS = 400
let openedAt = 0

function onBackdropClose() {
  if (props.persistent) return
  if (Date.now() - openedAt < OPEN_GRACE_MS) return
  emit('update:modelValue', false)
  emit('close')
}

function onXClose() {
  emit('update:modelValue', false)
  emit('close')
}

// Hardware back button closes this modal instead of navigating the page
// behind it — see src/utils/backHandlerStack.js.
let backHandlerEntry = null
watch(() => props.modelValue, (open) => {
  if (open) {
    openedAt = Date.now()
    backHandlerEntry = pushBackHandler(() => {
      emit('update:modelValue', false)
      emit('close')
    })
  } else if (backHandlerEntry) {
    removeBackHandler(backHandlerEntry)
    backHandlerEntry = null
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (backHandlerEntry) removeBackHandler(backHandlerEntry)
})
</script>

<style scoped>
.modal-title { font-size: 16px; font-weight: 600; color: #f1f5f9; margin: 0; }
.modal-subtitle { font-size: 13px; color:var(--ct-muted); margin-top: 3px; }
.modal-close-btn {
  width: 32px; height: 32px; border-radius: 9px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  color:var(--ct-sub); cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  transition: all 0.15s; flex-shrink: 0;
}
.modal-close-btn:hover { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.2); color: #f87171; }

[data-theme="light"] .modal-title { color: #1e293b; }
[data-theme="light"] .modal-subtitle { color:var(--ct-muted); }
[data-theme="light"] .modal-close-btn {
  background: rgba(0,0,0,0.05);
  border-color: rgba(0,0,0,0.12);
  color:var(--ct-muted);
}
[data-theme="light"] .modal-close-btn:hover {
  background: rgba(239,68,68,0.08);
  border-color: rgba(239,68,68,0.2);
  color: #ef4444;
}
</style>
