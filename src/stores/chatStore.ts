import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useChatStore = defineStore('chat', () => {
  const activeChatId = ref<string | null>(null)

  const setActiveChat = (id: string) => {
    activeChatId.value = id
  }

  return { activeChatId, setActiveChat }
})
