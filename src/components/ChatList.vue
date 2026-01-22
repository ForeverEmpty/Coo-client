<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// 模拟数据
const chats = Array.from({ length: 15 }).map((_, i) => ({
  id: i,
  name: `好友 ${i + 1}`,
  lastMsg: '最近的一条聊天内容显示在这里...',
  time: '14:20',
  unread: Math.floor(Math.random() * 200),
}))
</script>

<template>
  <section class="w-80 border-r flex flex-col bg-card/10 h-full overflow-hidden">
    <!-- 搜索栏 -->
    <div class="p-4 shrink-0">
      <h2 class="text-xl font-bold mb-4">消息</h2>
      <div class="relative">
        <Search class="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="搜索..." class="pl-9 bg-muted/30 border-none h-10" />
      </div>
    </div>

    <!-- 列表区 -->
    <ScrollArea class="flex-1 min-h-0">
      <div class="flex flex-col">
        <div
          v-for="chat in chats"
          :key="chat.id"
          class="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors group"
        >
          <Avatar class="h-12 w-12 rounded-xl">
            <AvatarImage :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.name}`" />
            <AvatarFallback>User</AvatarFallback>
          </Avatar>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-center mb-1">
              <span class="font-medium truncate text-sm">{{ chat.name }}</span>
              <span class="text-[10px] text-muted-foreground">{{ chat.time }}</span>
            </div>
            <p class="text-xs text-muted-foreground truncate">{{ chat.lastMsg }}</p>
          </div>
          <!-- 未读红点 -->
          <div
            v-if="chat.unread"
            class="h-5 min-w-5 px-1 bg-primary text-[10px] flex items-center justify-center rounded-full text-white"
          >
            {{ chat.unread > 99 ? '99+' : chat.unread }}
          </div>
        </div>
      </div>
    </ScrollArea>
  </section>
</template>
