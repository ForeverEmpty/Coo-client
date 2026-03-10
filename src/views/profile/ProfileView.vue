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
  Trash2,
} from 'lucide-vue-next'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

import InfoItem from '@/views/profile/components/InfoItem.vue'
import ProfileSection from '@/views/profile/components/ProfileSection.vue'
import EditProfileDialog from '@/views/profile/components/EditProfileDialog.vue'
import PrivacyDialog from '@/views/profile/components/PrivacyDialog.vue'
import ProfileImageEditor from '@/views/profile/components/ProfileImageEditor.vue'

import type { Friend, FriendApplySource, UserInfo, UserSimple } from '@/api/types'
import { authApi } from '@/api/auth'
import { socialApi } from '@/api/social'
import { calculateAge } from '@/utils/calculateAge'
import { formatLocalDateTime } from '@/utils/dateTime'
import type { ProfileImageTarget } from '@/config/profileImage'
import { usePlatform } from '@/composables/usePlatform'
import FriendApplyView from '../components/FriendApplyView.vue'
import { useChatStore } from '@/stores/chatStore'
import { useDialog } from '@/composables/useDialog'
import { useUserStore } from '@/stores/userStore'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const userStore = useUserStore()
const { p, isElectron } = usePlatform()
const { confirm } = useDialog()

const loading = ref(true)
const userInfo = ref<UserInfo | null>(null)
const showEditProfileDialog = ref(false)
const showPrivacyDialog = ref(false)
const showImageEditorDialog = ref(false)
const imageEditorTarget = ref<ProfileImageTarget>('avatar')
const webApplyOpen = ref(false)
const confirmDialogOpen = ref(false)
const selectedUser = ref<UserSimple | null>(null)
const mutualFriends = ref<UserSimple[]>([])
const mutualTotal = ref(0)
const mutualLoading = ref(false)
const mutualRequestId = ref(0)
const deletingFriendId = ref<string | null>(null)
const pendingDeleteFriend = ref<Friend | null>(null)
const applySource = ref<FriendApplySource>(
  (['SEARCH', 'QR', 'GROUP'].includes(route.query.source as string)
    ? route.query.source
    : 'SEARCH') as FriendApplySource,
)

const genderIconMap: Record<number, FunctionalComponent> = {
  1: Mars,
  2: Venus,
  0: VenusAndMars,
}

const isSelf = computed(() => route.params.id === 'me' || userInfo.value?.isMe)
const showMutualFriends = computed(() => !isSelf.value && userInfo.value?.publicMutualFriend)
const age = computed(() => calculateAge(userInfo.value?.birthday))
const genderIcon = computed(() => genderIconMap[userInfo.value?.gender || 0])
const createTimeText = computed(() =>
  userInfo.value?.createTime ? formatLocalDateTime(userInfo.value.createTime, 'zh-CN') : '',
)

const handleBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/chat')
}

const closeDeleteDialog = () => {
  confirmDialogOpen.value = false
  pendingDeleteFriend.value = null
}

const deleteFriend = async (friend: Friend) => {
  if (deletingFriendId.value) return

  deletingFriendId.value = friend.id
  try {
    await socialApi.deleteFriend(friend.id)

    if (chatStore.activeChatId === friend.id) {
      chatStore.activeChatId = null
    }

    toast.success('已删除好友（单向删除）')
    closeDeleteDialog()
  } catch {
    toast.error('删除失败，请稍后重试')
  } finally {
    deletingFriendId.value = null
  }
}

const requestDeleteFriend = async (friend: Friend) => {
  if (deletingFriendId.value) return

  if (isElectron) {
    const confirmed = await confirm({
      title: '删除好友',
      description: `确认删除“${friend.showName || friend.nickname}”吗？这是单向删除。`,
      confirmText: '确认删除',
      cancelText: '取消',
      variant: 'destructive',
    })

    if (!confirmed) return
    await deleteFriend(friend)
    return
  }

  pendingDeleteFriend.value = friend
  confirmDialogOpen.value = true
}

const confirmDeleteFriend = async () => {
  const friend = pendingDeleteFriend.value
  if (!friend) return
  await deleteFriend(friend)
}

const resetMutualFriends = () => {
  mutualFriends.value = []
  mutualTotal.value = 0
  mutualLoading.value = false
}

