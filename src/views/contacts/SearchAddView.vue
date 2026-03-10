<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowLeft, Loader2, Minus, Search, UserPlus, Users, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { usePlatform } from '@/composables/usePlatform'
import { socialApi } from '@/api/social'
import { cn } from '@/lib/utils'
import type { FriendApplySource, GroupSearchItem, UserSimple } from '@/api/types'
import { useUserStore } from '@/stores/userStore'
import CompactProfile from './CompactProfile.vue'
import FriendApplyView from '@/views/components/FriendApplyView.vue'

const { p, isElectron } = usePlatform()
const router = useRouter()
const userStore = useUserStore()

const keyword = ref('')
const activeTab = ref<'user' | 'group'>('user')
const userResults = ref<UserSimple[]>([])
const groupResults = ref<GroupSearchItem[]>([])
const loading = ref(false)
const isFirstSearch = ref(true)

const pageNum = ref(1)
const pageSize = ref(15)
const hasMoreUsers = ref(false)
const loadMoreTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const webDetailOpen = ref(false)
const webApplyOpen = ref(false)
const webGroupApplyOpen = ref(false)
const selectedUser = ref<UserSimple | null>(null)
const selectedApplySource = ref<FriendApplySource>('SEARCH')
const selectedGroup = ref<GroupSearchItem | null>(null)
const groupApplyReason = ref('')
const groupApplySaving = ref(false)

const currentUserId = computed(() => String(userStore.userInfo?.id || ''))
const visibleResults = computed(() => (activeTab.value === 'user' ? userResults.value : groupResults.value))

const handleClose = () => {
  if (isElectron) p.app.close()
  else router.back()
}

const handleMinimize = () => p.app.minimize()

const searchUsers = async (isNewSearch = true) => {
  if (!keyword.value.trim()) return

  if (isNewSearch) {
    pageNum.value = 1
    userResults.value = []
    isFirstSearch.value = false
  }

  loading.value = true
  try {
    const res = await socialApi.searchGlobal(keyword.value.trim(), pageNum.value, pageSize.value)
    const data = res.data
    const list = (data.list || []).filter((user) => String(user.id) !== currentUserId.value)

    if (isNewSearch) {
      userResults.value = list
    } else {
      userResults.value = [...userResults.value, ...list]
    }
    hasMoreUsers.value = Boolean(data.hasMore)
  } finally {
    loading.value = false
  }
}

const searchGroups = async () => {
  if (!keyword.value.trim()) return

  loading.value = true
  try {
    const res = await socialApi.searchGroups(keyword.value.trim())
    groupResults.value = res.data || []
    isFirstSearch.value = false
  } finally {
    loading.value = false
  }
}

const doSearch = async (isNewSearch = true) => {
  if (!keyword.value.trim()) return
  if (activeTab.value === 'user') {
    await searchUsers(isNewSearch)
  } else {
    await searchGroups()
  }
}

const loadNextPage = () => {
  if (activeTab.value !== 'user' || loading.value || !hasMoreUsers.value) return
  pageNum.value += 1
  void searchUsers(false)
}

const handleAddFriend = (user: UserSimple) => {
  selectedApplySource.value = 'SEARCH'
  if (isElectron) {
    p.send('open-window', {
      type: 'FRIEND_APPLY',
      route: `/contacts/apply?id=${user.id}&nickname=${encodeURIComponent(user.nickname)}&avatar=${encodeURIComponent(user.avatar || '')}&source=SEARCH`,
    })
  } else {
    selectedUser.value = user
    webApplyOpen.value = true
  }
}

const handleUserCardClick = (user: UserSimple) => {
  selectedApplySource.value = 'SEARCH'
  if (isElectron) {
    p.send('open-window', {
      type: 'USER_DETAIL',
      route: `/contacts/profile-compact/${user.id}?source=SEARCH`,
    })
  } else {
    selectedUser.value = user
    webDetailOpen.value = true
  }
}

