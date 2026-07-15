<template>
  <div class="sig-wrapper">
    <div class="sig-header">
      <div class="sig-label-row">
        <span class="sig-label">{{ label }}</span>
        <span v-if="modelValue" class="sig-done-badge">✓ Signed</span>
      </div>
      <button type="button" class="sig-clear-btn" @click="clear">Clear</button>
    </div>
    <canvas
      ref="canvasRef"
      class="sig-canvas"
      :style="`--border: ${borderColor}; background:#fff; border-radius:8px;`"
      @mousedown="start"
      @mousemove="draw"
      @mouseup="stop"
      @mouseleave="stop"
      @touchstart.prevent="touchStart"
      @touchmove.prevent="touchDraw"
      @touchend="stop"
    ></canvas>
    <p class="sig-hint">Draw signature above using mouse or touch</p>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: 'Signature' },
  borderColor: { type: String, default: '#6366f1' },
})
const emit = defineEmits(['update:modelValue'])

const canvasRef = ref(null)
let ctx = null
let drawing = false

onMounted(() => {
  const canvas = canvasRef.value
  canvas.width = canvas.offsetWidth || 480
  canvas.height = 160
  initCtx(canvas)
  if (props.modelValue) restoreImage(props.modelValue)
})

function initCtx(canvas) {
  ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

function restoreImage(src) {
  const img = new Image()
  img.onload = () => ctx.drawImage(img, 0, 0)
  img.src = src
}

function getPos(e) {
  const rect = canvasRef.value.getBoundingClientRect()
  const scaleX = canvasRef.value.width / rect.width
  const scaleY = canvasRef.value.height / rect.height
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
}

function start(e) {
  drawing = true
  const p = getPos(e)
  ctx.beginPath()
  ctx.moveTo(p.x, p.y)
}

function draw(e) {
  if (!drawing) return
  const p = getPos(e)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
}

function stop() {
  if (!drawing) return
  drawing = false
  ctx.closePath()
  emit('update:modelValue', canvasRef.value.toDataURL('image/png'))
}

function touchStart(e) {
  const t = e.touches[0]
  start({ clientX: t.clientX, clientY: t.clientY })
}

function touchDraw(e) {
  const t = e.touches[0]
  draw({ clientX: t.clientX, clientY: t.clientY })
}

function clear() {
  const canvas = canvasRef.value
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  emit('update:modelValue', '')
}

watch(() => props.modelValue, (val) => {
  if (!val && canvasRef.value) clear()
  else if (val && canvasRef.value) restoreImage(val)
})
</script>

<style scoped>
.sig-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sig-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sig-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sig-label {
  font-size: 12px;
  font-weight: 600;
  color:var(--ct-sub);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.sig-done-badge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 20px;
  background: rgba(34,197,94,0.15);
  color: #4ade80;
  font-weight: 600;
}
.sig-clear-btn {
  font-size: 11px;
  color: #ef4444;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 6px;
  padding: 3px 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.sig-clear-btn:hover {
  background: rgba(239,68,68,0.15);
}
.sig-canvas {
  width: 100%;
  height: 160px;
  border-radius: 10px;
  border: 2px solid var(--border, #6366f1);
  cursor: crosshair;
  display: block;
  touch-action: none;
}
.sig-hint {
  font-size: 11px;
  color:var(--ct-muted);
  text-align: center;
  margin: 0;
}

.sig-canvas {
  background: #fff;
}
</style>
