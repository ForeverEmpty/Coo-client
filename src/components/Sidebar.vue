<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { sidebarMenuItems, sidebarBottomItems } from '@/config/menu'

const route = useRoute()
const router = useRouter()

const activePath = computed(() => route.path)

const navigate = (path: string) => {
  router.push(path)
}

const handleUserClick = () => {
  navigate('/profile/me')
}
</script>

<template>
  <aside class="w-18 flex flex-col items-center py-4 border-r bg-muted/20 h-full select-none">
    <div class="mb-6 mt-4 no-drag">
      <TooltipProvider>
        <Tooltip :delay-duration="0">
          <TooltipTrigger as-child>
            <div
              class="cursor-pointer hover:opacity-80 transition-all active:scale-95"
              @click="handleUserClick"
            >
              <Avatar class="h-10 w-10 border-2 border-primary/10">
                <AvatarImage src="https://github.com/shadcn.png" alt="Avatar" />
                <AvatarFallback>Coo</AvatarFallback>
              </Avatar>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">个人信息</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <Separator class="w-10 mb-6 opacity-50" />

    <nav class="flex-1 w-full px-2 space-y-4 no-drag">
      <TooltipProvider v-for="item in sidebarMenuItems" :key="item.id">
        <Tooltip :delay-duration="0">
          <TooltipTrigger as-child>
            <div class="relative">
              <Button
                variant="ghost"
                size="icon"
                class="w-full h-12 rounded-xl transition-all duration-200"
                :class="[
                  activePath.startsWith(item.path)
                    ? 'bg-primary text-primary-foreground shadow-lg hover:bg-primary hover:text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                ]"
                @click="navigate(item.path)"
              >
                <component :is="item.icon" class="h-6 w-6" />
              </Button>

              <div
                v-if="item.badge"
                class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white border-2 border-background"
              >
                {{ item.badge > 99 ? '99+' : item.badge }}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">{{ item.label }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </nav>

    <div class="mt-auto px-2 space-y-4 w-full no-drag">
      <TooltipProvider v-for="item in sidebarBottomItems" :key="item.id">
        <Tooltip :delay-duration="0">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="w-full h-10 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
              :class="{ 'bg-muted text-foreground': activePath.startsWith(item.path) }"
              @click="navigate(item.path)"
            >
              <component :is="item.icon" class="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{{ item.label }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </aside>
</template>

<style scoped>
.no-drag {
  -webkit-app-region: no-drag;
}
</style>
