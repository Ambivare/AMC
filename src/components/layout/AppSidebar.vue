<template>
  <aside ref="sidebarRef" class="sidebar" :class="{ open: ui.sidebarOpen }">
    <!-- Logo -->
    <div class="sidebar-logo">
      <div class="logo-icon">
        <img
          :src="company.logoUrl || '/favicon.png'"
          style="width:28px;height:28px;object-fit:contain;border-radius:5px;"
          onerror="this.style.display='none'"
        />
      </div>
      <div class="logo-text" v-show="ui.sidebarOpen">
        <span class="logo-name">{{ company.name || 'TAB Elevators' }}</span>
        <span class="logo-tag">AMC Manager</span>
      </div>
    </div>

    <hr class="divider" />

    <!-- User card -->
    <div class="user-card" v-show="ui.sidebarOpen">
      <div class="user-avatar">{{ initials }}</div>
      <div class="user-info">
        <div class="user-name">{{ auth.user?.fullName || auth.user?.username }}</div>
        <div class="user-role">{{ roleLabel }}</div>
      </div>
    </div>

    <hr class="divider" />

    <!-- Nav scroll-up indicator -->
    <button v-show="canScrollUp" class="nav-scroll-btn nav-scroll-up" @click="scrollNav(-1)" tabindex="-1">
      <ChevronUp :size="13" />
    </button>

    <!-- Nav -->
    <nav ref="navRef" class="sidebar-nav" @scroll="onNavScroll">
      <template v-for="group in navGroups" :key="group.label">
        <div class="nav-group-label" v-show="ui.sidebarOpen">{{ group.label }}</div>
        <template v-for="item in group.items" :key="item.to">
          <div v-if="canShowItem(item)" class="nav-item-row">
            <router-link
              :to="item.to"
              class="nav-item"
              :class="{ active: isActive(item.to) }"
            >
              <component :is="item.icon" :size="17" class="nav-icon" />
              <span class="nav-label" v-show="ui.sidebarOpen">{{ item.label }}</span>
              <span v-if="item.badge && ui.sidebarOpen" class="nav-badge">{{ item.badge }}</span>
              <Pin v-if="pinnedTab === item.to && ui.sidebarOpen" :size="9" class="pin-dot" />
            </router-link>

            <!-- 3-dot menu (only when sidebar is open) -->
            <div v-show="ui.sidebarOpen" style="position:relative;flex-shrink:0;">
              <button class="item-dots-btn" @click.stop="activeMenu = activeMenu === item.to ? null : item.to" :title="'Options for ' + item.label">
                <MoreVertical :size="12" />
              </button>
              <div v-if="activeMenu === item.to" class="item-dots-menu" @click.stop>
                <button @click="togglePin(item.to)">
                  <Pin :size="11" style="margin-right:6px;" />
                  {{ pinnedTab === item.to ? 'Unpin Tab' : 'Pin Tab' }}
                </button>
                <div v-if="pinnedTab === item.to" style="font-size:10px;color:var(--ct-muted);padding:4px 10px 6px;">
                  Opens on startup
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </nav>

    <!-- Nav scroll-down indicator -->
    <button v-show="canScrollDown" class="nav-scroll-btn nav-scroll-down" @click="scrollNav(1)" tabindex="-1">
      <ChevronDown :size="13" />
    </button>

    <!-- Bottom toggle -->
    <div class="sidebar-footer">
      <button class="toggle-btn" @click="ui.toggleSidebar()" :title="ui.sidebarOpen ? 'Collapse' : 'Expand'">
        <ChevronLeft v-if="ui.sidebarOpen" :size="16" />
        <ChevronRight v-else :size="16" />
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { ROLES } from '@/stores/auth'
import { useCompanyConfig } from '@/composables/useCompanyConfig'
import {
  LayoutDashboard, FolderOpen,
  Receipt, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Shield, ClipboardList, MoreVertical, Pin, Settings, Bell,
} from 'lucide-vue-next'

const ui = useUIStore()
const auth = useAuthStore()
const route = useRoute()
const { company, load: loadCompany } = useCompanyConfig()

function canShowItem(item) {
  return auth.canAccess(item.tab)
}

const initials = computed(() => {
  const n = auth.user?.fullName || auth.user?.username || '?'
  return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})

const roleLabel = computed(() => ROLES[auth.user?.role]?.label || auth.user?.role || 'User')

