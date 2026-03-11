<script setup lang="ts">
import {
  BellOff,
  ChevronRight,
  History,
  ShieldBan,
  StickyNote,
  Trash2,
  UserRound,
} from 'lucide-vue-next'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

defineProps<{
  loading?: boolean
  title: string
  avatar?: string
  userId?: string
  pinned?: boolean
  blocked?: boolean
  muted?: boolean
}>()

const emit = defineEmits<{
  openHistory: []
  togglePin: []
  toggleBlock: []
  toggleMute: [value: boolean]
  clearMessages: []
  deleteFriend: []
  openTargetDetail: []
}>()

const getAvatarFallback = (name: string) => {
  if (!name) return '#'
  return name.trim().charAt(0).toUpperCase() || '#'
}
</script>

<template>
  <section class="border-b px-4 py-4">
    <div class="flex items-center gap-3">
      <button type="button" class="cursor-pointer rounded-full" @click="emit('openTargetDetail')">
        <Avatar class="h-11 w-11">
          <AvatarImage :src="avatar || ''" />
          <AvatarFallback>{{ getAvatarFallback(title) }}</AvatarFallback>
        </Avatar>
      </button>
      <div class="min-w-0 flex-1">
        <button
          type="button"
          class="max-w-full cursor-pointer truncate text-left text-sm font-semibold hover:text-primary"
          @click="emit('openTargetDetail')"
        >
          {{ title || userId || '未知用户' }}
        </button>
        <p class="truncate text-xs text-muted-foreground">ID: {{ userId || '-' }}</p>
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

    <button
      class="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
      @click="emit('toggleBlock')"
    >
      <span class="inline-flex items-center gap-2">
        <ShieldBan class="h-4 w-4" />
        {{ blocked ? '取消拉黑' : '拉黑' }}
      </span>
    </button>

    <div class="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 hover:bg-muted">
      <span class="inline-flex select-none items-center gap-2 text-sm">
        <BellOff class="h-4 w-4" />
        消息免打扰
      </span>
      <Switch :model-value="!!muted" @update:model-value="(v) => emit('toggleMute', !!v)" />
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
    <Button
      variant="destructive"
      class="w-full justify-start"
      :disabled="loading"
      @click="emit('deleteFriend')"
    >
      <UserRound class="mr-2 h-4 w-4" />
      删除好友
    </Button>
  </section>
</template>
