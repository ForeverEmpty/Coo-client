import type { Friend } from '@/api/types'
import type { QuickContextMenuEntry } from '@/components/ui/context-menu'
import {
  Check,
  CheckCheck,
  Compass,
  LayoutGrid,
  MessageSquare,
  PencilLine,
  Pin,
  PinOff,
  Settings,
  Trash2,
  Users,
} from 'lucide-vue-next'
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

export interface FriendMenuGroup {
  groupId: string
  groupName: string
}

export interface FriendContextMenuOptions {
  friend: Friend
  deletingFriendId?: string | null
  groups: FriendMenuGroup[]
  onDeleteFriend: (friend: Friend) => void
  onSetRemark: (friend: Friend) => void
  onMoveGroup: (friend: Friend, groupId: string) => void
}

const isSameGroup = (left?: string, right?: string) => String(left ?? '0') === String(right ?? '0')

export const createFriendContextMenu = (
  options: FriendContextMenuOptions,
): QuickContextMenuEntry[] => {
  const groupMenus: QuickContextMenuEntry[] = options.groups.map((group) => {
    const current = isSameGroup(options.friend.groupId, group.groupId)
    return {
      key: `move-group-${options.friend.id}-${group.groupId}`,
      label: group.groupName,
      icon: current ? Check : undefined,
      shortcut: current ? '√' : undefined,
      disabled: current,
      onSelect: () => {
        options.onMoveGroup(options.friend, group.groupId)
      },
    }
  })

  return [
    {
      key: `set-remark-${options.friend.id}`,
      label: '设置备注',
      icon: PencilLine,
      onSelect: () => {
        options.onSetRemark(options.friend)
      },
    },
    {
      type: 'submenu',
      key: `move-group-${options.friend.id}`,
      label: '更换分组',
      items:
        groupMenus.length > 0
          ? groupMenus
          : [
              {
                key: `move-group-empty-${options.friend.id}`,
                label: '暂无分组',
                disabled: true,
              },
            ],
    },
    { type: 'separator', key: `friend-sep-${options.friend.id}` },
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
}

export interface RecentChatContextMenuOptions {
  chatId: string
  pinned: boolean
  unreadCount: number
  onPin: (chatId: string) => void
  onUnpin: (chatId: string) => void
  onDelete: (chatId: string) => void
  onMarkRead: (chatId: string) => void
}

export const createRecentChatContextMenu = (
  options: RecentChatContextMenuOptions,
): QuickContextMenuEntry[] => [
  {
    key: `mark-read-${options.chatId}`,
    label: '消息已读',
    icon: CheckCheck,
    hidden: options.unreadCount <= 0,
    onSelect: () => options.onMarkRead(options.chatId),
  },
  {
    type: 'separator',
    key: `read-sep-${options.chatId}`,
    hidden: options.unreadCount <= 0,
  },
  options.pinned
    ? {
        key: `unpin-${options.chatId}`,
        label: '取消置顶',
        icon: PinOff,
        onSelect: () => options.onUnpin(options.chatId),
      }
    : {
        key: `pin-${options.chatId}`,
        label: '置顶',
        icon: Pin,
        onSelect: () => options.onPin(options.chatId),
      },
  { type: 'separator', key: `pin-sep-${options.chatId}` },
  {
    key: `delete-chat-${options.chatId}`,
    label: '删除会话',
    icon: Trash2,
    destructive: true,
    onSelect: () => options.onDelete(options.chatId),
  },
]
