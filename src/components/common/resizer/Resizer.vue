<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  modelValue: number
  direction?: 'vertical' | 'horizontal'
  /**
   * 拖拽哪一侧边缘？
   * vertical 时通常选 top (如底部输入框) 或 bottom
   * horizontal 时通常选 right (如左侧列表) 或 left
   */
  side?: 'top' | 'bottom' | 'left' | 'right'
  min?: number
  max?: number
  trim?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'vertical',
  side: 'top',
  min: 100,
  max: 600,
  trim: true,
})

const emit = defineEmits(['update:modelValue', 'resizeStart', 'resizeEnd'])

const isResizing = ref(false)

let startPos = 0
let startSize = 0

const startResize = (e: MouseEvent) => {
  isResizing.value = true
  emit('resizeStart')

  startPos = props.direction === 'vertical' ? e.clientY : e.clientX
  startSize = props.modelValue

  document.body.style.userSelect = 'none'
  // 根据方向设置全局光标
  document.body.style.cursor = props.direction === 'vertical' ? 'ns-resize' : 'ew-resize'

  const onMouseMove = (moveEvent: MouseEvent) => {
    if (!isResizing.value) return

    const currentPos = props.direction === 'vertical' ? moveEvent.clientY : moveEvent.clientX
    const delta = currentPos - startPos

    let newSize = startSize

    if (props.side === 'top' || props.side === 'left') {
      newSize = startSize - delta
    } else {
      newSize = startSize + delta
    }

    // 边界约束
    const clampedSize = Math.max(props.min, Math.min(props.max, newSize))
    emit('update:modelValue', clampedSize)
  }

  const stopResize = () => {
    isResizing.value = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    emit('resizeEnd')
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', stopResize)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', stopResize)
}

onUnmounted(() => {
  document.body.style.cursor = ''
})
</script>

<template>
  <div
    @mousedown="startResize"
    :class="
      cn(
        'transition-colors z-50 shrink-0 relative group active:bg-primary/40',
        // 根据方向应用不同的尺寸和光标
        direction === 'vertical'
          ? 'h-1.5 w-full cursor-ns-resize hover:bg-primary/30'
          : 'w-1.5 h-full cursor-ew-resize hover:bg-primary/30',
        props.class,
      )
    "
  >
    <!-- 装饰条（视觉提示） -->
    <div
      v-if="trim"
      :class="
        cn(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-muted-foreground/20 rounded-full group-hover:bg-muted-foreground/40 transition-colors',
          direction === 'vertical' ? 'w-8 h-1' : 'h-8 w-1',
        )
      "
    ></div>
  </div>
</template>
