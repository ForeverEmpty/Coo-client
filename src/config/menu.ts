import { MessageSquare, Users, Compass, Settings, LayoutGrid } from 'lucide-vue-next'
import type { FunctionalComponent } from 'vue'

export interface MenuItem {
  id: string
  label: string
  icon: FunctionalComponent
  path: string
  badge?: number
}

// 侧边栏主菜单配置
export const sidebarMenuItems: MenuItem[] = [
  { id: 'chat', label: '消息', icon: MessageSquare, path: '/chat' },
  { id: 'contact', label: '联系人', icon: Users, path: '/contacts' },
  { id: 'moments', label: '朋友圈', icon: Compass, path: '/social' },
  { id: 'apps', label: '应用', icon: LayoutGrid, path: '/apps' },
]

// 侧边栏底部固定菜单（如设置）
export const sidebarBottomItems: MenuItem[] = [
  { id: 'settings', label: '设置', icon: Settings, path: '/settings' },
]
