<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Loader2, Upload, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { authApi } from '@/api/auth'
import { fileApi } from '@/api/file'
import {
  profileImagePresets,
  type ProfileImageCropPreset,
  type ProfileImageTarget,
} from '@/config/profileImage'

interface ImageUpdatePayload {
  target: ProfileImageTarget
  url: string
}

const MASK_PADDING = 24

const props = withDefaults(
  defineProps<{
    target: ProfileImageTarget
    windowMode?: boolean
  }>(),
  {
    windowMode: false,
  },
)

const emit = defineEmits<{
  close: []
  success: [payload: ImageUpdatePayload]
}>()

const sourceFile = ref<File | null>(null)
const sourceUrl = ref('')
const imageLoaded = ref(false)
const uploading = ref(false)
const zoom = ref(1)
const imageEl = ref<HTMLImageElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const imageNatural = reactive({
  width: 0,
  height: 0,
})

const viewportSize = reactive({
  width: 0,
  height: 0,
})

const cropBoxSize = reactive({
  width: 0,
  height: 0,
})

const position = reactive({
  x: 0,
  y: 0,
})

const dragState = reactive({
  active: false,
  pointerId: -1,
  startX: 0,
  startY: 0,
  baseX: 0,
  baseY: 0,
  hasMoved: false,
})

const preset = computed<ProfileImageCropPreset>(() => profileImagePresets[props.target])

const cropFrameStyle = computed(() => ({
  width: `${cropBoxSize.width}px`,
  height: `${cropBoxSize.height}px`,
  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
}))

const currentScale = computed(() => {
  if (!imageNatural.width || !imageNatural.height || !cropBoxSize.width || !cropBoxSize.height) {
    return 1
  }

  const coverScale = Math.max(
    cropBoxSize.width / imageNatural.width,
    cropBoxSize.height / imageNatural.height,
  )
  return coverScale * zoom.value
})

const canConfirm = computed(() => !!sourceUrl.value && imageLoaded.value && !uploading.value)

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const clearObjectUrl = () => {
  if (!sourceUrl.value) return
  URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = ''
}

const clampPosition = (x: number, y: number) => {
  const width = imageNatural.width * currentScale.value
  const height = imageNatural.height * currentScale.value
  const maxOffsetX = Math.max(0, (width - cropBoxSize.width) / 2)
  const maxOffsetY = Math.max(0, (height - cropBoxSize.height) / 2)

  return {
    x: clamp(x, -maxOffsetX, maxOffsetX),
    y: clamp(y, -maxOffsetY, maxOffsetY),
  }
}

const resetTransform = () => {
  zoom.value = preset.value.minZoom
  position.x = 0
  position.y = 0
}

const syncCropLayout = () => {
  if (!viewportRef.value) return

  viewportSize.width = viewportRef.value.clientWidth
  viewportSize.height = viewportRef.value.clientHeight

  const availableW = Math.max(80, viewportSize.width - MASK_PADDING * 2)
  const availableH = Math.max(80, viewportSize.height - MASK_PADDING * 2)
  const aspect = preset.value.aspect

  let width = availableW
  let height = width / aspect
  if (height > availableH) {
    height = availableH
    width = height * aspect
  }

  cropBoxSize.width = Math.round(width)
  cropBoxSize.height = Math.round(height)

  const next = clampPosition(position.x, position.y)
  position.x = next.x
  position.y = next.y
}

const validateFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    toast.error('请选择图片文件')
    return false
  }

  const sizeLimit = preset.value.maxSourceSizeMB * 1024 * 1024
  if (file.size > sizeLimit) {
    toast.error(`图片不能超过 ${preset.value.maxSourceSizeMB}MB`)
    return false
  }
  return true
}

const openFilePicker = () => {
  if (uploading.value) return
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
  fileInputRef.value?.click()
}

const onSelectFile = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !validateFile(file)) return

  sourceFile.value = file
  imageLoaded.value = false
  clearObjectUrl()
  sourceUrl.value = URL.createObjectURL(file)
  resetTransform()

  await nextTick()
  syncCropLayout()
}

const onImageLoad = () => {
  if (!imageEl.value) return
  imageNatural.width = imageEl.value.naturalWidth
  imageNatural.height = imageEl.value.naturalHeight
  imageLoaded.value = true
  syncCropLayout()
}

const onPointerDown = (event: PointerEvent) => {
  if (!imageLoaded.value || uploading.value || !viewportRef.value) return

  dragState.active = true
  dragState.pointerId = event.pointerId
  dragState.startX = event.clientX
  dragState.startY = event.clientY
  dragState.baseX = position.x
  dragState.baseY = position.y
  dragState.hasMoved = false
  viewportRef.value.setPointerCapture(event.pointerId)
}

const onPointerMove = (event: PointerEvent) => {
  if (!dragState.active || dragState.pointerId !== event.pointerId) return

  const deltaX = event.clientX - dragState.startX
  const deltaY = event.clientY - dragState.startY
  if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
    dragState.hasMoved = true
  }

  const next = clampPosition(dragState.baseX + deltaX, dragState.baseY + deltaY)
  position.x = next.x
  position.y = next.y
}

const endDrag = (event: PointerEvent) => {
  if (!dragState.active || dragState.pointerId !== event.pointerId) return
  dragState.active = false
  dragState.pointerId = -1
}

const onViewportClick = () => {
  if (uploading.value) return
  if (dragState.hasMoved) {
    dragState.hasMoved = false
    return
  }

  if (!sourceUrl.value) {
    openFilePicker()
  }
}

const handleWheelZoom = (event: WheelEvent) => {
  if (!imageLoaded.value || uploading.value) return

  const delta = event.deltaY > 0 ? -0.08 : 0.08
  const next = clamp(zoom.value + delta, preset.value.minZoom, preset.value.maxZoom)
  zoom.value = Number(next.toFixed(2))
}

