<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-vue-next'

interface Props {
  title: string
  icon?: LucideIcon
  showAction?: boolean
  actionText?: string
}

defineProps<Props>()
defineEmits(['action'])
</script>

<template>
  <div class="bg-card border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-bold flex items-center gap-2 text-foreground">
        <component :is="icon" v-if="icon" class="h-4 w-4 text-primary" />
        {{ title }}
      </h3>
      <Button v-if="showAction" variant="link" class="h-auto p-0 text-xs" @click="$emit('action')">
        {{ actionText || '查看全部' }}
      </Button>
    </div>
    <slot />
  </div>
</template>
