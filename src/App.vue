<script setup lang="ts">
import { Toaster } from './components/ui/sonner'
import { useChatEventBridge } from './composables/useChatEventBridge'
import { useChatSessionConfigSync } from './composables/useChatSessionConfigSync'
import { useRequestManager } from './composables/useRequestManager'
import { useWebSocketManager } from './composables/useWebSocketManager'

useRequestManager()
useWebSocketManager()
useChatEventBridge()
useChatSessionConfigSync()
</script>

<template>
  <Toaster position="top-center" richColors />
  <RouterView />
</template>

<style scoped></style>
