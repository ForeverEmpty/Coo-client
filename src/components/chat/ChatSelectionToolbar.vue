<script setup lang="ts">
import { Button } from '@/components/ui/button'

defineProps<{
  selectedCount: number
}>()

const emit = defineEmits<{
  batchForward: []
  batchDelete: []
  cancel: []
}>()
</script>

<template>
  <div class="flex items-center justify-between border-b px-3 py-2 bg-muted/20">
    <span class="text-xs text-muted-foreground">已选择 {{ selectedCount }} 条消息</span>
    <div class="flex items-center gap-2">
      <Button size="sm" variant="outline" :disabled="selectedCount === 0" @click="emit('batchForward')">
        批量转发
      </Button>
      <Button
        size="sm"
        variant="destructive"
        :disabled="selectedCount === 0"
        @click="emit('batchDelete')"
      >
        批量删除
      </Button>
      <Button size="sm" variant="ghost" @click="emit('cancel')">取消选择</Button>
    </div>
  </div>
</template>
