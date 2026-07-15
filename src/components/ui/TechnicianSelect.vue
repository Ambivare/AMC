<template>
  <div class="tech-select-wrapper">
    <!-- Selected tags -->
    <div class="tech-tags-input" @click="focusInput" :class="{ focused }">
      <span
        v-for="name in modelValue"
        :key="name"
        class="tech-tag"
      >
        {{ name }}
        <button type="button" @click.stop="remove(name)" class="tech-tag-remove">×</button>
      </span>
      <input
        ref="inputRef"
        v-model="query"
        class="tech-tag-input-field"
        :placeholder="modelValue.length ? '' : placeholder"
        @focus="focused = true; open = true"
        @blur="delayClose"
        @keydown.enter.prevent="selectFirst"
        @keydown.backspace="onBackspace"
      />
    </div>

    <!-- Dropdown -->
    <div v-if="open && filtered.length" class="tech-dropdown">
      <div
        v-for="emp in filtered"
        :key="emp.id"
        class="tech-option"
        :class="{ selected: modelValue.includes(emp.fullName || emp.name) }"
        @mousedown.prevent="select(emp)"
      >
        <div class="tech-opt-avatar">{{ initials(emp) }}</div>
        <div>
          <div class="tech-opt-name">{{ emp.fullName || emp.name }}</div>
          <div class="tech-opt-role">{{ emp.role || 'Technician' }}</div>
        </div>
        <span v-if="modelValue.includes(emp.fullName || emp.name)" class="tech-opt-check">✓</span>
      </div>
    </div>
    <div v-else-if="open && query && !filtered.length" class="tech-dropdown">
      <div class="tech-option" style="color:var(--ct-muted);cursor:default;">No technicians found</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useCollection } from '@/composables/useCollection'
import { Collections } from '@/firebase/collections'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select technician(s)…' },
})
const emit = defineEmits(['update:modelValue'])

const { items: employees } = useCollection(Collections.EMPLOYEES)
const query = ref('')
const open = ref(false)
const focused = ref(false)
const inputRef = ref(null)

const technicians = computed(() =>
  employees.value.filter(e => e.role === 'technician' || e.role === 'admin')
)

const filtered = computed(() => {
  const q = query.value.toLowerCase()
  return technicians.value.filter(e => {
    const n = (e.fullName || e.name || '').toLowerCase()
    return n.includes(q)
  })
})

function focusInput() {
  inputRef.value?.focus()
  open.value = true
}

function delayClose() {
  focused.value = false
  setTimeout(() => { open.value = false }, 180)
}

function initials(emp) {
  const n = emp.fullName || emp.name || '?'
  return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function select(emp) {
  const name = emp.fullName || emp.name
  const current = [...props.modelValue]
  const idx = current.indexOf(name)
  if (idx === -1) current.push(name)
  else current.splice(idx, 1)
  emit('update:modelValue', current)
  query.value = ''
}

function remove(name) {
  emit('update:modelValue', props.modelValue.filter(n => n !== name))
}

function selectFirst() {
  if (filtered.value.length) select(filtered.value[0])
}

function onBackspace() {
  if (!query.value && props.modelValue.length) {
    emit('update:modelValue', props.modelValue.slice(0, -1))
  }
}
</script>

<style scoped>
.tech-select-wrapper { position: relative; }

.tech-tags-input {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  padding: 7px 12px; min-height: 42px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px; cursor: text; transition: all 0.2s;
}
.tech-tags-input.focused {
  background: rgba(255,255,255,0.07);
  border-color: rgba(99,102,241,0.45);
  box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
}
.tech-tag {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px 3px 10px; border-radius: 20px;
  background: rgba(99,102,241,0.18); border: 1px solid rgba(99,102,241,0.3);
  color:var(--ct-accent); font-size: 12px; font-weight: 500;
}
.tech-tag-remove {
  background: none; border: none; color:var(--ct-accent);
  cursor: pointer; padding: 0; font-size: 14px; line-height: 1;
  display: flex; align-items: center;
}
.tech-tag-remove:hover { color: #f87171; }
.tech-tag-input-field {
  border: none; outline: none; background: transparent;
  color:var(--ct-primary); font-size: 13px; min-width: 120px; flex: 1;
}
.tech-tag-input-field::placeholder { color:var(--ct-muted); }

.tech-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px; z-index: 300; max-height: 200px; overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.tech-option {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 14px; cursor: pointer; transition: background 0.15s;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.tech-option:last-child { border-bottom: none; }
.tech-option:hover, .tech-option.selected { background: rgba(99,102,241,0.12); }
.tech-opt-avatar {
  width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
  background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3));
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color:var(--ct-accent);
}
.tech-opt-name { font-size: 13px; color:var(--ct-primary); font-weight: 500; }
.tech-opt-role { font-size: 11px; color:var(--ct-muted); }
.tech-opt-check { margin-left: auto; color:var(--ct-green); font-size: 14px; }

/* Light theme */
[data-theme="light"] .tech-tags-input {
  background: rgba(255,255,255,0.9);
  border-color: rgba(0,0,0,0.12);
}
[data-theme="light"] .tech-tags-input.focused {
  background: #fff;
  border-color: rgba(99,102,241,0.5);
}
[data-theme="light"] .tech-tag { background: rgba(99,102,241,0.12); color: #4f46e5; border-color: rgba(99,102,241,0.25); }
[data-theme="light"] .tech-tag-remove { color: #6366f1; }
[data-theme="light"] .tech-tag-input-field { color: #1e293b; }
[data-theme="light"] .tech-dropdown { background: #fff; border-color: rgba(0,0,0,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
[data-theme="light"] .tech-option:hover, [data-theme="light"] .tech-option.selected { background: rgba(99,102,241,0.08); }
[data-theme="light"] .tech-opt-name { color: #1e293b; }
</style>
