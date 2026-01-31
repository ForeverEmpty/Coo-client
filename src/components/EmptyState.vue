<script setup lang="ts">
import { MessageSquareDashed } from 'lucide-vue-next'
</script>

<template>
  <div
    class="h-full flex flex-col items-center justify-center text-muted-foreground/40 select-none bg-muted/5"
  >
    <div
      class="w-32 h-32 bg-muted/20 rounded-full flex items-center justify-center mb-6 animate-in fade-in zoom-in duration-500"
    >
      <MessageSquareDashed class="w-16 h-16 text-primary/30" />
    </div>
    <h3 class="text-xl font-bold text-foreground/80 mb-2 tracking-tight">Coo Chat</h3>
    <p class="text-sm">选择一个联系人，开始即时沟通</p>
  </div>
</template>
