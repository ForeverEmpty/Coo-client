<script setup lang="ts">
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chatStore'

const chatStore = useChatStore()

const groups = [
  { id: 'group_1', name: 'Coo Chat 开发组', avatar: '' },
  { id: 'group_2', name: '周末约饭小分队', avatar: '' },
]
</script>

<template>
  <div class="space-y-1 p-1">
    <div
      v-for="group in groups"
      :key="group.id"
      @click="chatStore.setActiveChat(group.id)"
      :class="
        cn(
          'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
          chatStore.activeChatId === group.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50',
        )
      "
    >
      <Avatar class="h-10 w-10 rounded-lg">
        <AvatarFallback class="bg-indigo-100 text-indigo-600 rounded-lg">#</AvatarFallback>
      </Avatar>
      <span class="text-sm font-medium">{{ group.name }}</span>
    </div>
  </div>
</template>
