import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/create-admin-user',
    name: 'CreateAdmin',
    component: () => import('@/views/admin/CreateAdminView.vue'),
    meta: { public: true },
  },
  {
    path: '/delete-all',
    name: 'DeleteAll',
    component: () => import('@/views/admin/DeleteAllView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/components/layout/AppShell.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: () => localStorage.getItem('me_pinned_tab') || '/dashboard' },
      { path: 'dashboard',       name: 'Dashboard',       component: () => import('@/views/dashboard/DashboardView.vue'),           meta: { tab: 'dashboard' } },
      { path: 'reminders',       name: 'Reminders',       component: () => import('@/views/reminders/RemindersView.vue'),           meta: { tab: 'reminders' } },
      { path: 'maintenance',     name: 'Maintenance',     component: () => import('@/views/maintenance/MaintenanceView.vue'),       meta: { tab: 'maintenance' } },
      { path: 'amc',             name: 'AMC',             component: () => import('@/views/amc/AMCView.vue'),                       meta: { tab: 'amc' } },
      { path: 'billing',         name: 'Billing',         component: () => import('@/views/billing/BillingView.vue'),               meta: { tab: 'billing' } },
      { path: 'projects',        name: 'Projects',        component: () => import('@/views/projects/ProjectsView.vue'),             meta: { tab: 'projects' } },
      { path: 'hr',              name: 'HR',              component: () => import('@/views/hr/HRView.vue'),                         meta: { tab: 'hr' } },
      { path: 'configurations',  name: 'Configurations',  component: () => import('@/views/configurations/ConfigurationsView.vue'), meta: { tab: 'configurations' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  try {
    if (!auth.isLoggedIn) auth.loadSession()
  } catch { /* ignore corrupted session */ }

  if (to.meta.public) return next()
  if (!auth.isLoggedIn) return next('/login')

  if (to.meta.tab && !auth.canAccess(to.meta.tab)) {
    return next('/dashboard')
  }

  next()
})

export default router
