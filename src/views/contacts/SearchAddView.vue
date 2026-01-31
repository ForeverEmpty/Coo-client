<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Search, X, UserPlus, Users, Minus, ArrowLeft, Loader2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { usePlatform } from '@/composables/usePlatform'
import { socialApi } from '@/api/social' // 确保你之前封装了该 API
import { cn } from '@/lib/utils'
import type { UserSimple } from '@/api/types'

const { p, isElectron } = usePlatform()
const router = useRouter()

// --- 搜索状态 ---
const keyword = ref('')
const activeTab = ref('user')
const results = ref<UserSimple[]>([])
const loading = ref(false)
const isFirstSearch = ref(true) // 是否尚未进行过搜索

// --- 分页状态 ---
const pageNum = ref(1)
const pageSize = ref(15)
const hasMore = ref(false)
const loadMoreTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const handleClose = () => {
  if (isElectron) p.app.close()
  else router.back()
}

const handleMinimize = () => p.app.minimize()

// --- 核心搜索逻辑 ---
const doSearch = async (isNewSearch = true) => {
  if (!keyword.value.trim()) return

  if (isNewSearch) {
    pageNum.value = 1
    results.value = []
    isFirstSearch.value = false
  }

  loading.value = true
  try {
    // 调用之前定义的 ES 全局搜索接口
    const res = await socialApi.searchGlobal(keyword.value, pageNum.value, pageSize.value)
    const data = res.data

    if (isNewSearch) {
      results.value = data.list
    } else {
      results.value = [...results.value, ...data.list]
    }

    hasMore.value = data.hasMore
  } catch (error) {
    console.error('搜索失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载下一页
const loadNextPage = () => {
  if (loading.value || !hasMore.value) return
  pageNum.value++
  doSearch(false)
}

// --- 自动触发加载逻辑 ---
onMounted(() => {
  // 创建交叉观察者：当触发器出现在屏幕底部时加载更多
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore.value && !loading.value) {
        loadNextPage()
      }
    },
    { threshold: 0.5 },
  )

  if (loadMoreTrigger.value) {
    observer.observe(loadMoreTrigger.value)
  }
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})

const handleAddFriend = (user: UserSimple) => {
  // TODO: 实现申请好友弹窗逻辑
  console.log('申请添加好友:', user.id)
}
</script>

<template>
  <div
    :class="
      cn(
        'flex h-full w-full flex-col bg-background select-none',
        !isElectron && 'items-center justify-center bg-muted/20 p-4',
      )
    "
  >
    <div
      :class="
        cn(
          'flex flex-col w-full bg-background overflow-hidden transition-all',
          isElectron ? 'h-full' : 'max-w-2xl h-150 rounded-xl border shadow-sm',
        )
      "
    >
      <!-- 1. 标题栏 -->
      <div
        class="h-12 flex items-center justify-between px-4 border-b shrink-0 bg-background z-50 relative"
        :style="isElectron ? '-webkit-app-region: drag' : ''"
      >
        <div class="font-bold text-base flex items-center gap-2">
          <Button
            v-if="!isElectron"
            variant="ghost"
            size="icon"
            class="h-8 w-8 -ml-2"
            @click="handleClose"
          >
            <ArrowLeft class="h-4 w-4" />
          </Button>
          添加好友/群组
        </div>
        <div class="flex items-center gap-1" style="-webkit-app-region: no-drag">
          <template v-if="isElectron">
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 hover:bg-muted"
              @click="handleMinimize"
            >
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
          </template>
        </div>
      </div>

      <!-- 2. 内容区域 -->
      <div class="flex-1 flex flex-col min-h-0 bg-background">
        <!-- 搜索框固定在上方 -->
        <div class="p-6 pb-2 shrink-0">
          <Tabs v-model="activeTab" class="w-full flex flex-col">
            <div class="flex justify-center mb-6">
              <TabsList class="grid w-full grid-cols-2">
                <TabsTrigger value="user">找人</TabsTrigger>
                <TabsTrigger value="group">找群</TabsTrigger>
              </TabsList>
            </div>

            <div class="flex justify-center">
              <div class="flex gap-3 w-full">
                <div class="relative flex-1">
                  <Search class="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    v-model="keyword"
                    placeholder="请输入账号/昵称"
                    class="pl-9 h-10 no-drag focus-visible:ring-1"
                    @keyup.enter="doSearch(true)"
                  />
                </div>
                <Button @click="doSearch(true)" class="no-drag w-24" :disabled="loading">
                  <Loader2 v-if="loading && isFirstSearch" class="mr-2 h-4 w-4 animate-spin" />
                  搜索
                </Button>
              </div>
            </div>
          </Tabs>
        </div>

        <!-- 3. 结果滚动区 -->
        <div class="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2">
          <!-- 初始状态 -->
          <div
            v-if="isFirstSearch"
            class="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm border-2 border-dashed rounded-xl bg-muted/20"
          >
            <div class="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <UserPlus v-if="activeTab === 'user'" class="h-8 w-8 opacity-50" />
              <Users v-else class="h-8 w-8 opacity-50" />
            </div>
            <p>
              {{
                activeTab === 'user'
                  ? '输入关键词，寻找志同道合的好友'
                  : '输入群号或关键词，加入感兴趣的群聊'
              }}
            </p>
          </div>

          <!-- 搜索结果列表 -->
          <div v-else-if="results.length > 0" class="space-y-3 mx-auto">
            <div
              v-for="user in results"
              :key="user.id"
              class="flex items-center justify-between p-3 rounded-xl border bg-card hover:border-primary/50 transition-all group"
            >
              <div class="flex items-center gap-3">
                <Avatar class="h-11 w-11 border">
                  <AvatarImage :src="user.avatar || ''" />
                  <AvatarFallback class="bg-primary/10 text-primary">{{
                    user.nickname[0]
                  }}</AvatarFallback>
                </Avatar>
                <div class="min-w-0">
                  <div class="font-bold text-sm flex items-center gap-2">
                    <span class="truncate">{{ user.nickname }}</span>
                  </div>
                  <div class="text-[11px] text-muted-foreground font-mono">ID: {{ user.id }}</div>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                class="h-8 rounded-lg transition-all active:scale-95"
                @click="handleAddFriend(user)"
              >
                <UserPlus class="h-3.5 w-3.5 mr-1.5" /> 加好友
              </Button>
            </div>

            <!-- 滚动加载触发器 -->
            <div ref="loadMoreTrigger" class="py-4 flex justify-center">
              <div v-if="loading" class="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 class="h-3 w-3 animate-spin" /> 加载更多...
              </div>
              <div
                v-else-if="!hasMore"
                class="text-[10px] text-muted-foreground opacity-50 uppercase tracking-widest"
              >
                已显示全部结果
              </div>
            </div>
          </div>

          <!-- 无结果状态 -->
          <div
            v-else-if="!loading"
            class="flex flex-col items-center justify-center h-64 text-muted-foreground"
          >
            <Search class="h-10 w-10 mb-2 opacity-20" />
            <p class="text-sm">未找到匹配的结果</p>
          </div>
        </div>
      </div>
    </div>
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

/* 简单的进入动画 */
.group {
  animation: slideUp 0.3s ease-out forwards;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
