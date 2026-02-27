<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { AlertTriangle, X } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { usePlatform } from '@/composables/usePlatform'

interface ConfirmDialogPayload {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

const route = useRoute()
const { p } = usePlatform()

const scene = computed(() => {
  const raw = route.query.scene
  return typeof raw === 'string' ? raw : ''
})

const dialogId = computed(() => {
  const raw = route.query.dialogId
  return typeof raw === 'string' ? raw : ''
})

const payload = computed<ConfirmDialogPayload>(() => {
  const fallback: ConfirmDialogPayload = {
    title: 'Confirm Action',
    description: 'Please confirm this action.',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
  }

  const rawPayload = route.query.payload
  if (typeof rawPayload !== 'string' || !rawPayload) {
    return fallback
  }

  try {
    return { ...fallback, ...JSON.parse(rawPayload) }
  } catch {
    try {
      return { ...fallback, ...JSON.parse(decodeURIComponent(rawPayload)) }
    } catch {
      return fallback
    }
  }
})

const resolve = (result: boolean) => {
  if (dialogId.value) {
    p.send('dialog:resolve', {
      dialogId: dialogId.value,
      result,
    })
    return
  }
  p.app.close()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    resolve(false)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden border bg-background select-none">
    <div
      class="flex h-10 shrink-0 items-center justify-between border-b px-4"
      style="-webkit-app-region: drag"
    >
      <span class="text-xs font-bold text-muted-foreground">{{ payload.title }}</span>
      <Button variant="ghost" size="icon" class="no-drag h-6 w-6" @click="resolve(false)">
        <X class="h-4 w-4" />
      </Button>
    </div>

    <template v-if="scene === 'confirm'">
      <div class="flex flex-1 flex-col justify-between gap-6 p-6">
        <div class="space-y-3">
          <div class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted/60">
            <AlertTriangle class="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 class="text-lg font-semibold">{{ payload.title }}</h2>
          <p class="text-sm leading-6 text-muted-foreground">
            {{ payload.description }}
          </p>
        </div>

        <div class="flex items-center justify-end gap-2">
          <Button variant="outline" @click="resolve(false)">
            {{ payload.cancelText || 'Cancel' }}
          </Button>
          <Button
            :variant="payload.variant === 'destructive' ? 'destructive' : 'default'"
            @click="resolve(true)"
          >
            {{ payload.confirmText || 'Confirm' }}
          </Button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
        <p class="text-sm font-medium">Unsupported dialog scene</p>
        <Button variant="outline" @click="resolve(false)">Close</Button>
      </div>
    </template>
  </div>
</template>
