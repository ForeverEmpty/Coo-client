<script setup lang="ts">
import { computed } from 'vue'
import { Check } from 'lucide-vue-next'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface ForwardFriendOption {
  id: string
  name: string
  avatar?: string
}

const props = defineProps<{
  open: boolean
  loading: boolean
  messageCount: number
  friends: ForwardFriendOption[]
  selectedTargetIds: string[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  toggleTarget: [targetId: string]
  confirm: []
}>()

const selectedSet = computed(() => new Set(props.selectedTargetIds))
const selectedCount = computed(() => selectedSet.value.size)
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-w-md p-0 overflow-hidden">
      <div class="border-b px-4 py-3">
        <h3 class="text-sm font-semibold">选择转发对象</h3>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ messageCount }} 条消息待转发
        </p>
      </div>
      <div class="max-h-80 overflow-y-auto p-2">
        <div v-if="loading" class="py-10 text-center text-sm text-muted-foreground">加载中...</div>
        <div v-else-if="friends.length === 0" class="py-10 text-center text-sm text-muted-foreground">
          暂无可用联系人
        </div>
        <button
          v-for="friend in friends"
          :key="friend.id"
          type="button"
          class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/50"
          :class="selectedSet.has(friend.id) ? 'bg-primary/10 ring-1 ring-primary/30' : ''"
          @click="emit('toggleTarget', friend.id)"
        >
          <Avatar class="h-8 w-8 rounded-full">
            <AvatarImage :src="friend.avatar || ''" />
            <AvatarFallback>{{ friend.name?.[0] || 'U' }}</AvatarFallback>
          </Avatar>
          <span class="min-w-0 flex-1 truncate text-sm">{{ friend.name }}</span>
          <Check v-if="selectedSet.has(friend.id)" class="h-4 w-4 text-primary" />
        </button>
      </div>
      <div class="flex items-center justify-end gap-2 border-t px-4 py-3">
        <Button variant="ghost" @click="emit('update:open', false)">取消</Button>
        <Button :disabled="selectedCount === 0" @click="emit('confirm')">转发</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
