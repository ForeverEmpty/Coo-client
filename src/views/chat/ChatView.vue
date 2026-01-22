<script setup lang="ts">
import { ref } from 'vue'

import { Resizer } from '@/components/common/resizer'
import ChatList from '@/components/ChatList.vue'
import ChatWindow from '@/components/ChatWindow.vue'

const selectedChatId = ref<number | null>(null)
const chatListWidth = ref(320)
</script>

<template>
  <div class="flex w-full h-full">
    <ChatList :style="{ width: chatListWidth + 'px' }" />

    <Resizer
      v-model="chatListWidth"
      direction="horizontal"
      side="right"
      :min="250"
      :max="600"
      :trim="false"
      class="w-1"
    />

    <ChatWindow :chat-id="selectedChatId" />
  </div>
</template>
