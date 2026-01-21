<script setup lang="ts">
import { Minus, X } from 'lucide-vue-next'
import { useRoute } from 'vue-router'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePlatform } from '@/composables/usePlatform'

const route = useRoute()
const { p, isElectron } = usePlatform()

const handleMinimize = () => p.app?.minimize()
const handleClose = () => p.app?.close()
</script>

<template>
  <div
    class="flex h-screen w-full items-center justify-center bg-transparent sm:bg-slate-50 select-none"
  >
    <Card
      class="relative w-95 h-130 border-none flex flex-col overflow-hidden bg-background transition-all duration-150 ease-in"
      :class="{ 'shadow-2xl': !isElectron, 'h-145': route.name === 'Register' }"
    >
      <div
        v-if="isElectron"
        class="absolute top-0 left-0 w-full h-24 z-0"
        style="-webkit-app-region: drag"
      ></div>

      <div v-if="isElectron" class="absolute top-2 right-2 flex gap-1 z-50">
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 hover:bg-muted no-drag"
          @click="handleMinimize"
        >
          <Minus class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 hover:bg-destructive hover:text-white no-drag"
          @click="handleClose"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>

      <div class="relative z-10 flex flex-col h-full">
        <RouterView v-slot="{ Component }">
          <Transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.no-drag {
  -webkit-app-region: no-drag;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
