<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': !ui.sidebarOpen }">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main content area -->
    <div class="main-area">
      <AppHeader />
      <main class="content-area">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" :key="$route.path" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- Toast notifications -->
    <ToastContainer />

    <!-- Mobile sidebar overlay — also swallows pull-to-refresh touches -->
    <div
      v-if="ui.sidebarOpen && isMobile"
      class="sidebar-overlay"
      @click="ui.closeSidebar()"
      @touchmove.prevent
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import ToastContainer from '../ui/ToastContainer.vue'

const ui = useUIStore()
const auth = useAuthStore()
const router = useRouter()
const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 1024)

function onResize() {
  windowWidth.value = window.innerWidth
  if (windowWidth.value < 1024) ui.closeSidebar()
}

function onVisibilityChange() {
  if (!document.hidden) {
    auth.loadSession()
    if (!auth.isLoggedIn) router.push('/login')
  }
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  scroll-behavior: smooth;
  /* Prevent Android bottom nav from covering content */
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

@media (max-width: 1023px) {
  .content-area {
    /* Extra clearance for Android gesture/nav bar on mobile */
    padding-bottom: max(env(safe-area-inset-bottom, 0px), 16px);
  }
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 40;
}

/* On mobile the sidebar is position:fixed (out of flex flow),
   so main-area naturally fills full width — no extra styles needed */
</style>
