<script setup lang="ts">
import type { FunctionalComponent } from 'vue'
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  X,
  MessageSquare,
  UserPlus,
  Hash,
  MapPin,
  Info,
  Minus,
  Mars,
  Venus,
  VenusAndMars,
  Cake,
} from 'lucide-vue-next'

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePlatform } from '@/composables/usePlatform'
import { socialApi } from '@/api/social'
import type { FriendApplySource, UserInfo } from '@/api/types'

const props = defineProps<{ userId: string | undefined; source?: FriendApplySource }>()
const emits = defineEmits<{ (e: 'goToApply', source: FriendApplySource): void }>()

const { p, isElectron } = usePlatform()
const route = useRoute()

const userInfo = ref<UserInfo | null>(null)
const loading = ref(true)

const resolveSource = (raw?: string | null): FriendApplySource => {
  const normalized = raw?.trim().toUpperCase()
  if (normalized === 'QR' || normalized === 'GROUP' || normalized === 'SEARCH') {
    return normalized
  }
  return 'SEARCH'
}

const genderIconMap: Record<number, FunctionalComponent> = {
  1: Mars,
  2: Venus,
  0: VenusAndMars,
}

const genderIcon = computed(() => genderIconMap[userInfo.value?.gender || 0])

const handleClose = () => p.app.close()
const handleMinimize = () => p.app.minimize()

const loadData = async () => {
  loading.value = true
  const id = props.userId ?? (route.params.id as string)
  try {
    const res = await socialApi.getFriendInfo(id)
    userInfo.value = res.data
  } finally {
    loading.value = false
  }
}

const goToApply = () => {
  const source = resolveSource(props.source || (route.query.source as string))
  if (isElectron) {
    p.send('open-window', {
      type: 'FRIEND_APPLY',
      route: `/contacts/apply?id=${userInfo.value?.id}&nickname=${userInfo.value?.nickname}&avatar=${userInfo.value?.avatar || ''}&source=${source}`,
    })
  } else {
    emits('goToApply', source)
  }
}

onMounted(loadData)
</script>

<template>
  <div class="flex flex-col h-full bg-background border shadow-xl overflow-hidden select-none">
    <!-- 1. 顶部控制条 (解决拖拽与关闭) -->
    <div
      v-if="isElectron"
      class="h-10 flex items-center justify-between px-3 shrink-0 z-50 bg-transparent absolute top-0 w-full"
      :style="isElectron ? '-webkit-app-region: drag' : ''"
    >
      <div class="no-drag">
        <span class="text-[10px] font-bold opacity-40 ml-1 uppercase tracking-widest"
          >User Info</span
        >
      </div>
      <div class="flex items-center gap-1 no-drag" style="-webkit-app-region: no-drag">
        <Button variant="ghost" size="icon" class="h-7 w-7 hover:bg-muted" @click="handleMinimize">
          <Minus class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 hover:bg-destructive hover:text-white"
          @click="handleClose"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- 2. 背景图 -->
    <div class="h-32 bg-linear-to-r from-blue-600/20 via-indigo-500/20 to-purple-500/20 shrink-0">
      <div
        :style="{
          backgroundImage: userInfo?.backgroundUrl ? `url(${userInfo.backgroundUrl})` : 'none',
          backgroundColor: !userInfo?.backgroundUrl ? 'hsl(var(--primary) / 0.1)' : '',
        }"
      ></div>
    </div>

    <div class="px-6 pb-6 -mt-12 flex-1 flex flex-col min-h-0">
      <div class="flex justify-between items-end mb-4">
        <Avatar class="h-24 w-24 border-4 border-background shadow-lg">
          <AvatarImage :src="userInfo?.avatar || ''" />
          <AvatarFallback class="text-2xl">{{ userInfo?.nickname?.[0] }}</AvatarFallback>
        </Avatar>
        <Badge
          v-if="userInfo?.status === 1"
          class="mb-2 bg-green-500/10 text-green-600 hover:bg-green-500/10 border-none"
          >在线</Badge
        >
      </div>

      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <h2 class="text-2xl font-bold truncate">{{ userInfo?.nickname }}</h2>
          <span
            v-if="userInfo?.gender !== undefined"
            class="px-1.5 py-0.5 rounded-sm text-[10px] font-bold"
          >
            <component :is="genderIcon" class="h-5 w-5 text-foreground/50" />
          </span>
        </div>
        <p class="text-xs text-muted-foreground flex items-center gap-1">
          <Hash class="h-3 w-3" /> {{ userInfo?.username }}
        </p>
      </div>

      <div class="mt-6 space-y-4 flex-1">
        <div class="flex items-center gap-3 text-sm text-foreground/80">
          <Cake class="h-4 w-4 text-muted-foreground" />
          <span>{{ userInfo?.birthday || '未知生日' }}</span>
        </div>
        <div class="flex items-center gap-3 text-sm text-foreground/80">
          <MapPin class="h-4 w-4 text-muted-foreground" />
          <span>{{ userInfo?.region || '未知地区' }}</span>
        </div>
        <div class="flex items-start gap-3 text-sm text-foreground/80">
          <Info class="h-4 w-4 text-muted-foreground mt-0.5" />
          <p class="leading-relaxed">{{ userInfo?.signature || '这个家伙很懒，还没写签名。' }}</p>
        </div>
      </div>

      <!-- 4. 底部操作栏 -->
      <div
        class="grid gap-3 mt-auto pt-4 no-drag"
        :class="userInfo?.isFriend || userInfo?.isMe ? 'grid-cols-1' : 'grid-cols-2'"
        style="-webkit-app-region: no-drag"
      >
        <Button variant="outline" class="rounded-xl h-11 no-drag">
          <MessageSquare class="h-4 w-4 mr-2" /> 发消息
        </Button>
        <Button
          v-if="!userInfo?.isFriend && !userInfo?.isMe"
          class="rounded-xl h-11 no-drag"
          @click="goToApply"
        >
          <UserPlus class="h-4 w-4 mr-2" /> 加好友
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-drag {
  -webkit-app-region: no-drag !important;
}
</style>