const buildCroppedBlob = async () => {
  if (!imageEl.value || !imageLoaded.value) {
    throw new Error('Image not loaded')
  }

  const scale = currentScale.value
  const cropWidth = cropBoxSize.width
  const cropHeight = cropBoxSize.height
  const sourceWidth = imageNatural.width
  const sourceHeight = imageNatural.height

  if (!scale || !cropWidth || !cropHeight) {
    throw new Error('Crop area unavailable')
  }

  const sx = sourceWidth / 2 - (cropWidth / 2 + position.x) / scale
  const sy = sourceHeight / 2 - (cropHeight / 2 + position.y) / scale
  const sw = cropWidth / scale
  const sh = cropHeight / scale

  const safeSx = clamp(sx, 0, Math.max(0, sourceWidth - 1))
  const safeSy = clamp(sy, 0, Math.max(0, sourceHeight - 1))
  const safeSw = clamp(sw, 1, sourceWidth - safeSx)
  const safeSh = clamp(sh, 1, sourceHeight - safeSy)

  const canvas = document.createElement('canvas')
  canvas.width = preset.value.outputWidth
  canvas.height = preset.value.outputHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas context unavailable')
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    imageEl.value,
    safeSx,
    safeSy,
    safeSw,
    safeSh,
    0,
    0,
    preset.value.outputWidth,
    preset.value.outputHeight,
  )

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, preset.value.mimeType, preset.value.quality)
  })

  if (!blob) {
    throw new Error('Image export failed')
  }
  return blob
}

const handleConfirm = async () => {
  if (!canConfirm.value || !sourceFile.value) return

  uploading.value = true
  const toastId = toast.loading(`上传${preset.value.title}中... 0%`)

  try {
    const blob = await buildCroppedBlob()
    const ext = preset.value.mimeType.split('/')[1] || 'webp'
    const uploadFile = new File([blob], `${props.target}-${Date.now()}.${ext}`, {
      type: preset.value.mimeType,
    })

    const { data: url } = await fileApi.upload(
      uploadFile,
      (progress) => {
        toast.loading(`上传${preset.value.title}中... ${progress}%`, { id: toastId })
      },
      { skipErrorHandler: true },
    )

    if (props.target === 'avatar') {
      await authApi.updateAvatar(url)
    } else {
      await authApi.updateBackground(url)
    }

    toast.success(`${preset.value.title}更新成功`, { id: toastId })
    emit('success', {
      target: props.target,
      url,
    })
  } catch {
    toast.error(`${preset.value.title}上传失败`, { id: toastId })
  } finally {
    uploading.value = false
  }
}

const closeEditor = () => {
  if (uploading.value) return
  emit('close')
}

watch(zoom, () => {
  const next = clampPosition(position.x, position.y)
  position.x = next.x
  position.y = next.y
})

watch(
  () => props.target,
  () => {
    resetTransform()
    syncCropLayout()
  },
)

onMounted(() => {
  resetTransform()
  syncCropLayout()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', syncCropLayout)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', syncCropLayout)
  }
  clearObjectUrl()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <div
      class="flex items-center justify-between border-b px-4 py-3"
      :class="{ 'app-region-drag': props.windowMode }"
    >
      <div>
        <h3 class="text-sm font-semibold">{{ preset.title }}裁剪</h3>
        <p class="text-xs text-muted-foreground">
          导出尺寸 {{ preset.outputWidth }} x {{ preset.outputHeight }}，滚轮缩放，拖拽平移
        </p>
      </div>
      <Button variant="ghost" size="icon" class="h-8 w-8 app-region-no-drag" @click="closeEditor">
        <X class="h-4 w-4" />
      </Button>
    </div>

    <div class="flex flex-1 flex-col gap-4 p-4 min-h-0 app-region-no-drag">
      <div
        ref="viewportRef"
        class="relative mx-auto w-full max-w-[820px] flex-1 min-h-[360px] overflow-hidden rounded-xl border bg-muted/20 touch-none select-none"
        :class="imageLoaded ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'"
        @click="onViewportClick"
        @dblclick.stop="openFilePicker"
        @wheel.prevent="handleWheelZoom"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @pointerleave="endDrag"
      >
        <template v-if="sourceUrl">
          <img
            ref="imageEl"
            :src="sourceUrl"
            alt="crop-source"
            class="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
            :style="{
              transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${currentScale})`,
              transformOrigin: 'center center',
            }"
            @load="onImageLoad"
          />
        </template>

        <div
          v-else
          class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground"
        >
          <Upload class="h-8 w-8" />
          <p class="text-sm">点击此区域选择图片</p>
        </div>

        <div v-if="sourceUrl" class="pointer-events-none absolute inset-0">
          <div
            class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border border-white/80"
            :style="cropFrameStyle"
          />
        </div>

        <div
          class="absolute bottom-2 right-2 rounded bg-background/80 px-2 py-1 text-[11px] text-muted-foreground"
        >
          {{ zoom.toFixed(2) }}x ({{ preset.minZoom.toFixed(1) }}-{{ preset.maxZoom.toFixed(1) }})
        </div>
      </div>

      <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="onSelectFile" />

      <div class="mt-auto flex items-center justify-end gap-2">
        <Button variant="outline" :disabled="uploading" @click="closeEditor">取消</Button>
        <Button :disabled="!canConfirm" @click="handleConfirm">
          <Loader2 v-if="uploading" class="mr-2 h-4 w-4 animate-spin" />
          保存并上传
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-region-drag {
  -webkit-app-region: drag;
  user-select: none;
}

.app-region-no-drag {
  -webkit-app-region: no-drag;
}
</style>
