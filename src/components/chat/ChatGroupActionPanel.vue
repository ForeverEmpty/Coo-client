<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowRightLeft,
  BellOff,
  ChevronRight,
  Files,
  History,
  LogOut,
  Megaphone,
  StickyNote,
  Trash2,
  Users,
} from 'lucide-vue-next'
import type { GroupInfo, GroupMember } from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useUserStore } from '@/stores/userStore'

const props = defineProps<{
  title: string
  loading?: boolean
  pinned?: boolean
  muted?: boolean
  groupInfo?: GroupInfo | null
  groupMembers?: GroupMember[]
}>()

const userStore = useUserStore()

const emit = defineEmits<{
  openHistory: []
  togglePin: []
  toggleMute: [value: boolean]
  clearMessages: []
  openTargetDetail: []
  openGroupFiles: []
  openGroupNotice: []
  leaveGroup: []
  transferGroup: []
  disbandGroup: []
}>()

const getAvatarFallback = (name: string) => {
  if (!name) return '#'
  return name.trim().charAt(0).toUpperCase() || '#'
}

const groupNotice = computed(() => props.groupInfo?.notice?.trim() || '暂无公告')
const groupMemberCount = computed(() => {
  const count = props.groupInfo?.memberCount
  if (typeof count === 'number' && count > 0) return count
  return props.groupMembers?.length || 0
})

const isGroupOwner = computed(() => {
  const currentUserId = String(userStore.userInfo?.id || '')
  return !!props.groupInfo?.ownerId && !!currentUserId && String(props.groupInfo.ownerId) === currentUserId
})
const groupDisplayName = computed(
  () => props.groupInfo?.remark || props.groupInfo?.name || props.title || '群聊',
)
const groupDisplayId = computed(() => props.groupInfo?.id || '')
</script>

<template>
  <section class="border-b">
    <div class="relative h-28 overflow-hidden bg-muted">
      <img
        v-if="groupInfo?.coverUrl"
        :src="groupInfo.coverUrl"
        alt="group-cover"
        class="h-full w-full object-cover"
      />
      <div class="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/50" />
      <div class="absolute bottom-3 left-4 right-4 flex items-end gap-3">
        <button type="button" class="cursor-pointer rounded-full" @click="emit('openTargetDetail')">
          <Avatar class="h-12 w-12 border border-white/30">
            <AvatarImage :src="groupInfo?.avatar || ''" />
            <AvatarFallback class="bg-black/40 text-white">
              {{ getAvatarFallback(groupDisplayName) }}
            </AvatarFallback>
          </Avatar>
        </button>
        <div class="min-w-0 flex-1 text-white">
          <button
            type="button"
            class="max-w-full cursor-pointer truncate text-left text-sm font-semibold hover:text-primary-foreground"
            @click="emit('openTargetDetail')"
          >
            {{ groupDisplayName }}
          </button>
          <p class="truncate text-xs text-white/85">群号: {{ groupDisplayId || '-' }}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="space-y-1 px-2 py-2">
    <button
      class="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
      @click="emit('openHistory')"
    >
      <span class="inline-flex items-center gap-2">
        <History class="h-4 w-4" />
        聊天记录
      </span>
      <ChevronRight class="h-4 w-4 text-muted-foreground" />
    </button>

    <button
      class="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
      @click="emit('togglePin')"
    >
      <span class="inline-flex items-center gap-2">
        <StickyNote class="h-4 w-4" />
        {{ pinned ? '取消置顶' : '设为置顶' }}
      </span>
    </button>

    <div class="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 hover:bg-muted">
      <span class="inline-flex select-none items-center gap-2 text-sm">
        <BellOff class="h-4 w-4" />
        消息免打扰
      </span>
      <Switch :model-value="!!muted" @update:model-value="(v) => emit('toggleMute', !!v)" />
    </div>

    <button
      class="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
      @click="emit('openGroupFiles')"
    >
      <span class="inline-flex items-center gap-2">
        <Files class="h-4 w-4" />
        群文件
      </span>
      <ChevronRight class="h-4 w-4 text-muted-foreground" />
    </button>

    <button
      class="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
      @click="emit('openGroupNotice')"
    >
      <span class="inline-flex items-center gap-2">
        <Megaphone class="h-4 w-4" />
        群公告
      </span>
      <ChevronRight class="h-4 w-4 text-muted-foreground" />
    </button>

    <div
      class="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap break-words"
    >
      {{ groupNotice }}
    </div>

    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
      <span class="inline-flex items-center gap-2">
        <Users class="h-3.5 w-3.5" />
        群人数：{{ groupMemberCount }}
      </span>
    </div>
  </section>

  <section class="space-y-2 border-t px-3 py-3">
    <Button
      variant="outline"
      class="w-full justify-start"
      :disabled="loading"
      @click="emit('clearMessages')"
    >
      <Trash2 class="mr-2 h-4 w-4" />
      删除聊天记录
    </Button>

    <template v-if="isGroupOwner">
      <Button
        variant="outline"
        class="w-full justify-start"
        :disabled="loading"
        @click="emit('transferGroup')"
      >
        <ArrowRightLeft class="mr-2 h-4 w-4" />
        转让群
      </Button>
      <Button
        variant="destructive"
        class="w-full justify-start"
        :disabled="loading"
        @click="emit('disbandGroup')"
      >
        <Trash2 class="mr-2 h-4 w-4" />
        解散群
      </Button>
    </template>
    <Button
      v-else
      variant="destructive"
      class="w-full justify-start"
      :disabled="loading"
      @click="emit('leaveGroup')"
    >
      <LogOut class="mr-2 h-4 w-4" />
      退群
    </Button>
  </section>
</template>

