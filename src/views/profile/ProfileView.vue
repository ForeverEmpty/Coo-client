<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { FunctionalComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  ChevronLeft,
  Camera,
  MessageSquare,
  Settings2,
  Calendar,
  Hash,
  Info,
  UserPlus,
  Cake,
  MapPin,
  Briefcase,
  Venus,
  Mars,
  VenusAndMars,
  ShieldCheck,
  Image as ImageIcon,
  Users,
} from 'lucide-vue-next'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

import InfoItem from '@/components/InfoItem.vue'
import ProfileSection from '@/components/ProfileSection.vue'
import EditProfileDialog from '@/components/EditProfileDialog.vue'
import PrivacyDialog from '@/components/PrivacyDialog.vue'

import { authApi } from '@/api/auth'
import { fileApi } from '@/api/file'
import type { UserInfo } from '@/api/types'
import { calculateAge } from '@/utils/calculateAge'
import { useRequestManager } from '@/composables/useRequestManager'

const route = useRoute()
const router = useRouter()
useRequestManager()

const loading = ref(true)
const userInfo = ref<UserInfo | null>(null)
const showEditProfileDialog = ref(false)
const showPrivacyDialog = ref(false)

const genderIconMap: Record<number, FunctionalComponent> = {
  1: Mars,
  2: Venus,
  0: VenusAndMars,
}

const isSelf = computed(() => route.params.id === 'me' || userInfo.value?.isMe)
const age = computed(() => calculateAge(userInfo.value?.birthday))
const genderIcon = computed(() => genderIconMap[userInfo.value?.gender || 0])

const handleBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/chat')
}

const loadData = async () => {
  loading.value = true
  try {
    const id = route.params.id
    const result = id === 'me' ? await authApi.getMe() : await authApi.getUserById(id as string)
    userInfo.value = result.data
  } finally {
    loading.value = false
  }
}

// 头像上传逻辑
const onAvatarClick = () => {
  if (!isSelf.value) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const tid = toast.loading('上传中...')

    try {
      const { data: url } = await fileApi.upload(file)
      await authApi.updateAvatar(url)
      if (userInfo.value) userInfo.value.avatar = url
      toast.success('更新成功', { id: tid })
    } catch {
      // 由 useRequestManager 处理
      toast.error('', { id: tid })
    }
  }
  input.click()
}

const onBackgroundClick = () => {
  if (!isSelf.value) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const tid = toast.loading('正在更换背景...')

    try {
      const { data: url } = await fileApi.upload(file)
      await authApi.updateBackground(url)
      if (userInfo.value) userInfo.value.backgroundUrl = url
      toast.success('背景更换成功', { id: tid })
    } catch {
      // 由 useRequestManager 处理
    }
  }
  input.click()
}

watch(() => route.params.id, loadData)
onMounted(loadData)
</script>