const openGroupDetail = (group: GroupSearchItem) => {
  selectedGroup.value = group
  router.push(`/groups/${group.id}`)
}

const openGroupApply = (group: GroupSearchItem) => {
  selectedGroup.value = group
  groupApplyReason.value = ''
  webGroupApplyOpen.value = true
}

const submitGroupApply = async () => {
  if (!selectedGroup.value) return
  groupApplySaving.value = true
  try {
    await socialApi.applyToGroup(selectedGroup.value.id, {
      reason: groupApplyReason.value.trim() || undefined,
    })
    toast.success('入群申请已提交')
    webGroupApplyOpen.value = false
    await searchGroups()
  } finally {
    groupApplySaving.value = false
  }
}

const onGoToApply = (source: FriendApplySource) => {
  selectedApplySource.value = source
  webDetailOpen.value = false
  setTimeout(() => {
    webApplyOpen.value = true
  }, 150)
}

watch(activeTab, () => {
  if (!keyword.value.trim()) return
  void doSearch(true)
})

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !loading.value && hasMoreUsers.value) {
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
          'flex w-full flex-col overflow-hidden bg-background transition-all',
          isElectron ? 'h-full' : 'h-[42rem] max-w-3xl rounded-xl border shadow-sm',
        )
      "
    >
      <div
        class="relative z-50 flex h-12 shrink-0 items-center justify-between border-b bg-background px-4"
        :style="isElectron ? '-webkit-app-region: drag' : ''"
      >
        <div class="flex items-center gap-2 text-base font-bold">
          <Button
            v-if="!isElectron"
            variant="ghost"
            size="icon"
            class="-ml-2 h-8 w-8"
            @click="handleClose"
          >
            <ArrowLeft class="h-4 w-4" />
          </Button>
          添加好友 / 群聊
        </div>

        <div class="flex items-center gap-1" style="-webkit-app-region: no-drag">
          <template v-if="isElectron">
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
          </template>
        </div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col bg-background">
        <div class="shrink-0 p-6 pb-2">
          <Tabs v-model="activeTab" class="flex w-full flex-col">
            <div class="mb-6 flex justify-center">
              <TabsList class="grid w-full grid-cols-2">
                <TabsTrigger value="user">用户</TabsTrigger>
                <TabsTrigger value="group">群聊</TabsTrigger>
              </TabsList>
            </div>

            <div class="flex justify-center">
              <div class="flex w-full gap-3">
                <div class="relative flex-1">
                  <Search class="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    v-model="keyword"
                    :placeholder="activeTab === 'user' ? '输入昵称、用户名或 ID' : '输入群名称或群号'"
                    class="h-10 pl-9 no-drag focus-visible:ring-1"
                    @keyup.enter="doSearch(true)"
                  />
                </div>
                <Button class="w-24 no-drag" :disabled="loading" @click="doSearch(true)">
                  <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />搜索
                </Button>
              </div>
            </div>
          </Tabs>
        </div>

        <div class="custom-scrollbar flex-1 overflow-y-auto p-6 pt-2">
          <div
            v-if="isFirstSearch"
            class="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/20 text-sm text-muted-foreground"
          >
            <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <UserPlus v-if="activeTab === 'user'" class="h-8 w-8 opacity-50" />
              <Users v-else class="h-8 w-8 opacity-50" />
            </div>
            <p>{{ activeTab === 'user' ? '搜索用户并发起好友申请' : '搜索群聊并申请加入' }}</p>
          </div>

          <div v-else-if="visibleResults.length > 0" class="mx-auto space-y-3">
            <template v-if="activeTab === 'user'">
              <div
                v-for="user in userResults"
                :key="user.id"
                class="group flex items-center justify-between rounded-xl border bg-card p-3 transition-all hover:border-primary/50"
                @click="handleUserCardClick(user)"
              >
                <div class="flex items-center gap-3">
                  <Avatar class="h-11 w-11 border">
                    <AvatarImage :src="user.avatar || ''" />
                    <AvatarFallback class="bg-primary/10 text-primary">{{ user.nickname?.[0] || '?' }}</AvatarFallback>
                  </Avatar>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 text-sm font-bold">
                      <span class="truncate">{{ user.nickname }}</span>
                    </div>
                    <div class="font-mono text-[11px] text-muted-foreground">ID: {{ user.id }}</div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  class="h-8 rounded-lg transition-all active:scale-95"
                  @click.stop="handleAddFriend(user)"
                >
                  <UserPlus class="mr-1.5 h-3.5 w-3.5" />加好友
                </Button>
              </div>

              <div ref="loadMoreTrigger" class="flex justify-center py-4">
                <div v-if="loading" class="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 class="h-3 w-3 animate-spin" />正在加载更多...
                </div>
                <div
                  v-else-if="!hasMoreUsers"
                  class="text-[10px] uppercase tracking-widest text-muted-foreground opacity-50"
                >
                  已加载全部结果
                </div>
              </div>
            </template>

            <template v-else>
              <div
                v-for="group in groupResults"
                :key="group.id"
                class="flex items-center justify-between rounded-xl border bg-card p-3 transition-all hover:border-primary/50"
              >
                <div class="flex min-w-0 cursor-pointer items-center gap-3" @click="openGroupDetail(group)">
                  <Avatar class="h-11 w-11 border">
                    <AvatarImage :src="group.avatar || ''" />
                    <AvatarFallback class="bg-indigo-100 text-indigo-600">群</AvatarFallback>
                  </Avatar>
                  <div class="min-w-0">
                    <div class="truncate text-sm font-bold">{{ group.name }}</div>
                    <div class="truncate text-[11px] text-muted-foreground">
                      {{ group.memberCount }} 人 · {{ group.notice || '暂无群公告' }}
                    </div>
                    <div class="font-mono text-[11px] text-muted-foreground">群号: {{ group.id }}</div>
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <Button v-if="group.joined" size="sm" variant="outline" @click.stop="openGroupDetail(group)">
                    查看
                  </Button>
                  <Button v-else-if="group.pending" size="sm" variant="secondary" disabled>
                    等待审批
                  </Button>
                  <Button v-else size="sm" @click.stop="openGroupApply(group)">申请加入</Button>
                </div>
              </div>
            </template>
          </div>

          <div
            v-else-if="!loading"
            class="flex h-64 flex-col items-center justify-center text-muted-foreground"
          >
            <Search class="mb-2 h-10 w-10 opacity-20" />
            <p class="text-sm">没有找到匹配结果</p>
          </div>
        </div>
      </div>
    </div>

    <template v-if="!isElectron">
      <Dialog v-model:open="webDetailOpen">
        <DialogContent class="overflow-hidden p-0">
          <CompactProfile
            :user-id="selectedUser?.id"
            :source="selectedApplySource"
            @goToApply="onGoToApply"
          />
        </DialogContent>
      </Dialog>

      <Dialog v-model:open="webApplyOpen">
        <DialogContent class="overflow-hidden border-none p-0">
          <FriendApplyView :user="selectedUser" :source="selectedApplySource" @close="webApplyOpen = false" />
        </DialogContent>
      </Dialog>
    </template>

    <Dialog v-model:open="webGroupApplyOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>申请加入群聊</DialogTitle>
          <DialogDescription>
            {{ selectedGroup ? `向「${selectedGroup.name}」发送入群申请` : '发送入群申请' }}
          </DialogDescription>
        </DialogHeader>

        <Textarea v-model="groupApplyReason" rows="4" placeholder="输入申请理由（可选）" />

        <DialogFooter>
          <Button variant="outline" @click="webGroupApplyOpen = false">取消</Button>
          <Button :disabled="groupApplySaving" @click="submitGroupApply">
            {{ groupApplySaving ? '提交中...' : '提交申请' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
