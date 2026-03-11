<script setup lang="ts">
defineProps<{
  visible: boolean
  text: string
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    v-if="visible"
    class="absolute right-4 bottom-4 z-20 rounded-full bg-primary text-primary-foreground shadow-md px-3 py-1.5 text-xs hover:bg-primary/90 transition-colors"
    @click="emit('click')"
  >
    {{ text }} 条新消息
  </button>
</template>
