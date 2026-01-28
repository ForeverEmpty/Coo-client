<script setup lang="ts">
import { Lock } from 'lucide-vue-next'
import type { LucideIcon } from 'lucide-vue-next'

interface Props {
  icon: LucideIcon
  label: string
  value?: string | null
  isSelf?: boolean
  placeholder?: string
}

defineProps<Props>()
</script>

<template>
  <div class="flex items-center gap-3 group/item">
    <div class="p-2 bg-muted rounded-lg shrink-0 transition-colors group-hover/item:bg-primary/10">
      <component
        :is="icon"
        class="h-4 w-4 text-muted-foreground group-hover/item:text-primary transition-colors"
      />
    </div>
    <div class="text-left overflow-hidden">
      <p class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
        {{ label }}
      </p>

      <p v-if="value" class="text-sm font-medium mt-0.5 truncate text-foreground">
        {{ value }}
      </p>

      <p v-else class="text-sm text-muted-foreground/50 italic mt-0.5 flex items-center gap-1">
        <Lock v-if="!isSelf" class="h-3 w-3" />
        {{ !isSelf ? placeholder || '已隐藏' : '未设置' }}
      </p>
    </div>
  </div>
</template>
