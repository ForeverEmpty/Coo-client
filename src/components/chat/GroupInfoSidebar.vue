<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import type { GroupMember } from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'

const props = defineProps<{
  notice?: string
  memberCount?: number
  members: GroupMember[]
}>()

const emit = defineEmits<{
  memberClick: [userId: string]
}>()

const groupNotice = computed(() => props.notice?.trim() || '暂无公告')
const countText = computed(() => {
  const count = props.memberCount
  if (typeof count === 'number' && count > 0) return `${count} 人`
  return `${props.members.length || 0} 人`
})

const getMemberName = (member: GroupMember) =>
  member.nicknameInGroup || member.displayName || member.nickname || member.username || member.userId

const getAvatarFallback = (name: string) => {
  if (!name) return '#'
  return name.trim().charAt(0).toUpperCase() || '#'
}

const handleMemberClick = (member: GroupMember) => {
  if (!member.userId) return
  emit('memberClick', member.userId)
}
</script>

<template>
  <aside class="flex h-full w-72 shrink-0 flex-col border-l bg-muted/10">
    <section class="space-y-2 border-b p-4">
      <h3 class="text-sm font-semibold text-foreground">群公告</h3>
      <div class="rounded-md border bg-background p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words">
        {{ groupNotice }}
      </div>
    </section>

    <section class="space-y-2 border-b p-4">
      <h3 class="text-sm font-semibold text-foreground">群人数</h3>
      <p class="text-xs text-muted-foreground">{{ countText }}</p>
    </section>

    <section class="min-h-0 flex-1 p-4">
      <h3 class="mb-2 text-sm font-semibold text-foreground">群成员</h3>
      <ScrollArea class="h-full">
        <div class="space-y-1 pr-2">
          <button
            v-for="member in members"
            :key="member.userId"
            type="button"
            class="group flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-primary/10 disabled:cursor-not-allowed"
            :disabled="!member.userId"
            @click="handleMemberClick(member)"
          >
            <Avatar class="h-8 w-8">
              <AvatarImage :src="member.avatar || ''" />
              <AvatarFallback>{{ getAvatarFallback(getMemberName(member)) }}</AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-foreground transition-colors group-hover:text-primary">
                {{ getMemberName(member) }}
              </p>
              <p class="truncate text-xs text-muted-foreground">ID: {{ member.userId }}</p>
            </div>
            <ChevronRight
              class="h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-disabled:opacity-0"
            />
          </button>
          <p
            v-if="members.length === 0"
            class="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground"
          >
            暂无成员
          </p>
        </div>
      </ScrollArea>
    </section>
  </aside>
</template>
