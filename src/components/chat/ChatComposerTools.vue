<script setup lang="ts">
import { computed, ref } from 'vue'
import { Image, Paperclip, Smile } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useClickOutside } from '@/composables/useClickOutside'

const props = defineProps<{
  sending?: boolean
  showEmojiPanel: boolean
  recentEmoji: string[]
  emojiPool: readonly string[]
  imageAccept: string
  fileAccept: string
}>()

const emit = defineEmits<{
  'update:showEmojiPanel': [value: boolean]
  emojiPick: [emoji: string]
  filesPicked: [payload: { files: FileList | null; target: 'image' | 'file' }]
}>()

const emojiButtonWrapRef = ref<HTMLElement | null>(null)
const emojiPanelRef = ref<HTMLElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const disabled = computed(() => Boolean(props.sending))

const toggleEmojiPanel = () => {
  if (disabled.value) return
  emit('update:showEmojiPanel', !props.showEmojiPanel)
}

const openImagePicker = () => {
  if (disabled.value) return
  imageInputRef.value?.click()
}

const openFilePicker = () => {
  if (disabled.value) return
  fileInputRef.value?.click()
}

const onImageInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('filesPicked', { files: target.files, target: 'image' })
  target.value = ''
}

const onFileInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('filesPicked', { files: target.files, target: 'file' })
  target.value = ''
}

useClickOutside(
  () => [emojiPanelRef, emojiButtonWrapRef],
  () => emit('update:showEmojiPanel', false),
  {
    enabled: () => props.showEmojiPanel,
  },
)
</script>

<template>
  <div class="relative flex items-center gap-1 px-2 pt-2">
    <div ref="emojiButtonWrapRef" class="contents">
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 text-muted-foreground"
        :disabled="disabled"
        @click="toggleEmojiPanel"
      >
        <Smile class="h-5 w-5" />
      </Button>
    </div>

    <Button
      variant="ghost"
      size="icon"
      class="h-8 w-8 text-muted-foreground"
      :disabled="disabled"
      @click="openImagePicker"
    >
      <Image class="h-5 w-5" />
    </Button>

    <Button
      variant="ghost"
      size="icon"
      class="h-8 w-8 text-muted-foreground"
      :disabled="disabled"
      @click="openFilePicker"
    >
      <Paperclip class="h-5 w-5" />
    </Button>

    <input
      ref="imageInputRef"
      type="file"
      class="hidden"
      :accept="imageAccept"
      multiple
      @change="onImageInputChange"
    />
    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      :accept="fileAccept"
      multiple
      @change="onFileInputChange"
    />

    <div
      v-if="showEmojiPanel"
      ref="emojiPanelRef"
      class="absolute left-2 bottom-[calc(100%+0.5rem)] z-40 w-72 rounded-md border bg-popover p-2 shadow-md"
    >
      <div v-if="recentEmoji.length > 0" class="mb-2">
        <p class="text-[10px] text-muted-foreground mb-1">最近</p>
        <div class="grid grid-cols-8 gap-1">
          <button
            v-for="emoji in recentEmoji"
            :key="`recent-${emoji}`"
            type="button"
            class="rounded px-1 py-1 text-base hover:bg-accent"
            @click="emit('emojiPick', emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
      <div>
        <p class="text-[10px] text-muted-foreground mb-1">常用</p>
        <div class="max-h-64 overflow-y-auto pr-1">
          <div class="grid grid-cols-8 gap-1">
            <button
              v-for="emoji in emojiPool"
              :key="emoji"
              type="button"
              class="rounded px-1 py-1 text-base hover:bg-accent"
              @click="emit('emojiPick', emoji)"
            >
              {{ emoji }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
