<script setup lang="ts">
import { computed } from 'vue'
import type { GroupInfo, GroupMember } from '@/api/types'
import ChatGroupActionPanel from '@/components/chat/ChatGroupActionPanel.vue'
import ChatPrivateActionPanel from '@/components/chat/ChatPrivateActionPanel.vue'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  isGroup: boolean
  loading?: boolean
  title: string
  avatar?: string
  userId?: string
  pinned?: boolean
  blocked?: boolean
  muted?: boolean
  groupInfo?: GroupInfo | null
  groupMembers?: GroupMember[]
}>()

const emit = defineEmits<{
  close: []
  openHistory: []
  togglePin: []
  toggleBlock: []
  toggleMute: [value: boolean]
  clearMessages: []
  deleteFriend: []
  memberClick: [userId: string]
  openTargetDetail: []
  openGroupFiles: []
  openGroupNotice: []
  leaveGroup: []
  transferGroup: []
  disbandGroup: []
}>()

const activePanel = computed(() => (props.isGroup ? ChatGroupActionPanel : ChatPrivateActionPanel))

const panelProps = computed(() => {
  if (props.isGroup) {
    return {
      title: props.title,
      loading: props.loading,
      pinned: props.pinned,
      muted: props.muted,
      groupInfo: props.groupInfo,
      groupMembers: props.groupMembers,
    }
  }

  return {
    loading: props.loading,
    title: props.title,
    avatar: props.avatar,
    userId: props.userId,
    pinned: props.pinned,
    blocked: props.blocked,
    muted: props.muted,
  }
})

const panelListeners = computed(() => {
  if (props.isGroup) {
    return {
      openHistory: () => emit('openHistory'),
      togglePin: () => emit('togglePin'),
      toggleMute: (value: boolean) => emit('toggleMute', value),
      clearMessages: () => emit('clearMessages'),
      openTargetDetail: () => emit('openTargetDetail'),
      openGroupFiles: () => emit('openGroupFiles'),
      openGroupNotice: () => emit('openGroupNotice'),
      leaveGroup: () => emit('leaveGroup'),
      transferGroup: () => emit('transferGroup'),
      disbandGroup: () => emit('disbandGroup'),
    }
  }

  return {
    openHistory: () => emit('openHistory'),
    togglePin: () => emit('togglePin'),
    toggleBlock: () => emit('toggleBlock'),
    toggleMute: (value: boolean) => emit('toggleMute', value),
    clearMessages: () => emit('clearMessages'),
    deleteFriend: () => emit('deleteFriend'),
    openTargetDetail: () => emit('openTargetDetail'),
  }
})
</script>

<template>
  <Transition name="drawer-fade">
    <div v-if="open" class="absolute inset-0 z-30 flex justify-end">
      <div class="absolute inset-0 bg-black/30" @click="emit('close')" />
      <aside
        class="relative z-10 h-full w-85 max-w-[90vw] border-l bg-background shadow-xl"
        @click.stop
      >
        <header class="flex items-center justify-between border-b px-4 py-3">
          <h3 class="text-sm font-semibold">{{ isGroup ? '群聊详情' : '聊天设置' }}</h3>
          <Button variant="ghost" size="icon" class="h-8 w-8" @click="emit('close')">
            <X class="h-4 w-4" />
          </Button>
        </header>

        <component :is="activePanel" v-bind="panelProps" v-on="panelListeners" />
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}
</style>