function isActive(to) { return route.path === to || route.path.startsWith(to + '/') }

// ── Pin functionality ─────────────────────────────────────────────────────────
const pinnedTab = ref(localStorage.getItem('me_pinned_tab') || null)
const activeMenu = ref(null)

function togglePin(path) {
  if (pinnedTab.value === path) {
    pinnedTab.value = null
    localStorage.removeItem('me_pinned_tab')
    ui.success('Tab unpinned')
  } else {
    pinnedTab.value = path
    localStorage.setItem('me_pinned_tab', path)
    ui.success('Tab pinned — will open on startup')
  }
  activeMenu.value = null
}

// ── Nav scroll indicators ─────────────────────────────────────────────────────
const sidebarRef = ref(null)
const navRef      = ref(null)
const canScrollUp   = ref(false)
const canScrollDown = ref(false)

function updateScrollState() {
  const el = navRef.value
  if (!el) return
  canScrollUp.value   = el.scrollTop > 8
  canScrollDown.value = el.scrollTop + el.clientHeight < el.scrollHeight - 8
}

function onNavScroll() { updateScrollState() }

function scrollNav(dir) {
  const el = navRef.value
  if (!el) return
  if (dir < 0) {
    // Going up — jump to absolute top if almost there
    el.scrollTo({ top: el.scrollTop < 160 ? 0 : el.scrollTop - 140, behavior: 'smooth' })
  } else {
    // Going down — jump to absolute bottom if almost there
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
    el.scrollTo({ top: remaining < 160 ? el.scrollHeight : el.scrollTop + 140, behavior: 'smooth' })
  }
}

// Scroll active nav item into view when sidebar opens
watch(() => ui.sidebarOpen, (open) => {
  nextTick(() => {
    updateScrollState()
    if (open && navRef.value) {
      const active = navRef.value.querySelector('.nav-item.active')
      if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  })
})

// ── Pull-to-refresh prevention (JS — more reliable than CSS alone) ────────────
// CSS overscroll-behavior doesn't fire preventDefault, so Android Chrome can
// still trigger native refresh. We block it with a non-passive touchmove
// listener that fires when the sidebar is open and touch is pulling downward
// while the nav is at the top (or touch is outside the nav entirely).
let _ptTouchY = 0

function onSidebarTouchStart(e) {
  _ptTouchY = e.touches[0]?.clientY ?? 0
}

function onSidebarTouchMove(e) {
  const nav   = navRef.value
  const dy    = (e.touches[0]?.clientY ?? 0) - _ptTouchY
  const atTop = !nav || nav.scrollTop <= 0

  // Block pull-down when nav is scrolled to the top OR when touch is
  // happening outside the nav element (logo area, user card, footer)
  if (dy > 0 && atTop) {
    e.preventDefault()
  }
}

function handleOutsideClick() { activeMenu.value = null }

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
  loadCompany()
  nextTick(updateScrollState)

  const el = sidebarRef.value
  if (el) {
    el.addEventListener('touchstart', onSidebarTouchStart, { passive: true })
    el.addEventListener('touchmove',  onSidebarTouchMove,  { passive: false })
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
  const el = sidebarRef.value
  if (el) {
    el.removeEventListener('touchstart', onSidebarTouchStart)
    el.removeEventListener('touchmove',  onSidebarTouchMove)
  }
})

const navGroups = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard',  tab: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
      { to: '/reminders',  tab: 'reminders',  label: 'Reminders',  icon: Bell },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/projects',      tab: 'projects',      label: 'Projects',      icon: FolderOpen },
      { to: '/maintenance',   tab: 'maintenance',   label: 'Maintenance',   icon: ClipboardList },
    ],
  },
  {
    label: 'Contracts',
    items: [
      { to: '/amc',      tab: 'amc',      label: 'AMC',      icon: Shield },
      { to: '/billing',  tab: 'billing',  label: 'Billing',  icon: Receipt },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/configurations', tab: 'configurations', label: 'Configurations', icon: Settings },
    ],
  },
]
</script>

<style scoped>
/* ── Ripple animation on nav tap ─────────────────────────────────────── */
.nav-item { overflow: hidden; }
.nav-item::after {
  content: '';
  position: absolute; inset: 0; border-radius: 10px;
  background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%);
  opacity: 0; transform: scale(0);
  transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease;
  pointer-events: none;
}
.nav-item:active::after { opacity: 1; transform: scale(2.4); transition: transform 0s, opacity 0s; }

