<script setup lang="ts">
import { computed, ref } from 'vue'
import { Pin, Search } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { QuickContextMenu } from '@/components/ui/context-menu'
import { createRecentChatContextMenu } from '@/config/menu'
import { cn } from '@/lib/utils'
import { useChatStore, type RecentChatItem } from '@/stores/chatStore'

const chatStore = useChatStore()
const keyword = ref('')

const filteredChats = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) {
    return chatStore.recentChats
  }

  return chatStore.recentChats.filter((item) => {
    return item.title.toLowerCase().includes(q) || item.lastMessageText.toLowerCase().includes(q)
  })
})

const formatLastTime = (timestamp: number) => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (sameDay) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const previewText = (text: string) => text.replace(/\s+/g, ' ').trim()

const openChat = (item: RecentChatItem) => {
  chatStore.setActiveChat({
    id: item.chatId,
    title: item.title,
    avatar: item.avatar || '',
    type: item.type,
    subTitle: item.subTitle,
  })
}

const deleteRecent = (chatId: string) => {
  if (chatStore.activeChatId === chatId) {
    chatStore.setActiveChat(null)
  }
  chatStore.removeFromRecent(chatId)
}

const getRecentMenu = (item: RecentChatItem) =>
  createRecentChatContextMenu({
    chatId: item.chatId,
    pinned: item.pinned,
    unreadCount: item.unreadCount,
    onPin: chatStore.pinChat,
    onUnpin: chatStore.unpinChat,
    onDelete: deleteRecent,
    onMarkRead: chatStore.clearUnread,
  })
</script>

<template>
  <section class="flex h-full flex-col overflow-hidden bg-card/10">
    <div class="shrink-0 p-4">
      <h2 class="mb-4 text-xl font-bold">消息</h2>
      <div class="relative">
        <Search class="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input v-model="keyword" placeholder="搜索会话..." class="h-10 border-none bg-muted/30 pl-9" />
      </div>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div v-if="filteredChats.length > 0" class="flex flex-col">
        <QuickContextMenu
          v-for="chat in filteredChats"
          :key="chat.chatId"
          :menu="getRecentMenu(chat)"
          trigger="contextmenu"
          trigger-class="w-full"
        >
          <div
            class="group flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
            :class="
              cn(
                chatStore.activeChatId === chat.chatId
                  ? 'bg-primary/10 hover:bg-primary/10'
                  : undefined,
              )
            "
            @click="openChat(chat)"
          >
            <Avatar class="h-12 w-12 rounded-xl">
              <AvatarImage :src="chat.avatar || ''" />
              <AvatarFallback>{{ chat.title?.[0] || 'U' }}</AvatarFallback>
            </Avatar>

            <div class="min-w-0 flex-1">
              <div class="mb-1 flex items-center gap-1.5">
                <span class="truncate text-sm font-medium">{{ chat.title }}</span>
                <Pin v-if="chat.pinned" class="h-3.5 w-3.5 shrink-0 text-amber-500" />
              </div>
              <p class="truncate text-xs text-muted-foreground">
                {{ previewText(chat.lastMessageText) }}
              </p>
            </div>

            <div class="mt-0.5 flex min-w-10 shrink-0 flex-col items-end gap-1">
              <span class="text-[10px] text-muted-foreground">
                {{ formatLastTime(chat.lastMessageTime) }}
              </span>
              <div
                v-if="chat.unreadCount"
                class="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-white"
              >
                {{ chat.unreadCount > 99 ? '99+' : chat.unreadCount }}
              </div>
            </div>
          </div>
        </QuickContextMenu>
      </div>

      <div v-else class="flex h-full flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
        <p class="text-sm">暂无最近消息</p>
        <p class="text-xs opacity-70">开始聊天后会在这里显示最近会话</p>
      </div>
    </ScrollArea>
  </section>
</template>
