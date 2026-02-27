import type { Friend } from '@/api/types'
import type { QuickContextMenuEntry } from '@/components/ui/context-menu'
import { Compass, LayoutGrid, MessageSquare, Settings, Trash2, Users } from 'lucide-vue-next'
import type { FunctionalComponent } from 'vue'

export interface MenuItem {
  id: string
  label: string
  icon: FunctionalComponent
  path: string
  badge?: number
}

export const sidebarMenuItems: MenuItem[] = [
  { id: 'chat', label: '消息', icon: MessageSquare, path: '/chat' },
  { id: 'contact', label: '联系人', icon: Users, path: '/contacts' },
  { id: 'moments', label: '朋友圈', icon: Compass, path: '/social' },
  { id: 'apps', label: '应用', icon: LayoutGrid, path: '/apps' },
]

export const sidebarBottomItems: MenuItem[] = [
  { id: 'settings', label: '设置', icon: Settings, path: '/settings' },
]

export interface FriendContextMenuOptions {
  friend: Friend
  deletingFriendId?: string | null
  onDeleteFriend: (friend: Friend) => void
}

export const createFriendContextMenu = (
  options: FriendContextMenuOptions,
): QuickContextMenuEntry[] => [
  {
    key: `delete-${options.friend.id}`,
    label: '删除好友',
    icon: Trash2,
    destructive: true,
    disabled: options.deletingFriendId === options.friend.id,
    onSelect: () => {
      options.onDeleteFriend(options.friend)
    },
  },
]