<template>
  <div class="flex flex-col h-full bg-background select-none">
    <!-- 1. 顶部导航 -->
    <header
      class="h-14 border-b flex items-center px-4 gap-4 shrink-0 bg-background/80 backdrop-blur-md z-10"
    >
      <Button variant="ghost" size="icon" @click="handleBack" class="rounded-full no-drag">
        <ChevronLeft class="h-5 w-5" />
      </Button>
      <span class="font-semibold text-lg">{{ isSelf ? '个人中心' : '详细资料' }}</span>
    </header>

    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <!-- 2. 背景横幅 -->
      <div
        class="h-56 bg-muted relative transition-all duration-500 bg-cover bg-center"
        :style="{
          backgroundImage: userInfo?.backgroundUrl ? `url(${userInfo.backgroundUrl})` : 'none',
          backgroundColor: !userInfo?.backgroundUrl ? 'hsl(var(--primary) / 0.1)' : '',
        }"
      >
        <!-- 如果没有背景图，显示一个默认的渐变层 -->
        <div
          v-if="!userInfo?.backgroundUrl"
          class="absolute inset-0 bg-linear-to-r from-blue-600/20 via-indigo-500/20 to-purple-500/20"
        ></div>

        <div v-if="isSelf" class="absolute top-4 right-6 no-drag">
          <Button
            @click="onBackgroundClick"
            variant="secondary"
            size="sm"
            class="bg-white/40 hover:bg-white text-white backdrop-blur-md border-none shadow-lg"
          >
            <ImageIcon class="h-4 w-4 mr-2 mix-blend-difference" />
            <span class="mix-blend-difference">更换封面</span>
          </Button>
        </div>
      </div>

      <!-- 3. 核心内容卡片 -->
      <div class="max-w-4xl mx-auto px-6 -mt-16 relative pb-10">
        <div class="bg-card border rounded-3xl p-8 shadow-2xl">
          <div class="flex flex-col md:flex-row gap-8 items-start">
            <!-- 头像部分 -->
            <div class="relative group mx-auto md:mx-0 shrink-0">
              <Avatar
                class="h-36 w-36 border-4 border-background shadow-xl transition-transform group-hover:scale-105"
              >
                <AvatarImage :src="userInfo?.avatar || ''" />
                <AvatarFallback class="text-4xl bg-primary text-primary-foreground">{{
                  userInfo?.nickname?.[0]
                }}</AvatarFallback>
              </Avatar>
              <div
                v-if="isSelf"
                @click="onAvatarClick"
                class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
              >
                <Camera class="text-white h-10 w-10" />
              </div>
            </div>

            <!-- 名字与交互按钮 -->
            <div class="flex-1 space-y-6 w-full">
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="space-y-1.5 text-center md:text-left">
                  <div class="flex items-center justify-center md:justify-start gap-2">
                    <h1 class="text-3xl font-bold tracking-tight">{{ userInfo?.nickname }}</h1>
                    <Badge
                      v-if="age !== null"
                      variant="outline"
                      class="px-1.5 py-0 h-5 border-primary/30 text-primary"
                    >
                      {{ age }} 岁
                    </Badge>
                    <component :is="genderIcon" class="h-5 w-5 text-foreground/50" />
                  </div>
                  <div class="flex items-center justify-center md:justify-start gap-3">
                    <p class="text-muted-foreground flex items-center gap-1 text-sm">
                      <Hash class="h-3.5 w-3.5" /> {{ userInfo?.username }}
                    </p>
                    <Badge variant="secondary" class="text-[10px] h-5">正式用户</Badge>
                  </div>
                </div>

                <div class="flex gap-2 justify-center no-drag">
                  <template v-if="isSelf">
                    <Button
                      variant="outline"
                      @click="showEditProfileDialog = true"
                      class="rounded-xl gap-2 h-10 px-6"
                      ><Settings2 class="h-4 w-4" /> 编辑资料</Button
                    >
                    <Button variant="ghost" @click="showPrivacyDialog = true" class="rounded-xl">
                      隐私
                    </Button>
                  </template>
                  <template v-else>
                    <Button class="rounded-xl gap-2 h-10 px-8"
                      ><MessageSquare class="h-4 w-4" /> 发消息</Button
                    >
                    <Button variant="secondary" class="rounded-xl h-10 px-4"
                      ><UserPlus class="h-4 w-4"
                    /></Button>
                  </template>
                </div>
              </div>

              <Separator />

              <!-- 详细资料网格 (使用封装组件) -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-12">
                <InfoItem
                  class="col-span-full"
                  :icon="Info"
                  label="个性签名"
                  :value="userInfo?.signature"
                  :is-self="isSelf"
                  placeholder="这个家伙很懒，什么都没有留下"
                />
                <InfoItem
                  :icon="Cake"
                  label="出生日期"
                  :value="userInfo?.birthday"
                  :is-self="isSelf"
                />
                <InfoItem
                  :icon="MapPin"
                  label="所在地"
                  :value="userInfo?.region"
                  :is-self="isSelf"
                />
                <InfoItem :icon="Briefcase" label="职业" :value="userInfo?.job" :is-self="isSelf" />
                <InfoItem
                  :icon="Calendar"
                  label="加入时间"
                  :value="userInfo?.createTime"
                  :is-self="isSelf"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 4. 额外功能区 (使用封装组件) -->
        <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProfileSection title="最近动态" :icon="ImageIcon" show-action class="md:col-span-2">
            <div class="grid grid-cols-4 gap-2">
              <div
                v-for="i in 4"
                :key="i"
                class="aspect-square bg-muted rounded-xl border-2 border-dashed border-muted-foreground/10 flex items-center justify-center text-muted-foreground/20"
              >
                <ImageIcon class="h-6 w-6" />
              </div>
            </div>
          </ProfileSection>

          <ProfileSection title="共同好友" :icon="Users">
            <div class="flex -space-x-3 overflow-hidden">
              <Avatar
                v-for="i in 5"
                :key="i"
                class="inline-block border-2 border-background w-10 h-10"
              >
                <AvatarImage :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`" />
              </Avatar>
              <div
                class="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-[10px] border-2 border-background text-muted-foreground"
              >
                +12
              </div>
            </div>
            <p class="text-xs text-muted-foreground mt-4">你们有 12 个共同好友</p>
          </ProfileSection>
        </div>

        <!-- 页脚 -->
        <div class="mt-8 flex justify-center gap-4 text-[11px] text-muted-foreground opacity-50">
          <span class="flex items-center gap-1"><ShieldCheck class="h-3 w-3" /> 数据已加密</span>
          <span>•</span>
          <span>Coo Chat ID: {{ userInfo?.id }}</span>
        </div>
      </div>
    </div>

    <EditProfileDialog
      v-model:open="showEditProfileDialog"
      :initial-data="userInfo"
      @success="loadData"
    />

    <PrivacyDialog v-model:open="showPrivacyDialog" :initial-data="userInfo" @changed="loadData" />
  </div>
</template>
