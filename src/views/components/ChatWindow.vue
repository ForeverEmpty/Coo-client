<script setup lang="ts">
import { ref, watch } from 'vue'
import { Send, Image, Smile, Paperclip, MoreHorizontal, MessageSquareDashed } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Resizer } from '@/components/common/resizer'

// 接收可能为空的 ID
const props = defineProps<{
  chatId: string | null
}>()

const footerHeight = ref(200)

// 模拟：监听 ID 变化加载数据
watch(
  () => props.chatId,
  (newId) => {
    if (newId) {
      console.log(`加载会话 ${newId} 的消息...`)
      // TODO: 调用后端 API 加载历史消息
    }
  },
)
</script>

<template>
  <div class="h-full w-full bg-background relative overflow-hidden">
    <Transition name="fade" mode="out-in">
      <!-- 状态 A: 有聊天对象 -> 显示聊天界面 -->
      <div v-if="chatId" key="chat" class="flex flex-col h-full min-w-0">
        <!-- 1. 顶部标题栏 -->
        <header
          class="h-16 border-b flex items-center px-6 justify-between flex-shrink-0 bg-background/80 backdrop-blur-md z-10"
        >
          <div>
            <div class="font-bold text-base">会话 {{ chatId }}</div>
            <div class="text-[10px] text-green-500 flex items-center gap-1">
              <span class="h-1.5 w-1.5 bg-green-500 rounded-full"></span> 在线
            </div>
          </div>
          <Button variant="ghost" size="icon" class="rounded-full"
            ><MoreHorizontal class="w-5 h-5"
          /></Button>
        </header>

        <!-- 2. 消息流 -->
        <ScrollArea class="flex-1 p-6">
          <div class="space-y-6">
            <!-- 模拟消息 -->
            <div class="flex gap-3 max-w-[80%]">
              <Avatar class="h-8 w-8 mt-1"
                ><AvatarImage src="https://github.com/shadcn.png"
              /></Avatar>
              <div>
                <div class="bg-muted px-4 py-2 rounded-2xl rounded-tl-none text-sm shadow-sm">
                  已切换到会话：{{ chatId }}
                </div>
                <span class="text-[10px] text-muted-foreground mt-1 ml-1">10:00</span>
              </div>
            </div>
          </div>
        </ScrollArea>

        <!-- 3. 拖拽调节条 -->
        <Resizer v-model="footerHeight" direction="vertical" side="top" :min="120" :max="500" />

        <!-- 4. 输入栏 -->
        <footer
          class="border-t bg-background flex flex-col shrink-0"
          :style="{ height: footerHeight + 'px' }"
        >
          <div class="flex items-center gap-1 px-2 pt-2">
            <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground"
              ><Smile class="h-5 w-5"
            /></Button>
            <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground"
              ><Image class="h-5 w-5"
            /></Button>
            <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground"
              ><Paperclip class="h-5 w-5"
            /></Button>
          </div>
          <div class="flex-1 flex gap-2 p-2 min-h-0">
            <Textarea
              placeholder="输入消息..."
              class="flex-1 bg-muted/30 border-none resize-none focus-visible:ring-0 text-sm leading-relaxed custom-scrollbar"
            />
            <div class="flex flex-col justify-end pb-1 pr-1">
              <Button
                size="icon"
                class="h-10 w-10 rounded-full shadow-md transition-transform active:scale-95"
              >
                <Send class="h-5 w-5" />
              </Button>
            </div>
          </div>
        </footer>
      </div>

      <!-- 状态 B: 无聊天对象 -> 显示空状态 -->
      <div
        v-else
        key="empty"
        class="h-full flex flex-col items-center justify-center text-muted-foreground/40 select-none bg-muted/5"
      >
        <div
          class="w-32 h-32 bg-muted/20 rounded-full flex items-center justify-center mb-6 animate-in fade-in zoom-in duration-500"
        >
          <MessageSquareDashed class="w-16 h-16 text-primary/30" />
        </div>
        <h3 class="text-xl font-bold text-foreground/80 mb-2 tracking-tight">Coo Chat</h3>
        <p class="text-sm">选择一个联系人，开始即时沟通</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 简单的淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: transparent;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.2);
  border-radius: 4px;
}
</style>
