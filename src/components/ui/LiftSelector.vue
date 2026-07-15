<template>
  <div v-if="project && project.buildings && project.buildings.length" class="lift-selector">
    <!-- Buildings -->
    <div class="form-group">
      <label class="label">Buildings</label>
      <div class="multi-select-grid">
        <label
          v-for="(building, bi) in project.buildings"
          :key="bi"
          class="multi-chip"
          :class="{ selected: selectedBuildingIndexes.includes(bi) }"
          @click="toggleBuilding(bi)"
        >
          <span class="chip-id">B{{ bi + 1 }}</span>
          {{ building.name || `Building ${bi + 1}` }}
        </label>
        <label class="multi-chip" :class="{ selected: allBuildingsSelected }" @click="toggleAllBuildings">
          All Buildings
        </label>
      </div>
    </div>

    <!-- Wings (filtered by selected buildings) -->
    <div v-if="availableWings.length" class="form-group">
      <label class="label">Wings</label>
      <div class="multi-select-grid">
        <label
          v-for="w in availableWings"
          :key="w.key"
          class="multi-chip"
          :class="{ selected: selectedWingKeys.includes(w.key) }"
          @click="toggleWing(w.key)"
        >
          <span class="chip-id">{{ w.bLabel }}-W{{ w.wi + 1 }}</span>
          {{ w.name || `Wing ${w.wi + 1}` }}
        </label>
        <label v-if="availableWings.length > 1" class="multi-chip" :class="{ selected: allWingsSelected }" @click="toggleAllWings">
          All Wings
        </label>
      </div>
    </div>

    <!-- Lifts (filtered by selected wings) -->
    <div v-if="availableLifts.length" class="form-group">
      <label class="label">Lifts</label>
      <div class="multi-select-grid">
        <label
          v-for="lift in availableLifts"
          :key="lift.id"
          class="multi-chip lift-chip"
          :class="{ selected: selectedLiftIds.includes(lift.id) }"
          @click="toggleLift(lift.id)"
        >
          <span class="chip-id">{{ lift.id }}</span>
          <span v-if="lift.type" class="chip-meta">{{ lift.type }}</span>
        </label>
        <label v-if="availableLifts.length > 1" class="multi-chip" :class="{ selected: allLiftsSelected }" @click="toggleAllLifts">
          All Lifts
        </label>
      </div>
    </div>

    <!-- Summary -->
    <div v-if="selectedLiftIds.length" style="margin-top:6px;padding:8px 12px;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.15);border-radius:8px;font-size:11px;color:var(--ct-accent);">
      Selected: {{ selectedLiftIds.join(', ') }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  project: { type: Object, default: null },
  modelValue: { type: Object, default: () => ({ buildings: [], wings: [], liftIds: [] }) },
})
const emit = defineEmits(['update:modelValue'])

const selectedBuildingIndexes = ref([])
const selectedWingKeys = ref([])
const selectedLiftIds = ref([])

// Sync from modelValue
watch(() => props.modelValue, (v) => {
  if (v) {
    selectedBuildingIndexes.value = v.buildingIndexes || []
    selectedWingKeys.value = v.wingKeys || []
    selectedLiftIds.value = v.liftIds || []
  }
}, { immediate: true })

// Reset when project changes
watch(() => props.project?.id, () => {
  selectedBuildingIndexes.value = []
  selectedWingKeys.value = []
  selectedLiftIds.value = []
  emitValue()
})

function emitValue() {
  emit('update:modelValue', {
    buildingIndexes: selectedBuildingIndexes.value,
    wingKeys: selectedWingKeys.value,
    liftIds: selectedLiftIds.value,
    buildings: selectedBuildingIndexes.value.map(bi => {
      const b = props.project?.buildings?.[bi]
      return b ? (b.name || `Building ${bi + 1}`) : ''
    }).filter(Boolean),
    wings: selectedWingKeys.value.map(k => {
      const [bi, wi] = k.split('-').map(Number)
      const w = props.project?.buildings?.[bi]?.wings?.[wi]
      return w ? (w.name || `Wing ${wi + 1}`) : ''
    }).filter(Boolean),
  })
}

const allBuildingsSelected = computed(() => {
  const n = props.project?.buildings?.length || 0
  return n > 0 && selectedBuildingIndexes.value.length === n
})

function toggleBuilding(bi) {
  const idx = selectedBuildingIndexes.value.indexOf(bi)
  if (idx >= 0) {
    selectedBuildingIndexes.value.splice(idx, 1)
    // Remove wings/lifts in this building
    const building = props.project?.buildings?.[bi]
    if (building) {
      const wingKeysToRemove = building.wings.map((_, wi) => `${bi}-${wi}`)
      selectedWingKeys.value = selectedWingKeys.value.filter(k => !wingKeysToRemove.includes(k))
      const liftIdsToRemove = building.wings.flatMap(w => (w.lifts || []).map(l => l.id))
      selectedLiftIds.value = selectedLiftIds.value.filter(id => !liftIdsToRemove.includes(id))
    }
  } else {
    selectedBuildingIndexes.value.push(bi)
  }
  emitValue()
}

