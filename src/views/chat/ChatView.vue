<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { Resizer } from '@/components/common/resizer'
import ChatList from '@/components/ChatList.vue'
import ChatWindow from '@/components/ChatWindow.vue'
import { useRequestManager } from '@/composables/useRequestManager'

useRequestManager()

const selectedChatId = ref<number | null>(null)
const chatListWidth = ref(320)

const connectChat = () => {
  const token = localStorage.getItem('coo_token')
  if (!token) return

  // 通过网关连接，并携带 token 参数
  const socket = new WebSocket(`ws://localhost:8080/api/chat?token=${token}`)

  socket.onopen = () => {
    console.log('IM 系统连接成功')
    socket.send('Hello Coo!')
  }

  socket.onmessage = (e) => {
    console.log('收到服务器推送:', e.data)
  }

  socket.onclose = () => {
    console.log('连接已断开')
  }
}

onMounted(() => {
  connectChat()
})
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
