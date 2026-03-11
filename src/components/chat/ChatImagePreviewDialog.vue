<script setup lang="ts">
import { Minus, Plus, RotateCcw, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'

defineProps<{
  open: boolean
  imageUrl: string
  scale: number
  translateX: number
  translateY: number
  dragging: boolean
  scaleText: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  zoomIn: []
  zoomOut: []
  reset: []
  close: []
  wheel: [event: WheelEvent]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  imageLoad: [event: Event]
  imageClick: [event: MouseEvent]
  pointerDown: [event: PointerEvent]
  viewportRefChange: [value: HTMLElement | null]
  imageRefChange: [value: HTMLImageElement | null]
}>()
</script>

<template>
  <Dialog :open="open" @update:open="(value) => emit('update:open', value)">
    <DialogContent
      :show-close-button="false"
      class="max-w-[min(96vw,1200px)] h-[88vh] p-0 overflow-hidden border-0 bg-black/95 text-white"
    >
      <div class="relative h-full w-full">
        <div
          class="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-md bg-black/60 px-2 py-1.5 backdrop-blur"
        >
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 rounded-md text-white hover:bg-white/20 hover:text-white"
            @click="emit('zoomOut')"
          >
            <Minus class="h-4 w-4" />
          </Button>
          <span class="min-w-12 text-center text-xs font-semibold">{{ scaleText }}</span>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 rounded-md text-white hover:bg-white/20 hover:text-white"
            @click="emit('zoomIn')"
          >
            <Plus class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 rounded-md text-white hover:bg-white/20 hover:text-white"
            @click="emit('reset')"
          >
            <RotateCcw class="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="ghost"
          class="absolute top-3 right-3 z-20 h-9 rounded-md bg-black/70 px-3 text-white font-medium border border-white/25 hover:bg-black/90 hover:text-white"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </Button>

        <div
          :ref="(el) => emit('viewportRefChange', el as HTMLElement | null)"
          class="h-full w-full overflow-hidden select-none flex items-center justify-center"
          @wheel.prevent="(event) => emit('wheel', event)"
          @pointermove="(event) => emit('pointerMove', event)"
          @pointerup="(event) => emit('pointerUp', event)"
          @pointercancel="(event) => emit('pointerUp', event)"
        >
          <img
            v-if="imageUrl"
            :ref="(el) => emit('imageRefChange', el as HTMLImageElement | null)"
            :src="imageUrl"
            alt="preview"
            class="max-h-full max-w-full object-contain rounded"
            :class="scale > 1 ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'"
            :style="{
              transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
              transition: dragging ? 'none' : 'transform 120ms ease',
              willChange: 'transform',
            }"
            @load="(event) => emit('imageLoad', event)"
            @click="(event) => emit('imageClick', event)"
            @dblclick="emit('reset')"
            @pointerdown="(event) => emit('pointerDown', event)"
            @dragstart.prevent
          />
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
