import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: import('@/views/IndexView.vue'),
    },
    {
      path: '/login',
      component: import('@/views/LoginView.vue'),
    },
  ],
})

export default router
