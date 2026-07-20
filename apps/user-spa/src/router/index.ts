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
    path: '/register',
    name: 'register',
    component: () => import('@/views/Register.vue'),
    meta: { public: true, title: '注册' },
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
        meta: { title: '我的概览' },
      },
      {
        path: 'rules',
        name: 'my-rules',
        component: () => import('@/views/rule/MyRules.vue'),
        meta: { title: '我的规则' },
      },
      {
        path: 'rules/submit',
        name: 'rule-submit',
        component: () => import('@/views/rule/Submit.vue'),
        meta: { title: '提交规则' },
      },
      {
        path: 'licenses',
        name: 'my-licenses',
        component: () => import('@/views/license/MyLicenses.vue'),
        meta: { title: '我的 License' },
      },
      {
        path: 'subscriptions',
        name: 'my-subscriptions',
        component: () => import('@/views/subscription/MySubscriptions.vue'),
        meta: { title: '我的订阅' },
      },
      {
        path: 'transactions',
        name: 'transactions',
        component: () => import('@/views/billing/Transactions.vue'),
        meta: { title: '交易记录' },
      },
      {
        path: 'receipts/request',
        name: 'receipt-request',
        component: () => import('@/views/billing/ReceiptRequest.vue'),
        meta: { title: '申请收据' },
      },
      {
        path: 'renew',
        name: 'renew',
        component: () => import('@/views/billing/Renew.vue'),
        meta: { title: '续费' },
      },
      {
        path: 'refunds/request',
        name: 'refund-request',
        component: () => import('@/views/billing/RefundRequest.vue'),
        meta: { title: '申请退款' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/Settings.vue'),
        meta: { title: '账号设置' },
      },
      {
        path: 'dmca',
        name: 'dmca-submit',
        component: () => import('@/views/dmca/Submit.vue'),
        meta: { title: 'DMCA 举报' },
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
  document.title = `${(to.meta.title as string) || ''} | SeekAll 用户中心`
  const auth = useAuthStore()
  if (to.meta.public) {
    if (auth.isLoggedIn && (to.name === 'login' || to.name === 'register')) {
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
  next()
})

export default router