/* ── Base sidebar — BLACK in all modes ───────────────────────────────── */
.sidebar {
  width: 64px; height: 100vh; height: 100dvh;
  display: flex; flex-direction: column; flex-shrink: 0;
  transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden; position: relative; z-index: 50;
  background: #000000;
  border-right: 1px solid rgba(255,255,255,0.06);
  overscroll-behavior: none; touch-action: pan-y;
}
.sidebar.open { width: 240px; }

@media (max-width: 1023px) {
  .sidebar {
    position: fixed; left: 0; top: 0; bottom: 0;
    height: 100vh; height: 100dvh;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    width: 260px !important;
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.28s ease;
    box-shadow: none; border-right-color: rgba(255,255,255,0.08);
    overscroll-behavior: none; -webkit-overflow-scrolling: touch;
  }
  .sidebar.open { transform: translateX(0); box-shadow: 8px 0 40px rgba(0,0,0,0.7); }
  .nav-scroll-btn { display: flex; }
}

/* ── Logo / company section — NAVY BLUE ─────────────────────────────── */
.sidebar-logo {
  display: flex; align-items: center; gap: 10px;
  padding: 18px 14px; flex-shrink: 0;
  background: #000000;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.logo-icon {
  width: 36px; height: 36px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.logo-text { overflow: hidden; white-space: nowrap; }
.logo-name { display: block; font-size: 14px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px; }
.logo-tag  { display: block; font-size: 10px; color: #93c5fd; font-weight: 600; letter-spacing: 0.06em; }

/* ── User card — WHITE background, black text ────────────────────────── */
.user-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; overflow: hidden; white-space: nowrap;
  background: #000000;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.user-avatar {
  width: 32px; height: 32px; border-radius: 10px;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.25);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.user-name { font-size: 13px; font-weight: 600; color: #fff; }
.user-role { font-size: 11px; color: #93c5fd; margin-top: 1px; }

/* ── Divider ─────────────────────────────────────────────────────────── */
.divider { border: none; border-top: 1px solid rgba(255,255,255,0.05); margin: 0; flex-shrink: 0; }

/* ── Nav ─────────────────────────────────────────────────────────────── */
.sidebar-nav {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  padding: 8px 8px; overscroll-behavior-y: contain; touch-action: pan-y;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
}
.sidebar-nav::-webkit-scrollbar { width: 3px; }
.sidebar-nav::-webkit-scrollbar-track { background: transparent; }
.sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }

/* Scroll indicators */
.nav-scroll-btn {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 26px; flex-shrink: 0;
  border: none; cursor: pointer; color: rgba(255,255,255,0.35);
  transition: color 0.15s; z-index: 2;
}
.nav-scroll-up   { background: linear-gradient(to bottom, #000000 30%, transparent); }
.nav-scroll-down { background: linear-gradient(to top,   #000000 30%, transparent); }
.nav-scroll-btn:hover { color: rgba(255,255,255,0.8); }

/* ── Group labels ────────────────────────────────────────────────────── */
.nav-group-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.09em;
  color: rgba(255,255,255,0.3);
  background: transparent;
  border-radius: 6px;
  padding: 4px 8px;
  margin: 10px 0 4px;
  white-space: nowrap; overflow: hidden;
  display: block;
}

/* ── Nav item row ────────────────────────────────────────────────────── */
.nav-item-row {
  display: flex; align-items: center; gap: 2px;
  margin-bottom: 1px; position: relative;
}
.nav-item-row .nav-item { flex: 1; margin-bottom: 0; }

.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 10px;
  color: rgba(255,255,255,0.55);
  text-decoration: none;
  transition: background 0.18s ease, color 0.18s ease, transform 0.1s ease;
  white-space: nowrap; position: relative; min-width: 0;
  -webkit-tap-highlight-color: transparent;
}
.nav-item:hover {
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.9);
  transform: translateX(2px);
}
/* Active tab — WHITE background, dark text */
.nav-item.active {
  background: #ffffff;
  color: #0f172a;
  border: none;
}
.nav-item.active .nav-icon { color: #dc2626; }
.nav-item:active { transform: scale(0.96); transition-duration: 0.07s; }
.nav-icon { flex-shrink: 0; transition: color 0.15s; }
.nav-label { font-size: 13px; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; }
.nav-badge {
  margin-left: auto;
  background: rgba(239,68,68,0.2); color: #f87171;
  border: 1px solid rgba(239,68,68,0.25);
  font-size: 10px; padding: 1px 6px; border-radius: 99px; font-weight: 600;
}
.pin-dot { color: #f59e0b; flex-shrink: 0; margin-left: auto; }

/* 3-dot button */
.item-dots-btn {
  opacity: 0; width: 24px; height: 24px; border-radius: 7px;
  border: none; background: transparent; color: rgba(255,255,255,0.35);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: opacity 0.15s, background 0.15s;
}
.nav-item-row:hover .item-dots-btn { opacity: 1; }
.item-dots-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }

/* Context dropdown */
.item-dots-menu {
  position: absolute; right: 0; top: calc(100% + 4px);
  background: #1e2030; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; padding: 6px; min-width: 170px;
  z-index: 300; box-shadow: 0 8px 24px rgba(0,0,0,0.6);
}
.item-dots-menu button {
  display: flex; align-items: center; width: 100%;
  padding: 8px 10px; border-radius: 6px; border: none;
  background: transparent; color: #94a3b8;
  font-size: 12px; cursor: pointer; text-align: left;
}
.item-dots-menu button:hover { background: rgba(255,255,255,0.07); color: #fff; }

/* Footer */
.sidebar-footer {
  padding: 12px 8px;
  border-top: 1px solid rgba(255,255,255,0.05);
  flex-shrink: 0;
  background: #000000;
}
.toggle-btn {
  width: 100%; display: flex; align-items: center; justify-content: center;
  padding: 8px; border-radius: 10px; color: rgba(255,255,255,0.35);
  background: transparent; border: 1px solid rgba(255,255,255,0.07);
  cursor: pointer; transition: all 0.18s;
}
.toggle-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.15); }

/* ── Light theme: sidebar stays BLACK — only content area goes off-white */
[data-theme="light"] .sidebar { background: #000000; border-right-color: rgba(255,255,255,0.06); }
[data-theme="light"] .sidebar-logo { background: #000000; border-bottom-color: rgba(255,255,255,0.08); }
[data-theme="light"] .logo-icon { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); }
[data-theme="light"] .logo-name { color: #fff; }
[data-theme="light"] .logo-tag { color: #93c5fd; }
[data-theme="light"] .user-card { background: #000000; border-bottom-color: rgba(255,255,255,0.08); }
[data-theme="light"] .user-avatar { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.25); color: #fff; }
[data-theme="light"] .user-name { color: #fff; }
[data-theme="light"] .user-role { color: #93c5fd; }
[data-theme="light"] .divider { border-top-color: rgba(255,255,255,0.05); }
[data-theme="light"] .nav-group-label { background: transparent; color: rgba(255,255,255,0.3); }
[data-theme="light"] .nav-item { color: rgba(255,255,255,0.55); }
[data-theme="light"] .nav-item:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.9); }
[data-theme="light"] .nav-item.active { background: #fff; color: #0f172a; border: none; }
[data-theme="light"] .nav-item.active .nav-icon { color: #dc2626; }
[data-theme="light"] .nav-scroll-up   { background: linear-gradient(to bottom, #000000 30%, transparent); }
[data-theme="light"] .nav-scroll-down { background: linear-gradient(to top,   #000000 30%, transparent); }
[data-theme="light"] .nav-scroll-btn { color: rgba(255,255,255,0.35); }
[data-theme="light"] .nav-scroll-btn:hover { color: rgba(255,255,255,0.8); }
[data-theme="light"] .sidebar-footer { border-top-color: rgba(255,255,255,0.05); background: #000000; }
[data-theme="light"] .toggle-btn { color: rgba(255,255,255,0.35); border-color: rgba(255,255,255,0.07); }
[data-theme="light"] .toggle-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); }
[data-theme="light"] .item-dots-menu { background: #1e2030; border-color: rgba(255,255,255,0.1); }
[data-theme="light"] .item-dots-menu button { color: #94a3b8; }
[data-theme="light"] .item-dots-menu button:hover { background: rgba(255,255,255,0.07); color: #fff; }
[data-theme="light"] .sidebar-nav { scrollbar-color: rgba(255,255,255,0.1) transparent; }
</style>
