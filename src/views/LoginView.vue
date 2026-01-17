<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Minus, MessageCircle } from 'lucide-vue-next'

// 关键修复：不要直接用 window.electronAPI 判断，可能存在加载时序问题
const isElectron = ref(false)

onMounted(() => {
  // 检查全局变量是否存在
  if (window.electronAPI) {
    isElectron.value = true
    console.log('Electron 环境已确认')
  }
})

const handleMinimize = () => window.electronAPI?.send('window-minimize')
const handleClose = () => window.electronAPI?.send('window-close')
</script>

<template>
  <div class="flex h-screen w-full items-center justify-center bg-transparent sm:bg-slate-50">
    <Card
      class="relative w-95 h-130 shadow-2xl border-none flex flex-col overflow-hidden bg-background"
    >
      <!--拖动区-->
      <div class="absolute top-0 left-0 w-full h-24 z-0" style="-webkit-app-region: drag"></div>

      <div v-if="isElectron" class="absolute top-2 right-2 flex gap-1 z-50">
        <Button variant="ghost" size="icon" class="h-8 w-8 hover:bg-muted" @click="handleMinimize">
          <Minus class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 hover:bg-destructive hover:text-white"
          @click="handleClose"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>

      <CardHeader class="text-center pt-10">
        <div class="flex justify-center mb-4">
          <div class="rounded-2xl bg-primary p-3 shadow-lg shadow-primary/20">
            <MessageCircle class="h-8 w-8 text-primary-foreground" />
          </div>
        </div>
        <CardTitle class="text-2xl font-bold">Coo Chat</CardTitle>
        <CardDescription>每一条消息，都有它的温度</CardDescription>
      </CardHeader>

      <CardContent class="grid gap-4 flex-1">
        <div class="space-y-2">
          <Input type="text" placeholder="账号" class="h-11" />
        </div>
        <div class="space-y-2">
          <Input type="password" placeholder="密码" class="h-11" />
        </div>
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" class="rounded border-gray-300" /> 记住密码
          </label>
          <a href="#" class="hover:text-primary">忘记密码？</a>
        </div>
      </CardContent>

      <CardFooter class="pb-8 flex flex-col gap-4">
        <Button class="w-full h-11 text-base font-bold shadow-lg shadow-primary/20 cursor-pointer">
          登 录
        </Button>
        <p class="text-sm text-center text-muted-foreground">
          还没有账号? <a href="#" class="text-primary font-semibold hover:underline">立即注册</a>
        </p>
      </CardFooter>
    </Card>
  </div>
</template>

<style>
/* 关键：去掉 body 默认背景，否则 Electron 的 transparent 不生效 */
html,
body {
  background: transparent !important;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

/* 按钮内部禁止拖拽，否则无法点击 */
button,
input,
a {
  -webkit-app-region: no-drag;
}
</style>
