<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  ChevronLeft,
  Camera,
  MessageSquare,
  UserPlus,
  Settings2,
  Calendar,
  Hash,
  Info,
} from 'lucide-vue-next'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { authApi } from '@/api/auth'
import { fileApi } from '@/api/file'

import type { UserInfo } from '@/api/types'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const userInfo = ref<UserInfo | null>(null)

// 1. 判断是否为“自己”
const isSelf = computed(() => route.params.id === 'me' || userInfo.value?.isMe)

// 2. 返回逻辑
const handleBack = () => {
  // 如果有历史记录则返回，否则跳转到主页
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/chat')
  }
}

// 3. 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const id = route.params.id
    const res = id === 'me' ? await authApi.getMe() : await authApi.getUserById(id as string)
    userInfo.value = res.data
  } catch {
    toast.error('获取用户信息失败')
  } finally {
    loading.value = false
  }
}

// 4. 处理头像上传 (仅限自己)
const onAvatarClick = () => {
  if (!isSelf.value) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const loadingToast = toast.loading('正在上传新头像...')
    try {
      const uploadRes = await fileApi.upload(file)
      await authApi.updateAvatar(uploadRes.data)
      if (userInfo.value) userInfo.value.avatar = uploadRes.data
      toast.success('更新成功', { id: loadingToast })
    } catch {
      toast.error('上传失败', { id: loadingToast })
    }
  }
  input.click()
}

// 监听路由参数变化（比如从搜 A 换成搜 B）
watch(
  () => route.params.id,
  () => loadData(),
)
onMounted(() => loadData())
</script>

<template>
  <div class="flex flex-col h-full bg-background">
    <!-- 顶部导航栏 -->
    <header
      class="h-14 border-b flex items-center px-4 gap-4 shrink-0 bg-background/80 backdrop-blur-md z-10"
    >
      <Button variant="ghost" size="icon" @click="handleBack" class="rounded-full">
        <ChevronLeft class="h-5 w-5" />
      </Button>
      <span class="font-semibold text-lg">{{ isSelf ? '个人信息' : '详细资料' }}</span>
    </header>

    <!-- 内容滚动区 -->
    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <!-- 背景横幅 -->
      <div class="h-48 bg-linear-to-r from-blue-600 to-indigo-400 relative"></div>

      <!-- 核心信息卡片 -->
      <div class="max-w-3xl mx-auto px-6 -mt-12 relative pb-20">
        <div class="bg-card border rounded-3xl p-8 shadow-xl">
          <div class="flex flex-col md:flex-row gap-8 items-start">
            <!-- 头像区 -->
            <div class="relative group mx-auto md:mx-0">
              <Avatar
                class="h-32 w-32 border-4 border-background shadow-lg transition-transform group-hover:scale-105"
              >
                <AvatarImage :src="userInfo?.avatar" />
                <AvatarFallback class="text-3xl bg-primary text-primary-foreground">
                  {{ userInfo?.nickname?.[0] }}
                </AvatarFallback>
              </Avatar>
              <!-- 仅自己可见的相机图标 -->
              <div
                v-if="isSelf"
                @click="onAvatarClick"
                class="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
              >
                <Camera class="text-white h-8 w-8" />
              </div>
            </div>

            <!-- 文字信息区 -->
            <div class="flex-1 space-y-4 w-full text-center md:text-left">
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 class="text-3xl font-bold tracking-tight">{{ userInfo?.nickname }}</h1>
                  <p
                    class="text-muted-foreground flex items-center justify-center md:justify-start gap-1 mt-1"
                  >
                    <Hash class="h-4 w-4" /> {{ userInfo?.username }}
                  </p>
                </div>

                <!-- 交互按钮 -->
                <div class="flex gap-2 justify-center">
                  <template v-if="isSelf">
                    <Button variant="outline" class="rounded-xl gap-2">
                      <Settings2 class="h-4 w-4" /> 编辑资料
                    </Button>
                  </template>
                  <template v-else>
                    <Button class="rounded-xl gap-2 px-6">
                      <MessageSquare class="h-4 w-4" /> 发消息
                    </Button>
                    <Button variant="secondary" class="rounded-xl px-6">
                      <UserPlus class="h-4 w-4" /> 加好友
                    </Button>
                  </template>
                </div>
              </div>

              <Separator />

              <!-- 详细属性 -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div class="flex items-center gap-3">
                  <div class="p-2 bg-muted rounded-lg text-muted-foreground">
                    <Info class="h-4 w-4" />
                  </div>
                  <div class="text-left">
                    <p class="text-xs text-muted-foreground uppercase font-bold">个性签名</p>
                    <p class="text-sm font-medium">{{ userInfo?.signature || '未填写' }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <div class="p-2 bg-muted rounded-lg text-muted-foreground">
                    <Calendar class="h-4 w-4" />
                  </div>
                  <div class="text-left">
                    <p class="text-xs text-muted-foreground uppercase font-bold">加入 Coo</p>
                    <p class="text-sm font-medium">{{ userInfo?.createTime }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 额外区域：如果是好友，可以显示共同好友、相册等 -->
        <div v-if="!isSelf" class="mt-6 bg-card border rounded-3xl p-8 shadow-sm">
          <h3 class="font-bold mb-4">更多资料</h3>
          <p class="text-sm text-muted-foreground italic">该用户对非好友隐藏了更多信息...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 隐藏滚动条但保留功能 */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.2);
  border-radius: 10px;
}
</style>
