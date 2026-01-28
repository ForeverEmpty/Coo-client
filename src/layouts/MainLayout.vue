<script setup lang="ts">
import { Minus, Square, X } from 'lucide-vue-next'
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'

import { Button } from '@/components/ui/button'
import { usePlatform } from '@/composables/usePlatform'
import Sidebar from '@/components/Sidebar.vue'

const { p, isElectron } = usePlatform()

const ImLayout = defineAsyncComponent(() => import('@/layouts/fragments/ImLayout.vue'))
const FullPageLayout = defineAsyncComponent(() => import('@/layouts/fragments/FullPageLayout.vue'))

const route = useRoute()

const activeLayout = computed(() => {
  return route.meta.layout === 'im' ? ImLayout : FullPageLayout
})

const handleMinimize = () => p.app?.minimize()
const handleMaximize = () => p.app?.maximize()
const handleClose = () => p.app?.close()
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden bg-background">
    <Sidebar />

    <div class="flex-1 flex flex-col min-w-0 relative">
      <header
        v-if="isElectron"
        class="h-8 w-full flex items-center justify-end bg-transparent shrink-0 border-b relative z-50"
        style="-webkit-app-region: drag"
      >
        <div class="flex items-center h-full" style="-webkit-app-region: no-drag">
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-10 rounded-none hover:bg-muted transition-colors"
            @click="handleMinimize"
          >
            <Minus class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-10 rounded-none hover:bg-muted transition-colors"
            @click="handleMaximize"
          >
            <Square class="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-10 rounded-none hover:bg-destructive hover:text-white transition-colors"
            @click="handleClose"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main class="flex-1 overflow-hidden relative">
        <component :is="activeLayout" />
      </main>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
