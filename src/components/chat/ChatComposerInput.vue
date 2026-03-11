<script setup lang="ts">
import { Loader2, Send } from 'lucide-vue-next'
import type { QuickContextMenuEntry } from '@/components/ui/context-menu'
import { Button } from '@/components/ui/button'
import { QuickContextMenu } from '@/components/ui/context-menu'

defineProps<{
  modelValue: string
  disabled?: boolean
  canSend: boolean
  menu: QuickContextMenuEntry[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  keydown: [event: KeyboardEvent]
  paste: [event: ClipboardEvent]
  textareaRefChange: [value: HTMLTextAreaElement | null]
}>()
</script>

<template>
  <div class="flex-1 flex gap-2 p-2 min-h-0">
    <div class="min-w-0 flex-1">
      <QuickContextMenu :menu="menu" trigger="contextmenu" trigger-class="w-full h-full">
        <textarea
          :ref="(el) => emit('textareaRefChange', el as HTMLTextAreaElement | null)"
          :value="modelValue"
          placeholder=""
          class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex field-sizing-content min-h-16 h-full w-full rounded-md border bg-muted/30 px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 resize-none custom-scrollbar"
          :disabled="disabled"
          @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
          @keydown="(event) => emit('keydown', event)"
          @paste="(event) => emit('paste', event)"
        />
      </QuickContextMenu>
    </div>
    <div class="flex flex-col justify-end pb-1 pr-1">
      <Button size="icon" class="h-10 w-10 rounded-full shadow-md" :disabled="!canSend" @click="emit('send')">
        <Loader2 v-if="disabled" class="h-5 w-5 animate-spin" />
        <Send v-else class="h-5 w-5" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: transparent;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.2);
  border-radius: 4px;
}
</style>