const loadMutualFriends = async (targetId: string, targetInfo: UserInfo | null) => {
  if (!targetId || !targetInfo || targetInfo.isMe || !targetInfo.publicMutualFriend) {
    resetMutualFriends()
    return
  }

  const requestId = ++mutualRequestId.value
  mutualLoading.value = true

  try {
    const { data } = await socialApi.getMutualFriends(targetId, 6)
    if (requestId !== mutualRequestId.value) return

    mutualFriends.value = data?.list || []
    mutualTotal.value = Number(data?.total ?? mutualFriends.value.length)
  } catch {
    if (requestId !== mutualRequestId.value) return
    resetMutualFriends()
  } finally {
    if (requestId === mutualRequestId.value) {
      mutualLoading.value = false
    }
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const routeId = String(route.params.id || '')
    const result = routeId === 'me'
      ? await authApi.getMe()
      : await socialApi.getFriendInfo(routeId)

    const info = result.data
    userInfo.value = info

    const targetId = routeId === 'me' ? String(info?.id || '') : routeId
    await loadMutualFriends(targetId, info || null)
  } finally {
    loading.value = false
  }
}

const syncUserStoreProfile = (target: ProfileImageTarget, url: string) => {
  const nextInfo = userStore.userInfo ? { ...userStore.userInfo } : { ...(userInfo.value || {}) }

  if (target === 'avatar') {
    nextInfo.avatar = url
  } else {
    nextInfo.backgroundUrl = url
  }

  userStore.userInfo = nextInfo as UserInfo
  localStorage.setItem('coo_user_info', JSON.stringify(nextInfo))
}

const applyImageUpdate = (payload: { target: ProfileImageTarget; url: string }) => {
  if (!payload?.url) return

  if (payload.target === 'avatar') {
    if (userInfo.value) userInfo.value.avatar = payload.url
  } else if (userInfo.value) {
    userInfo.value.backgroundUrl = payload.url
  }

  syncUserStoreProfile(payload.target, payload.url)
}

const openImageEditor = (target: ProfileImageTarget) => {
  if (!isSelf.value) return
  imageEditorTarget.value = target

  if (isElectron) {
    p.send('open-window', {
      type: 'IMAGE_EDITOR',
      route: `/profile/image-editor?target=${target}`,
    })
    return
  }

  showImageEditorDialog.value = true
}

const onAvatarClick = () => {
  openImageEditor('avatar')
}

const onBackgroundClick = () => {
  openImageEditor('background')
}

const handleImageEditorSuccess = (payload: { target: ProfileImageTarget; url: string }) => {
  applyImageUpdate(payload)
  showImageEditorDialog.value = false
}

const handleFriendActionClick = () => {
  if (userInfo.value?.isFriend) {
    void requestDeleteFriend(
      pendingDeleteFriend.value ||
        ({
          id: userInfo.value.id,
          nickname: userInfo.value.nickname,
          showName: userInfo.value.nickname,
        } as Friend),
    )
    return
  }

  if (isElectron) {
    p.send('open-window', {
      type: 'FRIEND_APPLY',
      route: `/contacts/apply?id=${userInfo.value?.id}&nickname=${userInfo.value?.nickname}&avatar=${userInfo.value?.avatar}&source=${applySource.value}`,
    })
  } else {
    selectedUser.value = { ...userInfo.value } as UserSimple
    webApplyOpen.value = true
  }
}

const copyText = (text: string) => {
  if (!text) return
  navigator.clipboard.writeText(text)
  toast.success('已复制')
}

const handleMutualFriendClick = (friend: UserSimple) => {
  const id = String(friend?.id || '')
  if (!id) return

  if (isElectron) {
    p.send('open-window', {
      type: 'USER_DETAIL',
      route: `/contacts/profile-compact/${id}?source=SEARCH`,
    })
    return
  }

  router.push(`/profile/${id}`)
}

