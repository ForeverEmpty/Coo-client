<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle, Check, FileIcon, Loader2 } from 'lucide-vue-next'
import { ContentType } from '@/api/enum'
import type { ChatUiMessage } from '@/stores/chatStore'
import type { QuickContextMenuEntry } from '@/components/ui/context-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { QuickContextMenu } from '@/components/ui/context-menu'
import {
  formatFileSize,
  formatMessageTime,
  getFileMessageClass,
  getImageMessageClass,
  getMediaQuoteClass,
  isFileMessage,
  isImageMessage,
} from '@/components/chat/chatMainAreaHelpers'

const props = defineProps<{
  msg: ChatUiMessage
  isGroup: boolean
  multiSelectMode: boolean
  isSelected: boolean
  senderMeta: { name: string; avatar?: string; role?: number }
  messageMenu: QuickContextMenuEntry[]
  retryAnimating: boolean
  rowRef?: (el: Element | null) => void
}>()

const emit = defineEmits<{
  itemClick: [message: ChatUiMessage]
  toggleSelect: [localId: string]
  avatarClick: [userId: string]
  openImage: [url: string]
  retry: [localId: string]
  mediaLoad: [message: ChatUiMessage]
}>()

const rowClass = computed(() => [
  'group flex gap-3 max-w-[85%] rounded-xl px-1 py-1 transition-colors',
  props.msg.direction === 'out' ? 'ml-auto flex-row-reverse' : '',
  props.multiSelectMode && props.isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : '',
])
</script>

<template>
  <div :ref="(refValue) => rowRef?.(refValue as Element | null)" :class="rowClass" @click="emit('itemClick', msg)">
    <button
      v-if="multiSelectMode"
      class="mt-2 h-5 w-5 shrink-0 rounded-full border border-border/70 flex items-center justify-center transition-colors"
      :class="isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'"
      @click.stop="emit('toggleSelect', msg.localId)"
    >
      <Check v-if="isSelected" class="h-3 w-3" />
    </button>

    <Avatar
      class="h-9 w-9 mt-1 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
      @click.stop="emit('avatarClick', msg.fromId)"
    >
      <AvatarImage :src="senderMeta.avatar || ''" />
      <AvatarFallback>
        {{ senderMeta.name?.[0] || '用' }}
      </AvatarFallback>
    </Avatar>

    <div :class="msg.direction === 'out' ? 'items-end' : 'items-start'" class="flex flex-col min-w-0">
      <span v-if="isGroup && msg.direction !== 'out'" class="text-[10px] text-muted-foreground mb-1 ml-1">
        {{ senderMeta.name }}
      </span>

      <QuickContextMenu :menu="messageMenu" trigger="contextmenu" trigger-class="w-fit max-w-full">
        <div class="max-w-full">
          <div
            v-if="msg.replyTo && msg.status !== 'recalled'"
            :class="
              isImageMessage(msg) || isFileMessage(msg)
                ? getMediaQuoteClass(msg)
                : 'mb-2 rounded-md border border-white/20 bg-black/10 px-2 py-1 text-xs opacity-85'
            "
          >
            <p class="font-medium truncate">
              {{ msg.replyTo.senderName || '引用消息' }}
            </p>
            <p class="truncate">{{ msg.replyTo.content || '[消息]' }}</p>
          </div>

          <template v-if="msg.status === 'recalled'">
            <div
              class="px-4 py-2.5 text-sm shadow-sm leading-relaxed whitespace-pre-wrap warp-break-words"
              :class="
                msg.direction === 'out'
                  ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-none'
                  : 'bg-muted/80 text-foreground rounded-2xl rounded-tl-none'
              "
            >
              <span class="italic opacity-80">[已撤回]</span>
            </div>
          </template>

          <template v-else-if="msg.contentType === ContentType.IMAGE">
            <button v-if="msg.url" :class="getImageMessageClass(msg)" @click.stop="emit('openImage', msg.url)">
              <img
                :src="msg.url"
                alt="图片消息"
                class="max-h-64 max-w-[18rem] object-cover"
                @load="emit('mediaLoad', msg)"
              />
            </button>
            <div
              v-else
              class="px-4 py-2.5 text-sm shadow-sm leading-relaxed whitespace-pre-wrap warp-break-words"
              :class="
                msg.direction === 'out'
                  ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-none'
                  : 'bg-muted/80 text-foreground rounded-2xl rounded-tl-none'
              "
            >
              {{ msg.content || '[图片]' }}
            </div>
          </template>

          <template v-else-if="msg.contentType === ContentType.FILE">
            <a
              v-if="msg.url"
              :href="msg.url"
              target="_blank"
              rel="noopener noreferrer"
              :class="getFileMessageClass(msg)"
              @click.stop
            >
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/70">
                <FileIcon class="h-4 w-4" />
              </div>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">
                  {{ msg.fileName || msg.content || '文件' }}
                </span>
                <span class="mt-0.5 block text-[10px] text-muted-foreground">
                  {{ formatFileSize(msg.fileSize) }}
                </span>
              </span>
            </a>
            <div v-else :class="getFileMessageClass(msg)">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/70">
                <FileIcon class="h-4 w-4" />
              </div>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">
                  {{ msg.fileName || msg.content || '[文件]' }}
                </span>
                <span class="mt-0.5 block text-[10px] text-muted-foreground">
                  {{ formatFileSize(msg.fileSize) }}
                </span>
              </span>
            </div>
          </template>

          <template v-else>
            <div
              class="px-4 py-2.5 text-sm shadow-sm leading-relaxed whitespace-pre-wrap warp-break-words"
              :class="
                msg.direction === 'out'
                  ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-none'
                  : 'bg-muted/80 text-foreground rounded-2xl rounded-tl-none'
              "
            >
              {{ msg.content }}
            </div>
          </template>
        </div>
      </QuickContextMenu>

      <div class="mt-1 mx-1 text-[10px] text-muted-foreground flex items-center gap-2">
        <span>{{ formatMessageTime(msg.timestamp) }}</span>
        <Loader2
          v-if="msg.direction === 'out' && msg.status === 'sending'"
          class="h-3.5 w-3.5 animate-spin text-muted-foreground/80"
          title="发送中..."
        />
        <button
          v-if="msg.direction === 'out' && msg.status === 'failed'"
          class="relative text-red-500 hover:text-red-600 transition-colors"
          :title="retryAnimating ? '重试中...' : '发送失败，点击重试'"
          @click.stop="emit('retry', msg.localId)"
        >
          <span
            v-if="retryAnimating"
            class="pointer-events-none absolute inset-0 rounded-full retry-ring"
          />
          <AlertCircle class="h-3.5 w-3.5" :class="retryAnimating ? 'retry-icon' : ''" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.retry-icon {
  animation: retryIcon 0.45s ease-in-out;
}

.retry-ring {
  animation: retryRing 0.6s ease-out;
}

@keyframes retryIcon {
  0% {
    transform: scale(1) rotate(0deg);
  }
  35% {
    transform: scale(1.2) rotate(-12deg);
  }
  70% {
    transform: scale(1.05) rotate(8deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
  }
}

@keyframes retryRing {
  0% {
    transform: scale(0.75);
    opacity: 0.6;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
}
</style>

