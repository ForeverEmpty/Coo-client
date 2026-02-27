<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { QuickContextMenuEntry, QuickContextMenuTrigger } from "./types"
import { onBeforeUnmount, ref } from "vue"
import { cn } from "@/lib/utils"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "."
import QuickContextMenuNode from "./QuickContextMenuNode.vue"

const props = withDefaults(
  defineProps<{
    menu: QuickContextMenuEntry[]
    trigger?: QuickContextMenuTrigger
    hoverDelay?: number
    disabled?: boolean
    triggerClass?: HTMLAttributes["class"]
    contentClass?: HTMLAttributes["class"]
  }>(),
  {
    trigger: "contextmenu",
    hoverDelay: 120,
    disabled: false,
  },
)

const emit = defineEmits<{
  select: [item: QuickContextMenuEntry]
}>()

const triggerEl = ref<HTMLElement | null>(null)
const internalOpenDispatch = ref(false)
let hoverTimer: ReturnType<typeof setTimeout> | null = null

const clearHoverTimer = () => {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
}

const dispatchOpen = (clientX: number, clientY: number) => {
  if (props.disabled || !triggerEl.value) return

  internalOpenDispatch.value = true
  const evt = new PointerEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    button: 2,
  })
  triggerEl.value.dispatchEvent(evt)

  queueMicrotask(() => {
    internalOpenDispatch.value = false
  })
}

const dispatchOpenByElementCenter = (el: HTMLElement) => {
  const rect = el.getBoundingClientRect()
  dispatchOpen(rect.left + rect.width / 2, rect.top + rect.height / 2)
}

const handleContextMenuCapture = (event: MouseEvent) => {
  if (props.disabled) {
    event.preventDefault()
    return
  }

  if (props.trigger !== "contextmenu" && !internalOpenDispatch.value) {
    event.preventDefault()
  }
}

const handleClick = (event: MouseEvent) => {
  if (props.trigger !== "click" || props.disabled) return
  event.preventDefault()
  dispatchOpen(event.clientX, event.clientY)
}

const handleMouseEnter = (event: MouseEvent) => {
  if (props.trigger !== "hover" || props.disabled) return
  clearHoverTimer()

  const el = event.currentTarget as HTMLElement | null
  if (!el) return

  hoverTimer = setTimeout(() => {
    dispatchOpenByElementCenter(el)
  }, props.hoverDelay)
}

const handleMouseLeave = () => {
  clearHoverTimer()
}

onBeforeUnmount(() => {
  clearHoverTimer()
})
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <div
        ref="triggerEl"
        :class="cn('w-fit', props.triggerClass)"
        @contextmenu.capture="handleContextMenuCapture"
        @click="handleClick"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <slot />
      </div>
    </ContextMenuTrigger>

    <ContextMenuContent :class="props.contentClass">
      <QuickContextMenuNode
        :menu="props.menu"
        @select="emit('select', $event)"
      />
    </ContextMenuContent>
  </ContextMenu>
</template>
