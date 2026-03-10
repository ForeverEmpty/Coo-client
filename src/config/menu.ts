import type { Friend } from '@/api/types'
import type { QuickContextMenuEntry } from '@/components/ui/context-menu'
import {
  ArrowRightLeft,
  Check,
  CheckCheck,
  Copy,
  Compass,
  Download,
  Eye,
  ExternalLink,
  Info,
  LayoutGrid,
  LogOut,
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
  { id: 'moments', label: '动态', icon: Compass, path: '/social' },
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

export interface GroupContextMenuOptions {
  groupId: string
  isOwner: boolean
  onOpenDetail: (groupId: string) => void
  onSetRemark: (groupId: string) => void
  onLeave: (groupId: string) => void
  onTransferOwner: (groupId: string) => void
  onDisband: (groupId: string) => void
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
      shortcut: current ? '当前' : undefined,
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
      label: '移动分组',
      items:
        groupMenus.length > 0
          ? groupMenus
          : [
              {
                key: `move-group-empty-${options.friend.id}`,
                label: '暂无可用分组',
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

export const createGroupContextMenu = (
  options: GroupContextMenuOptions,
): QuickContextMenuEntry[] => {
  if (options.isOwner) {
    return [
      {
        key: `group-detail-${options.groupId}`,
        label: '群资料',
        icon: Info,
        onSelect: () => options.onOpenDetail(options.groupId),
      },
      {
        key: `group-remark-${options.groupId}`,
        label: '备注',
        icon: PencilLine,
        onSelect: () => options.onSetRemark(options.groupId),
      },
      {
        key: `group-transfer-${options.groupId}`,
        label: '转让群主',
        icon: ArrowRightLeft,
        onSelect: () => options.onTransferOwner(options.groupId),
      },
      { type: 'separator', key: `group-owner-sep-${options.groupId}` },
      {
        key: `group-disband-${options.groupId}`,
        label: '解散群',
        icon: Trash2,
        destructive: true,
        onSelect: () => options.onDisband(options.groupId),
      },
    ]
  }

  return [
    {
      key: `group-detail-${options.groupId}`,
      label: '群资料',
      icon: Info,
      onSelect: () => options.onOpenDetail(options.groupId),
    },
    {
      key: `group-remark-${options.groupId}`,
      label: '备注',
      icon: PencilLine,
      onSelect: () => options.onSetRemark(options.groupId),
    },
    { type: 'separator', key: `group-member-sep-${options.groupId}` },
    {
      key: `group-leave-${options.groupId}`,
      label: '退群',
      icon: LogOut,
      destructive: true,
      onSelect: () => options.onLeave(options.groupId),
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

export interface MessageContextMenuOptions {
  keyPrefix: string
  canRecall: boolean
  canCopy: boolean
  canForward: boolean
  canSelect: boolean
  onCopy: () => void
  onDelete: () => void
  onRecall: () => void
  onQuote: () => void
  onForward: () => void
  onSelect: () => void
}

export const createMessageContextMenu = (
  options: MessageContextMenuOptions,
): QuickContextMenuEntry[] => [
  {
    key: `${options.keyPrefix}-copy`,
    label: '复制',
    disabled: !options.canCopy,
    onSelect: options.onCopy,
  },
  {
    key: `${options.keyPrefix}-delete`,
    label: '删除',
    destructive: true,
    onSelect: options.onDelete,
  },
  {
    key: `${options.keyPrefix}-recall`,
    label: '撤回',
    disabled: !options.canRecall,
    onSelect: options.onRecall,
  },
  {
    key: `${options.keyPrefix}-quote`,
    label: '引用',
    onSelect: options.onQuote,
  },
  {
    key: `${options.keyPrefix}-forward`,
    label: '转发',
    disabled: !options.canForward,
    onSelect: options.onForward,
  },
  {
    key: `${options.keyPrefix}-select`,
    label: '选中',
    disabled: !options.canSelect,
    onSelect: options.onSelect,
  },
]

export interface GroupSharedContextMenuOptions {
  keyPrefix: string
  canOpen: boolean
  canDownload: boolean
  canCopyLink: boolean
  onPreview?: () => void
  onOpen: () => void
  onDownload: () => void
  onCopyLink: () => void
}

export const createGroupSharedContextMenu = (
  options: GroupSharedContextMenuOptions,
): QuickContextMenuEntry[] => [
  {
    key: `${options.keyPrefix}-preview`,
    label: '预览',
    icon: Eye,
    hidden: !options.onPreview,
    onSelect: () => options.onPreview?.(),
  },
  {
    key: `${options.keyPrefix}-open`,
    label: '打开',
    icon: ExternalLink,
    disabled: !options.canOpen,
    onSelect: options.onOpen,
  },
  {
    key: `${options.keyPrefix}-download`,
    label: '下载',
    icon: Download,
    disabled: !options.canDownload,
    onSelect: options.onDownload,
  },
  { type: 'separator', key: `${options.keyPrefix}-sep` },
  {
    key: `${options.keyPrefix}-copy-link`,
    label: '复制链接',
    icon: Copy,
    disabled: !options.canCopyLink,
    onSelect: options.onCopyLink,
  },
]
