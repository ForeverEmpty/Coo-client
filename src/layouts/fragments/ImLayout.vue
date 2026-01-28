<script setup lang="ts">
import { ref } from 'vue'
import { useChatStore } from '@/stores/chatStore'
import { Resizer } from '@/components/common/resizer'
import ChatWindow from '@/views/components/ChatWindow.vue'

const chatStore = useChatStore()
const listWidth = ref(320)
</script>

<template>
  <div class="flex-1 flex overflow-hidden relative h-full">
    <!-- 1. 中间列表区 -->
    <section
      :style="{ width: listWidth + 'px' }"
      class="shrink-0 flex flex-col h-full border-r z-40 bg-background/50 backdrop-blur-sm relative"
    >
      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </section>

    <!-- 2. 拖拽条 -->
    <Resizer
      v-model="listWidth"
      direction="horizontal"
      side="right"
      :min="260"
      :max="450"
      :trim="false"
    />

    <!-- 3. 右侧持久化聊天窗口 -->
    <main class="flex-1 min-w-0 bg-background relative z-0">
      <ChatWindow :chat-id="chatStore.activeChatId" />
    </main>
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
