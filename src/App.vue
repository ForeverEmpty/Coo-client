<script setup lang="ts">
import { Toaster } from './components/ui/sonner'
import { useRequestManager } from './composables/useRequestManager'

useRequestManager()
</script>

<template>
  <Toaster position="top-center" richColors />
  <RouterView />
</template>

<style scoped></style>
