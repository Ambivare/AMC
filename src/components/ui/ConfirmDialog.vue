<template>
  <AppModal :modelValue="isOpen" :title="title" width="420px" @update:modelValue="handleModelUpdate">
    <p class="confirm-msg">{{ currentMessage }}</p>
    <template #footer>
      <button class="btn-secondary" @click="close">Cancel</button>
      <button class="btn-danger" @click="onConfirm">
        <Trash2 :size="14" />
        {{ confirmLabel }}
      </button>
    </template>
  </AppModal>
</template>

<script setup>
import { ref, watch } from 'vue'
import AppModal from './AppModal.vue'
import { Trash2 } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: Boolean, default: undefined },
  title: { type: String, default: 'Confirm Action' },
  confirmLabel: { type: String, default: 'Delete' },
  message: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const isOpen = ref(false)
const currentMessage = ref('Are you sure you want to proceed?')

// Support both v-model binding and ref.open() method
watch(() => props.modelValue, (v) => {
  if (v !== undefined) isOpen.value = v
}, { immediate: true })

watch(() => props.message, (v) => {
  if (v) currentMessage.value = v
}, { immediate: true })

function handleModelUpdate(v) {
  isOpen.value = v
  if (props.modelValue !== undefined) emit('update:modelValue', v)
}

function open(message) {
  if (message) currentMessage.value = message
  isOpen.value = true
  if (props.modelValue !== undefined) emit('update:modelValue', true)
}

function close() {
  isOpen.value = false
  if (props.modelValue !== undefined) emit('update:modelValue', false)
}

function onConfirm() {
  emit('confirm')
  close()
}

defineExpose({ open })
</script>

<style scoped>
.confirm-msg { font-size: 14px; color:var(--ct-sub); line-height: 1.6; margin: 0; }
[data-theme="light"] .confirm-msg { color:var(--ct-muted); }
</style>
