<script setup lang="ts">
import { File as FileIcon, X } from 'lucide-vue-next'
import type { ComposerAttachment } from '@/types/chatComposer'
import { formatFileSize } from '@/components/chat/chatMainAreaHelpers'

defineProps<{
  attachments: ComposerAttachment[]
  sending?: boolean
}>()

const emit = defineEmits<{
  remove: [attachmentId: string]
}>()
</script>

<template>
  <div v-if="attachments.length > 0" class="px-2 pt-2">
    <div class="flex flex-wrap gap-2">
      <div
        v-for="attachment in attachments"
        :key="attachment.id"
        class="relative flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5"
      >
        <img
          v-if="attachment.type === 'image' && attachment.previewUrl"
          :src="attachment.previewUrl"
          alt="pending image"
          class="h-10 w-10 rounded object-cover border"
        />
        <FileIcon v-else class="h-4 w-4 text-muted-foreground" />
        <div class="min-w-0">
          <p class="truncate text-xs font-medium max-w-40">{{ attachment.file.name }}</p>
          <p class="text-[10px] text-muted-foreground">
            {{ formatFileSize(attachment.file.size) }}
          </p>
        </div>
        <span
          v-if="sending"
          class="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
        >
          发送中...
        </span>
        <button
          class="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
          :disabled="sending"
          @click="emit('remove', attachment.id)"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
