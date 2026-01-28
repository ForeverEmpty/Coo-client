<script setup lang="ts">
import type { FriendGroup } from '@/api/types'

import { onMounted, ref } from 'vue'

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chatStore'
import { socialApi } from '@/api/social'

const chatStore = useChatStore()

const friendGroups = ref<FriendGroup[]>([])

onMounted(async () => {
  try {
    const res = await socialApi.getFriendList()
    friendGroups.value = res.data || []
  } catch {}
})
</script>

<template>
  <Accordion type="multiple" class="w-full" :default-value="['g1', 'g2']">
    <AccordionItem
      v-for="g in friendGroups"
      :key="g.groupId"
      :value="g.groupId"
      class="border-none"
    >
      <AccordionTrigger
        class="px-3 py-2 hover:no-underline hover:bg-muted/30 text-xs text-muted-foreground font-bold"
      >
        {{ g.groupName }}
        <span class="ml-auto text-[10px] opacity-70">{{ g.children.length }}</span>
      </AccordionTrigger>
      <AccordionContent class="pb-0">
        <div
          v-for="friend in g.children"
          :key="friend.id"
          @click="chatStore.setActiveChat(friend.id)"
          :class="
            cn(
              'px-3 py-2 flex items-center gap-3 cursor-pointer rounded-lg transition-colors ml-1',
              chatStore.activeChatId === friend.id
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-muted/50',
            )
          "
        >
          <Avatar class="h-9 w-9">
            <AvatarImage :src="friend.avatar || ''" />
            <AvatarFallback>{{ friend.showName[0] }}</AvatarFallback>
          </Avatar>
          <span class="text-sm font-medium">{{ friend.showName || '' }}</span>
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