watch(() => route.params.id, loadData)
onMounted(() => {
  void loadData()
  if (!isElectron) return

  p.on(
    'profile-image-updated',
    (_event, payload: { target: ProfileImageTarget; url: string } | undefined) => {
      if (!payload) return
      applyImageUpdate(payload)
    },
  )
})
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
                    <p
                      class="text-muted-foreground flex items-center gap-1 text-sm cursor-pointer"
                      @click="copyText(userInfo?.username || '')"
                    >
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
                    >
                      <Settings2 class="h-4 w-4" /> 编辑资料
                    </Button>
                    <Button variant="ghost" @click="showPrivacyDialog = true" class="rounded-xl">
                      隐私
                    </Button>
                  </template>
                  <template v-else>
                    <Button class="rounded-xl gap-2 h-10 px-8">
                      <MessageSquare class="h-4 w-4" /> 发消息
                    </Button>
                    <Button
                      variant="secondary"
                      class="rounded-xl h-10 px-4"
                      @click="handleFriendActionClick()"
                    >
                      <Trash2 v-if="userInfo?.isFriend" class="h-4 w-4" />
                      <UserPlus v-else class="h-4 w-4" />
                    </Button>
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
                  :value="createTimeText"
                  :is-self="isSelf"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 4. 额外功能区 (使用封装组件) -->
        <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- 动态绑定 class -->
          <ProfileSection
            title="最近动态"
            :icon="ImageIcon"
            show-action
            :class="[showMutualFriends ? 'md:col-span-2' : 'md:col-span-3']"
          >
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

          <!-- 共同好友模块 -->
          <ProfileSection v-if="showMutualFriends" title="共同好友" :icon="Users">
            <div v-if="mutualLoading" class="text-xs text-muted-foreground">加载中...</div>
            <div
              v-else-if="mutualFriends.length > 0"
              class="flex -space-x-3 overflow-hidden no-drag"
            >
              <button
                v-for="friend in mutualFriends"
                :key="friend.id"
                type="button"
                class="rounded-full border-2 border-background transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/40"
                :title="friend.nickname"
                @click="handleMutualFriendClick(friend)"
              >
                <Avatar class="inline-block w-10 h-10">
                  <AvatarImage :src="friend.avatar || ''" />
                  <AvatarFallback>{{
                    (friend.nickname || friend.username || 'U').charAt(0).toUpperCase()
                  }}</AvatarFallback>
                </Avatar>
              </button>
              <div
                v-if="mutualTotal > mutualFriends.length"
                class="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-[10px] border-2 border-background text-muted-foreground"
              >
                +{{ mutualTotal - mutualFriends.length }}
              </div>
            </div>
            <p v-else class="text-xs text-muted-foreground">暂无共同好友</p>
            <p class="text-xs text-muted-foreground mt-4">你们有 {{ mutualTotal }} 个共同好友</p>
          </ProfileSection>
        </div>

        <!-- 页脚 -->
        <div class="mt-8 flex justify-center gap-4 text-[11px] text-muted-foreground opacity-50">
          <span class="flex items-center gap-1"><ShieldCheck class="h-3 w-3" /> 数据已加密</span>
          <span>•</span>
          <span class="cursor-pointer" @click="copyText(userInfo?.id || '')">
            Coo Chat ID: {{ userInfo?.id }}
          </span>
        </div>
      </div>
    </div>

    <EditProfileDialog
      v-model:open="showEditProfileDialog"
      :initial-data="userInfo"
      @success="loadData"
    />

    <PrivacyDialog v-model:open="showPrivacyDialog" :initial-data="userInfo" @changed="loadData" />

    <template v-if="!isElectron">
      <!-- 申请弹窗 -->
      <Dialog v-model:open="webApplyOpen">
        <DialogContent class="p-0 overflow-hidden border-none">
          <FriendApplyView
            :user="selectedUser"
            :source="applySource"
            @close="webApplyOpen = false"
          />
        </DialogContent>
      </Dialog>

      <Dialog v-model:open="showImageEditorDialog">
        <DialogContent class="max-w-4xl p-0 overflow-hidden" :show-close-button="false">
          <ProfileImageEditor
            :target="imageEditorTarget"
            @close="showImageEditorDialog = false"
            @success="handleImageEditorSuccess"
          />
        </DialogContent>
      </Dialog>

      <Dialog v-model:open="confirmDialogOpen">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除好友</DialogTitle>
            <DialogDescription>
              确认删除“{{
                pendingDeleteFriend?.showName || pendingDeleteFriend?.nickname
              }}”吗？这是单向删除。
            </DialogDescription>
          </DialogHeader>

          <DialogFooter class="gap-2">
            <Button variant="outline" :disabled="!!deletingFriendId" @click="closeDeleteDialog">
              取消
            </Button>
            <Button
              variant="destructive"
              :disabled="!!deletingFriendId"
              @click="confirmDeleteFriend"
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
