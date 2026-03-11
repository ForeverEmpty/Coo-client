import { computed, ref } from 'vue'
import {
  PREVIEW_CLICK_SCALE_STEP,
  PREVIEW_SCALE_MAX,
  PREVIEW_SCALE_MIN,
  PREVIEW_SCALE_STEP,
} from '@/components/chat/chatMainAreaHelpers'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const useImagePreview = () => {
  const previewImageUrl = ref('')
  const imagePreviewOpen = ref(false)
  const previewViewportRef = ref<HTMLElement | null>(null)
  const previewImageRef = ref<HTMLImageElement | null>(null)
  const previewScale = ref(1)
  const previewTranslateX = ref(0)
  const previewTranslateY = ref(0)
  const previewDragging = ref(false)
  const previewPointerId = ref<number | null>(null)
  const previewDragStartX = ref(0)
  const previewDragStartY = ref(0)
  const previewDragOriginX = ref(0)
  const previewDragOriginY = ref(0)
  const previewDragMoved = ref(false)
  const previewSkipClick = ref(false)

  const previewScaleText = computed(() => `${Math.round(previewScale.value * 100)}%`)

  const resolveClampedPreviewTranslate = (x: number, y: number) => {
    const viewport = previewViewportRef.value
    const image = previewImageRef.value
    if (!viewport || !image || previewScale.value <= 1) {
      return { x: 0, y: 0 }
    }

    const baseWidth = image.clientWidth
    const baseHeight = image.clientHeight
    if (!baseWidth || !baseHeight) {
      return { x, y }
    }

    const scaledWidth = baseWidth * previewScale.value
    const scaledHeight = baseHeight * previewScale.value
    const maxX = Math.max(0, (scaledWidth - viewport.clientWidth) / 2)
    const maxY = Math.max(0, (scaledHeight - viewport.clientHeight) / 2)

    return {
      x: clamp(x, -maxX, maxX),
      y: clamp(y, -maxY, maxY),
    }
  }

  const applyPreviewTranslate = (x: number, y: number) => {
    const clamped = resolveClampedPreviewTranslate(x, y)
    previewTranslateX.value = clamped.x
    previewTranslateY.value = clamped.y
  }

  const resetPreviewTransform = () => {
    previewScale.value = 1
    previewTranslateX.value = 0
    previewTranslateY.value = 0
    previewDragging.value = false
    previewPointerId.value = null
  }

  const setPreviewScale = (nextScale: number) => {
    const clamped = clamp(nextScale, PREVIEW_SCALE_MIN, PREVIEW_SCALE_MAX)
    previewScale.value = clamped
    if (clamped <= 1) {
      previewTranslateX.value = 0
      previewTranslateY.value = 0
      previewDragging.value = false
      previewPointerId.value = null
      return
    }
    applyPreviewTranslate(previewTranslateX.value, previewTranslateY.value)
  }

  const zoomInPreview = () => {
    setPreviewScale(previewScale.value + PREVIEW_SCALE_STEP)
  }

  const zoomOutPreview = () => {
    setPreviewScale(previewScale.value - PREVIEW_SCALE_STEP)
  }

  const handlePreviewReset = () => {
    resetPreviewTransform()
  }

  const handlePreviewClose = () => {
    imagePreviewOpen.value = false
  }

  const handlePreviewWheel = (event: WheelEvent) => {
    const delta = event.deltaY < 0 ? PREVIEW_SCALE_STEP : -PREVIEW_SCALE_STEP
    setPreviewScale(previewScale.value + delta)
  }

  const handlePreviewPointerDown = (event: PointerEvent) => {
    if (previewScale.value <= 1) return
    const currentTarget = event.currentTarget as HTMLElement | null
    if (!currentTarget) return

    previewDragging.value = true
    previewDragMoved.value = false
    previewSkipClick.value = false
    previewPointerId.value = event.pointerId
    previewDragStartX.value = event.clientX
    previewDragStartY.value = event.clientY
    previewDragOriginX.value = previewTranslateX.value
    previewDragOriginY.value = previewTranslateY.value
    currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const handlePreviewPointerMove = (event: PointerEvent) => {
    if (!previewDragging.value) return
    if (previewPointerId.value !== event.pointerId) return

    const deltaX = event.clientX - previewDragStartX.value
    const deltaY = event.clientY - previewDragStartY.value
    if (!previewDragMoved.value && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
      previewDragMoved.value = true
    }
    applyPreviewTranslate(previewDragOriginX.value + deltaX, previewDragOriginY.value + deltaY)
  }

  const handlePreviewPointerUp = (event: PointerEvent) => {
    if (previewPointerId.value !== null && previewPointerId.value !== event.pointerId) return

    if (previewDragMoved.value) {
      previewSkipClick.value = true
    }
    previewDragging.value = false
    previewDragMoved.value = false
    previewPointerId.value = null
    const currentTarget = event.currentTarget as HTMLElement | null
    if (currentTarget?.hasPointerCapture(event.pointerId)) {
      currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handlePreviewImageLoad = () => {
    applyPreviewTranslate(previewTranslateX.value, previewTranslateY.value)
  }

  const handlePreviewImageClick = (event: MouseEvent) => {
    if (previewSkipClick.value) {
      previewSkipClick.value = false
      return
    }
    if (event.detail > 1) return
    setPreviewScale(previewScale.value + PREVIEW_CLICK_SCALE_STEP)
  }

  const openImagePreview = (url: string) => {
    if (!url) return
    resetPreviewTransform()
    previewImageUrl.value = url
    imagePreviewOpen.value = true
  }

  return {
    previewImageUrl,
    imagePreviewOpen,
    previewViewportRef,
    previewImageRef,
    previewScale,
    previewTranslateX,
    previewTranslateY,
    previewDragging,
    previewScaleText,
    applyPreviewTranslate,
    resetPreviewTransform,
    zoomInPreview,
    zoomOutPreview,
    handlePreviewReset,
    handlePreviewClose,
    handlePreviewWheel,
    handlePreviewPointerDown,
    handlePreviewPointerMove,
    handlePreviewPointerUp,
    handlePreviewImageLoad,
    handlePreviewImageClick,
    openImagePreview,
  }
}
