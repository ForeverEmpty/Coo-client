<script setup lang="ts">
import { MoreHorizontal } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

defineProps<{
  title: string
  subTitle: string
  isGroup?: boolean
}>()

const emit = defineEmits<{
  openSidebar: []
  openDetail: []
}>()
</script>

<template>
  <header
    class="h-16 border-b flex items-center px-6 justify-between shrink-0 bg-background/80 backdrop-blur-md z-10"
  >
    <button
      type="button"
      class="text-left"
      @click="emit('openDetail')"
    >
      <div class="font-bold text-base flex items-center gap-2 hover:text-primary transition-colors">
        <span class="max-w-[360px] truncate">{{ title }}</span>
        <span v-if="isGroup" class="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
          Group
        </span>
      </div>
      <div class="text-[10px] text-muted-foreground flex items-center gap-1">
        <span v-if="!isGroup" class="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
        {{ subTitle }}
      </div>
    </button>
    <Button variant="ghost" size="icon" class="rounded-full" @click="emit('openSidebar')">
      <MoreHorizontal class="w-5 h-5" />
    </Button>
  </header>
</template>
