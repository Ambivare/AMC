<template>
  <!--
    Swipe-left-to-right-to-confirm slider. Replaces a tap-to-submit button
    with a deliberate drag gesture — a single accidental/ghost tap can never
    trigger it, since it requires sustained movement across the track.
  -->
  <div
    ref="trackRef"
    class="swipe-confirm"
    :class="{ 'is-disabled': disabled, 'is-done': state === 'done', 'is-dragging': dragging }"
  >
    <div class="swipe-confirm-fill" :style="{ width: fillWidth + 'px' }"></div>
    <span class="swipe-confirm-label" :style="{ opacity: labelOpacity }">
      {{ state === 'done' ? doneLabel : label }}
    </span>
    <div
      class="swipe-confirm-thumb"
      :style="{ transform: `translateX(${thumbX}px)` }"
      @pointerdown="onPointerDown"
    >
      <Loader2 v-if="loading" :size="18" class="spin" />
      <Check v-else-if="state === 'done'" :size="18" />
      <ChevronsRight v-else :size="18" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { ChevronsRight, Check, Loader2 } from 'lucide-vue-next'

const props = defineProps({
  label:     { type: String, default: 'Swipe to create' },
  doneLabel: { type: String, default: 'Created' },
  disabled:  { type: Boolean, default: false },
  loading:   { type: Boolean, default: false },
  threshold: { type: Number, default: 0.8 }, // fraction of track width that counts as "confirmed"
})

const emit = defineEmits(['confirm'])

const trackRef = ref(null)
const thumbX   = ref(0)
const dragging = ref(false)
const state    = ref('idle') // idle | done
let maxX = 0
let startClientX = 0
let startThumbX = 0
let pointerId = null

const THUMB_SIZE = 44
const TRACK_PADDING = 4

function measure() {
  if (!trackRef.value) return
  maxX = Math.max(0, trackRef.value.clientWidth - THUMB_SIZE - TRACK_PADDING * 2)
}

const fillWidth = computed(() => thumbX.value + THUMB_SIZE / 2 + TRACK_PADDING)
const labelOpacity = computed(() => {
  if (state.value === 'done') return 1
  if (!maxX) return 1
  return Math.max(0, 1 - (thumbX.value / maxX) * 1.4)
})

function onPointerDown(e) {
  if (props.disabled || props.loading || state.value === 'done') return
  measure()
  dragging.value = true
  pointerId = e.pointerId
  startClientX = e.clientX
  startThumbX = thumbX.value
  e.target.setPointerCapture?.(pointerId)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(e) {
  if (!dragging.value) return
  const delta = e.clientX - startClientX
  thumbX.value = Math.min(maxX, Math.max(0, startThumbX + delta))
}

function onPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)

  if (maxX > 0 && thumbX.value >= maxX * props.threshold) {
    thumbX.value = maxX
    state.value = 'done'
    emit('confirm')
  } else {
    thumbX.value = 0
  }
}

// Lets the parent slide the thumb back to the start after a failed submit
// (e.g. a save error) so the user can retry.
function reset() {
  state.value = 'idle'
  thumbX.value = 0
}
defineExpose({ reset })

watch(() => props.disabled, (d) => {
  if (d && state.value !== 'done') thumbX.value = 0
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
})
</script>

<style scoped>
.swipe-confirm {
  position: relative;
  width: 100%;
  height: 52px;
  border-radius: 26px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  overflow: hidden;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}
.swipe-confirm.is-disabled { opacity: 0.5; pointer-events: none; }

.swipe-confirm-fill {
  position: absolute;
  top: 0; left: 0; bottom: 0;
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border-radius: 26px;
}
.swipe-confirm.is-dragging .swipe-confirm-fill { transition: none; }
.swipe-confirm:not(.is-dragging) .swipe-confirm-fill { transition: width 0.25s var(--ease-out-expo, ease); }

.swipe-confirm-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px; font-weight: 600; color: #cbd5e1;
  letter-spacing: 0.02em;
  pointer-events: none;
}
.swipe-confirm.is-done .swipe-confirm-label { color: #fff; }

.swipe-confirm-thumb {
  position: absolute;
  top: 4px; left: 4px;
  width: 44px; height: 44px;
  border-radius: 50%;
  background: #fff;
  color: #dc2626;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  cursor: grab;
  touch-action: none;
}
.swipe-confirm.is-dragging .swipe-confirm-thumb { cursor: grabbing; }
.swipe-confirm:not(.is-dragging) .swipe-confirm-thumb { transition: transform 0.25s var(--ease-out-expo, ease); }
.swipe-confirm.is-done .swipe-confirm-thumb { color: #16a34a; }

.spin { animation: swipe-spin 0.8s linear infinite; }
@keyframes swipe-spin { to { transform: rotate(360deg); } }

[data-theme="light"] .swipe-confirm { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); }
[data-theme="light"] .swipe-confirm-label { color: #475569; }
</style>
