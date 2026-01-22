<script setup lang="ts">
import { ref } from 'vue'
import { Send, Image, Smile, Paperclip, MoreHorizontal } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Resizer } from '@/components/common/resizer'

const footerHeight = ref(200)
</script>

<template>
  <div class="flex flex-col h-full flex-1">
    <!-- 顶部标题栏 -->
    <header
      class="h-16 border-b flex items-center px-6 justify-between bg-background/50 backdrop-blur-md"
    >
      <div>
        <div class="font-bold">好友 1</div>
        <div class="text-[10px] text-green-500 flex items-center gap-1">
          <span class="h-1.5 w-1.5 bg-green-500 rounded-full"></span> 在线
        </div>
      </div>
      <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
    </header>

    <!-- 消息流 -->
    <ScrollArea class="flex-1 p-6">
      <div class="space-y-6">
        <!-- 接收到的消息 -->
        <div class="flex gap-3 max-w-[80%]">
          <Avatar class="h-8 w-8 mt-1"><AvatarImage src="https://github.com/shadcn.png" /></Avatar>
          <div>
            <div class="bg-muted px-4 py-2 rounded-2xl rounded-tl-none text-sm shadow-sm">
              嗨！Coo Chat 的界面看起来非常酷！🚀
            </div>
            <span class="text-[10px] text-muted-foreground mt-1 ml-1">14:21</span>
          </div>
        </div>

        <!-- 发送的消息 -->
        <div class="flex gap-3 flex-row-reverse">
          <div class="flex flex-col items-end">
            <div
              class="bg-primary text-primary-foreground px-4 py-2 rounded-2xl rounded-tr-none text-sm shadow-md"
            >
              谢谢！这是使用 Vue 3 + Tailwind CSS 构建的。
            </div>
            <span class="text-[10px] text-muted-foreground mt-1 mr-1">14:22</span>
          </div>
        </div>
      </div>
    </ScrollArea>

    <Resizer v-model="footerHeight" direction="vertical" side="top" :min="120" :max="450" />

    <!-- 输入栏 -->
    <footer
      class="p-2 border-t bg-background flex flex-col overflow-hidden"
      :style="{ height: `${footerHeight}px`, maxHeight: `${footerHeight}px` }"
    >
      <div class="flex items-center gap-2 mb-2">
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

      <div class="flex gap-2 mb-2 flex-1">
        <Textarea
          placeholder="输入消息..."
          class="flex-1 bg-muted/50 border-none h-full max-h-full resize-none"
        />
        <Button size="icon" class="h-11 w-11 rounded-full shadow-lg self-center"
          ><Send class="h-5 w-5"
        /></Button>
      </div>
    </footer>
  </div>
</template>