function toggleAllBuildings() {
  if (allBuildingsSelected.value) {
    selectedBuildingIndexes.value = []
    selectedWingKeys.value = []
    selectedLiftIds.value = []
  } else {
    selectedBuildingIndexes.value = (props.project?.buildings || []).map((_, i) => i)
  }
  emitValue()
}

// Available wings (from selected buildings)
const availableWings = computed(() => {
  if (!props.project?.buildings) return []
  const result = []
  selectedBuildingIndexes.value.forEach(bi => {
    const building = props.project.buildings[bi]
    if (!building) return
    ;(building.wings || []).forEach((wing, wi) => {
      result.push({ key: `${bi}-${wi}`, bi, wi, name: wing.name, bLabel: `B${bi + 1}` })
    })
  })
  return result
})

const allWingsSelected = computed(() => {
  const n = availableWings.value.length
  return n > 0 && selectedWingKeys.value.filter(k => availableWings.value.some(w => w.key === k)).length === n
})

function toggleWing(key) {
  const idx = selectedWingKeys.value.indexOf(key)
  if (idx >= 0) {
    selectedWingKeys.value.splice(idx, 1)
    // Remove lifts in this wing
    const [bi, wi] = key.split('-').map(Number)
    const wing = props.project?.buildings?.[bi]?.wings?.[wi]
    if (wing) {
      const liftIds = (wing.lifts || []).map(l => l.id)
      selectedLiftIds.value = selectedLiftIds.value.filter(id => !liftIds.includes(id))
    }
  } else {
    selectedWingKeys.value.push(key)
  }
  emitValue()
}

function toggleAllWings() {
  const keys = availableWings.value.map(w => w.key)
  if (allWingsSelected.value) {
    selectedWingKeys.value = selectedWingKeys.value.filter(k => !keys.includes(k))
    // Also remove lifts
    availableLifts.value.forEach(l => {
      selectedLiftIds.value = selectedLiftIds.value.filter(id => id !== l.id)
    })
  } else {
    keys.forEach(k => { if (!selectedWingKeys.value.includes(k)) selectedWingKeys.value.push(k) })
  }
  emitValue()
}

// Available lifts (from selected wings)
const availableLifts = computed(() => {
  if (!props.project?.buildings) return []
  const result = []
  selectedWingKeys.value.forEach(key => {
    const [bi, wi] = key.split('-').map(Number)
    const wing = props.project?.buildings?.[bi]?.wings?.[wi]
    if (!wing) return
    ;(wing.lifts || []).forEach(lift => result.push(lift))
  })
  return result
})

const allLiftsSelected = computed(() => {
  const n = availableLifts.value.length
  return n > 0 && availableLifts.value.every(l => selectedLiftIds.value.includes(l.id))
})

function toggleLift(id) {
  const idx = selectedLiftIds.value.indexOf(id)
  if (idx >= 0) selectedLiftIds.value.splice(idx, 1)
  else selectedLiftIds.value.push(id)
  emitValue()
}

function toggleAllLifts() {
  const ids = availableLifts.value.map(l => l.id)
  if (allLiftsSelected.value) {
    selectedLiftIds.value = selectedLiftIds.value.filter(id => !ids.includes(id))
  } else {
    ids.forEach(id => { if (!selectedLiftIds.value.includes(id)) selectedLiftIds.value.push(id) })
  }
  emitValue()
}
</script>

<style scoped>
.lift-selector { display: flex; flex-direction: column; gap: 10px; }

.multi-select-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.multi-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color:var(--ct-sub);
  transition: all 0.15s;
  user-select: none;
}
.multi-chip:hover { background: rgba(99,102,241,0.08); color:var(--ct-accent); border-color: rgba(99,102,241,0.2); }
.multi-chip.selected { background: rgba(99,102,241,0.18); color:var(--ct-accent); border-color: rgba(99,102,241,0.35); }

.chip-id {
  font-size: 10px;
  font-weight: 700;
  background: rgba(99,102,241,0.2);
  color: #818cf8;
  padding: 1px 5px;
  border-radius: 4px;
}
.multi-chip.selected .chip-id { background: rgba(99,102,241,0.35); }

.chip-meta { font-size: 10px; color:var(--ct-muted); }
.multi-chip.selected .chip-meta { color: #818cf8; }

/* Light theme */
[data-theme="light"] .multi-chip {
  border-color: rgba(0,0,0,0.1);
  background: rgba(0,0,0,0.04);
  color: #374151;
}
[data-theme="light"] .multi-chip:hover { background: rgba(99,102,241,0.08); color: #4f46e5; border-color: rgba(99,102,241,0.25); }
[data-theme="light"] .multi-chip.selected { background: rgba(99,102,241,0.12); color: #4f46e5; border-color: rgba(99,102,241,0.3); }
[data-theme="light"] .chip-id { background: rgba(99,102,241,0.15); color: #4f46e5; }
</style>
