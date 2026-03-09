<script setup lang="ts">
import { computed } from 'vue'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chatStore'
import { useContactStore } from '@/stores/contactStore'

const props = withDefaults(
  defineProps<{
    searchKeyword?: string
  }>(),
  {
    searchKeyword: '',
  },
)

const chatStore = useChatStore()
const contactStore = useContactStore()

const filteredGroups = computed(() => {
  const keyword = props.searchKeyword.trim().toLowerCase()
  if (!keyword) return contactStore.groupChats

  return contactStore.groupChats.filter((group) => {
    return (
      String(group.name || '')
        .toLowerCase()
        .includes(keyword) || String(group.id || '').toLowerCase().includes(keyword)
    )
  })
})
</script>

<template>
  <div class="space-y-1 p-1">
    <div
      v-for="group in filteredGroups"
      :key="group.id"
      @click="
        chatStore.setActiveChat({
          id: group.id,
          title: group.name,
          avatar: group.avatar || '',
          type: 2,
          subTitle: group.subTitle || '群聊',
        })
      "
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
