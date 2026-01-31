import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      redirect: '/chat',
      children: [
        {
          path: 'profile/:id',
          name: 'Profile',
          meta: { layout: 'full' },
          component: () => import('@/views/profile/ProfileView.vue'),
        },
        {
          path: 'chat',
          name: 'Chat',
          meta: { layout: 'im' },
          component: () => import('@/views/chat/ChatView.vue'),
        },
        {
          path: 'contacts',
          name: 'Contacts',
          meta: { layout: 'im' },
          component: () => import('@/views/contacts/ContactsView.vue'),
        },
        {
          path: 'settings',
          name: 'Settings',
          meta: { layout: 'full' },
          component: () => import('@/views/settings/SettingsView.vue'),
        },
      ],
    },
    {
      path: '/contacts/add',
      name: 'AddContact',
      component: () => import('@/views/contacts/SearchAddView.vue'),
    },
    {
      path: '/auth',
      component: () => import('@/layouts/AuthLayout.vue'),
      children: [
        {
          path: 'login',
          name: 'Login',
          component: () => import('@/views/auth/LoginView.vue'),
        },
        {
          path: 'register',
          name: 'Register',
          component: () => import('@/views/auth/RegisterView.vue'),
        },
      ],
    },
  ],
})

export default router
