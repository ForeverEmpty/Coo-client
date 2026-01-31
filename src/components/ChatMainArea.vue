<script setup lang="ts">
import { ref } from 'vue'
import { MoreHorizontal, Smile, Image, Paperclip, Send } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Resizer } from '@/components/common/resizer'

// Props 定义
defineProps<{
  title: string
  subTitle: string // "在线" 或 "20人在线"
  messages: any[]
  isGroup?: boolean // 用于判断是否显示发送者昵称
}>()

const footerHeight = ref(200)
const myAvatar = 'https://github.com/shadcn.png' // 实际应从 Store 获取
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0 h-full">
    <!-- 1. 头部 -->
    <header
      class="h-16 border-b flex items-center px-6 justify-between shrink-0 bg-background/80 backdrop-blur-md z-10"
    >
      <div>
        <div class="font-bold text-base flex items-center gap-2">
          {{ title }}
          <span v-if="isGroup" class="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded"
            >群聊</span
          >
        </div>
        <div class="text-[10px] text-muted-foreground flex items-center gap-1">
          <span v-if="!isGroup" class="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
          {{ subTitle }}
        </div>
      </div>
      <Button variant="ghost" size="icon" class="rounded-full"
        ><MoreHorizontal class="w-5 h-5"
      /></Button>
    </header>

    <!-- 2. 消息列表 -->
    <ScrollArea class="flex-1 px-6 pt-6 min-h-0">
      <div class="space-y-6">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="flex gap-3 max-w-[85%]"
          :class="msg.fromId === 'me' ? 'ml-auto flex-row-reverse' : ''"
        >
          <!-- 头像 -->
          <Avatar class="h-9 w-9 mt-1 shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
            <AvatarImage
              :src="
                msg.fromId === 'me'
                  ? myAvatar
                  : 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'
              "
            />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>

          <!-- 内容 -->
          <div :class="msg.fromId === 'me' ? 'items-end' : 'items-start'" class="flex flex-col">
            <!-- 群聊显示昵称 -->
            <span
              v-if="isGroup && msg.fromId !== 'me'"
              class="text-[10px] text-muted-foreground mb-1 ml-1"
            >
              成员 {{ msg.fromId }}
            </span>

            <!-- 气泡 -->
            <div
              class="px-4 py-2.5 text-sm shadow-sm leading-relaxed break-all"
              :class="
                msg.fromId === 'me'
                  ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-none'
                  : 'bg-muted/80 text-foreground rounded-2xl rounded-tl-none'
              "
            >
              {{ msg.content }}
            </div>
            <span class="text-[10px] text-muted-foreground mt-1 mx-1">{{ msg.time }}</span>
          </div>
        </div>
      </div>
    </ScrollArea>

    <!-- 3. 底部输入区 -->
    <Resizer v-model="footerHeight" direction="vertical" side="top" :min="120" :max="500" />

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
          class="flex-1 bg-muted/30 border-none resize-none focus-visible:ring-0 text-sm custom-scrollbar"
        />
        <div class="flex flex-col justify-end pb-1 pr-1">
          <Button size="icon" class="h-10 w-10 rounded-full shadow-md"
            ><Send class="h-5 w-5"
          /></Button>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
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
