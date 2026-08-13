<template>
  <div class="star-wrap">
    <div class="stars" :class="{ interactive: !readonly }">
      <span
        v-for="n in 5"
        :key="n"
        class="star"
        :class="{ filled: n <= (readonly ? modelValue : hovered || modelValue) }"
        @mouseenter="!readonly && (hovered = n)"
        @mouseleave="!readonly && (hovered = 0)"
        @click="!readonly && select(n)"
      >★</span>
    </div>
    <span v-if="modelValue" class="star-label">{{ labels[modelValue - 1] }}</span>
    <span v-else class="star-label muted">No rating yet</span>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  readonly: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const labels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent']
const hovered = ref(0)

function select(n) {
  // Click same star to deselect
  emit('update:modelValue', props.modelValue === n ? 0 : n)
}
</script>

<style scoped>
.star-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.stars {
  display: flex;
  gap: 3px;
}
.star {
  font-size: 28px;
  line-height: 1;
  color: rgba(255,255,255,0.12);
  transition: color 0.15s, transform 0.1s;
  user-select: none;
}
.interactive .star {
  cursor: pointer;
}
.interactive .star:hover {
  transform: scale(1.15);
}
.star.filled {
  color: #f59e0b;
}
.star-label {
  font-size: 13px;
  font-weight: 600;
  color: #f59e0b;
}
.star-label.muted {
  color:var(--ct-muted);
  font-weight: 400;
}

[data-theme="light"] .star {
  color: #d1d5db;
}
[data-theme="light"] .star.filled {
  color: #f59e0b;
}
</style>
