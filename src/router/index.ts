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
        {
          path: 'groups/:id',
          name: 'GroupDetail',
          meta: { layout: 'full' },
          component: () => import('@/views/groups/GroupDetailView.vue'),
        },
      ],
    },
    {
      path: '/contacts/add',
      name: 'AddContact',
      component: () => import('@/views/contacts/SearchAddView.vue'),
    },
    {
      path: '/contacts/apply',
      name: 'FriendApply',
      component: () => import('@/views/components/FriendApplyView.vue'),
    },
    {
      path: '/contacts/group-manage',
      name: 'GroupManage',
      component: () => import('@/views/contacts/components/GroupManager.vue'),
    },
    {
      path: '/contacts/accept-apply',
      name: 'AcceptApply',
      component: () => import('@/views/contacts/components/AcceptApplyDialog.vue'),
    },
    {
      path: '/contacts/profile-compact/:id',
      name: 'CompactProfile',
      component: () => import('@/views/contacts/CompactProfile.vue'),
    },
    {
      path: '/dialog',
      name: 'DialogHost',
      component: () => import('@/views/dialog/DialogHostView.vue'),
    },
    {
      path: '/profile/image-editor',
      name: 'ProfileImageEditor',
      component: () => import('@/views/profile/ProfileImageEditorView.vue'),
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
