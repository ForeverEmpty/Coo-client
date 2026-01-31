<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ChatMainArea from './ChatMainArea.vue'
import GroupSidebar from './GroupSidebar.vue'
import EmptyState from './EmptyState.vue'

const props = defineProps<{ chatId: string | null }>()

// --- 模拟数据层 (后续替换为 useChatData Hook) ---
const isGroup = computed(() => props.chatId?.startsWith('group_'))

// 模拟消息数据
const messages = ref<any[]>([])
const groupInfo = ref({ notice: '', members: [] as any[] })

watch(
  () => props.chatId,
  (newId) => {
    if (!newId) return
    console.log('加载数据:', newId)

    // 模拟数据加载
    messages.value = [
      { id: 1, fromId: '1001', content: '这是一条测试消息', time: '14:00' },
      { id: 2, fromId: 'me', content: '收到！', time: '14:01' },
    ]

    if (isGroup.value) {
      groupInfo.value = {
        notice: '本群禁止发广告，违者踢出。',
        members: Array.from({ length: 20 }).map((_, i) => ({
          id: `${i}`,
          name: `成员 ${i}`,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
          role: i === 0 ? 'owner' : 'member',
        })),
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="h-full w-full bg-background relative overflow-hidden flex items-center justify-center"
  >
    <Transition name="fade" mode="out-in">
      <!-- 1. 聊天界面 (容器) -->
      <div v-if="chatId" key="chat" class="flex w-full h-full">
        <!-- 左侧: 通用聊天区 -->
        <ChatMainArea
          :title="isGroup ? 'Coo Chat 开发组' : '好友张三'"
          :sub-title="isGroup ? `${groupInfo.members.length} 人在线` : '在线'"
          :messages="messages"
          :is-group="isGroup"
        />

        <!-- 右侧: 仅群聊显示的侧边栏 -->
        <GroupSidebar v-if="isGroup" :notice="groupInfo.notice" :members="groupInfo.members" />
      </div>

      <!-- 2. 空状态 -->
      <EmptyState v-else key="empty" />
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
