<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Search } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { contactTab } from '@/config/contact'
import { usePlatform } from '@/composables/usePlatform'

const router = useRouter()
const { p, isElectron } = usePlatform()

// 当前选中的 Tab：默认 'friends'
const currentTab = ref<(typeof contactTab)[number]['id']>('friends')

const handleAddClick = () => {
  if (isElectron) {
    p.send('open-search-window')
  } else {
    router.push('/contacts/add')
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-background/50 border-r">
    <!-- 1. 顶部搜索与 Tab 切换区 -->
    <div class="p-3 pb-2 space-y-3">
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索联系人..." class="pl-9 h-9 bg-muted/50 border-none no-drag" />
        </div>

        <Button
          variant="ghost"
          size="icon"
          class="h-9 w-9 bg-muted/50 hover:bg-primary/10 hover:text-primary no-drag shrink-0"
          @click="handleAddClick"
        >
          <Plus class="h-5 w-5" />
        </Button>
      </div>
      <!-- 搜索框 -->

      <!-- 分段控制器 (Tab Switcher) -->
      <div class="grid grid-cols-3 p-1 bg-muted/50 rounded-lg select-none">
        <div
          v-for="tab in contactTab"
          :key="tab.id"
          @click="currentTab = tab.id"
          :class="
            cn(
              'flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all',
              currentTab === tab.id
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )
          "
        >
          <component :is="tab.icon" class="w-3.5 h-3.5" /> {{ tab.label }}
        </div>
      </div>
    </div>

    <!-- 2. 列表内容区 -->
    <ScrollArea class="flex-1 px-1">
      <Transition name="fade" mode="out-in">
        <!-- 核心：根据映射动态渲染组件 -->
        <component :is="contactTab.find((tab) => tab.id === currentTab)?.component" />
      </Transition>
    </ScrollArea>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
