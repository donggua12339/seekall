import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '数据概览' },
      },
      {
        path: 'dmca',
        name: 'dmca-list',
        component: () => import('@/views/dmca/List.vue'),
        meta: { title: 'DMCA 举报' },
      },
      {
        path: 'dmca/:id',
        name: 'dmca-detail',
        component: () => import('@/views/dmca/Detail.vue'),
        meta: { title: 'DMCA 举报详情' },
      },
      {
        path: 'rules',
        name: 'rule-list',
        component: () => import('@/views/rule/List.vue'),
        meta: { title: '规则评审' },
      },
      {
        path: 'licenses',
        name: 'license-list',
        component: () => import('@/views/license/List.vue'),
        meta: { title: 'License 管理' },
      },
      {
        path: 'users',
        name: 'user-list',
        component: () => import('@/views/user/List.vue'),
        meta: { title: '用户管理' },
      },
      {
        path: 'audit-logs',
        name: 'audit-logs',
        component: () => import('@/views/AuditLogs.vue'),
        meta: { title: '审计日志' },
      },
      {
        path: 'analytics',
        name: 'analytics',
        component: () => import('@/views/Analytics.vue'),
        meta: { title: '数据分析' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    component: () => import('@/views/NotFound.vue'),
    meta: { public: true, title: '404' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  document.title = `${(to.meta.title as string) || ''} | SeekAll Admin`
  const auth = useAuthStore()
  if (to.meta.public) {
    if (auth.isLoggedIn && to.name === 'login') {
      next('/dashboard')
    } else {
      next()
    }
    return
  }
  if (!auth.isLoggedIn) {
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }
  if (!auth.isSuperAdmin && to.name !== 'dashboard') {
    next('/dashboard')
    return
  }
  next()
})

export default router
