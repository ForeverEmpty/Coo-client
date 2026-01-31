<script setup lang="ts">
import { Megaphone, Users, Crown } from 'lucide-vue-next'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

// 定义 Props 接收数据
defineProps<{
  notice: string
  members: Array<{ id: string; name: string; avatar: string; role: string }>
}>()
</script>

<template>
  <aside class="w-64 border-l bg-muted/10 flex flex-col shrink-0">
    <!-- 上部分：群公告 -->
    <div class="p-4 border-b bg-background/50">
      <div class="flex items-center gap-2 mb-2 text-sm font-bold text-foreground">
        <Megaphone class="w-4 h-4 text-orange-500" /> 群公告
      </div>
      <div class="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg leading-relaxed">
        {{ notice }}
      </div>
    </div>

    <!-- 下部分：群成员 -->
    <div class="flex-1 flex flex-col min-h-0">
      <div class="p-4 pb-2 text-sm font-bold flex items-center justify-between">
        <span class="flex items-center gap-2"><Users class="w-4 h-4" /> 群成员</span>
        <span class="text-xs text-muted-foreground">{{ members.length }}人</span>
      </div>

      <ScrollArea class="flex-1 px-2 min-h-0">
        <div class="space-y-1 pb-2">
          <div
            v-for="member in members"
            :key="member.id"
            class="flex items-center gap-2 p-2 rounded-lg hover:bg-background cursor-pointer transition-colors group"
          >
            <Avatar class="h-8 w-8">
              <AvatarImage :src="member.avatar" />
              <AvatarFallback>{{ member.name[0] }}</AvatarFallback>
            </Avatar>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1">
                <span class="text-xs font-medium truncate">{{ member.name }}</span>
                <Crown v-if="member.role === 'owner'" class="w-3 h-3 text-yellow-500" />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  </aside>
</template>
