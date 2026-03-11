<script setup lang="ts">
import { X } from 'lucide-vue-next'

defineProps<{
  visible: boolean
  senderName: string
  content: string
}>()

const emit = defineEmits<{
  clear: []
}>()
</script>

<template>
  <div
    v-if="visible"
    class="mx-2 mt-2 flex items-start justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
  >
    <div class="min-w-0">
      <p class="text-xs font-medium text-muted-foreground">
        回复 {{ senderName || '消息' }}
      </p>
      <p class="truncate text-xs">{{ content || '[消息]' }}</p>
    </div>
    <button class="rounded p-1 text-muted-foreground hover:text-foreground" @click="emit('clear')">
      <X class="h-3.5 w-3.5" />
    </button>
  </div>
</template>
