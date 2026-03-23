<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Download,
  ExternalLink,
  Images,
  Megaphone,
  RefreshCw,
  Settings,
  Users,
  X,
} from 'lucide-vue-next'
import { chatApi } from '@/api/chat'
import type { ChatHistoryMessage } from '@/api/types'
import { QuickContextMenu } from '@/components/ui/context-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createGroupSharedContextMenu } from '@/config/menu'
import { toast } from 'vue-sonner'

interface GroupSidebarMember {
  id: string
  name: string
  avatar?: string
}

type GroupSidebarTab = 'members' | 'images' | 'files' | 'manage'

const props = defineProps<{
  groupId: string
  notice?: string
  memberCount?: number
  myNicknameInGroup?: string
  myTitleName?: string
  members: GroupSidebarMember[]
  canManage?: boolean
  initialTab?: GroupSidebarTab
}>()

const router = useRouter()
const PAGE_SIZE = 20
type GroupDetailFocus = 'overview' | 'members' | 'titles' | 'review'

interface SharedTabState {
  list: ChatHistoryMessage[]
  loaded: boolean
  loading: boolean
  hasMore: boolean
  nextCursor: string | null
  error: string
}

const activeTab = ref<GroupSidebarTab>('members')
const imageStateByGroup = ref<Record<string, SharedTabState>>({})
const fileStateByGroup = ref<Record<string, SharedTabState>>({})
const imagePreviewOpen = ref(false)
const previewImageUrl = ref('')
const previewImageError = ref('')
const previewImageKey = ref(0)

const groupRawId = computed(() => (props.groupId.startsWith('group_') ? props.groupId.slice(6) : props.groupId))
const memberTotalText = computed(() => `${props.memberCount || props.members.length || 0} 人`)

const createEmptyState = (): SharedTabState => ({
  list: [],
  loaded: false,
  loading: false,
  hasMore: false,
  nextCursor: null,
  error: '',
})

const getImageState = (id: string) => {
  if (!imageStateByGroup.value[id]) {
    imageStateByGroup.value[id] = createEmptyState()
  }
  return imageStateByGroup.value[id]
}

const getFileState = (id: string) => {
  if (!fileStateByGroup.value[id]) {
    fileStateByGroup.value[id] = createEmptyState()
  }
  return fileStateByGroup.value[id]
}

const mergeById = (base: ChatHistoryMessage[], incoming: ChatHistoryMessage[]) => {
  const map = new Map<string, ChatHistoryMessage>()
  base.forEach((item) => map.set(item.id, item))
  incoming.forEach((item) => map.set(item.id, item))
  return Array.from(map.values())
}

const imageState = computed(() => getImageState(groupRawId.value))
const fileState = computed(() => getFileState(groupRawId.value))
const imageItems = computed(() => imageState.value.list)
const fileItems = computed(() => fileState.value.list)
const loadingImages = computed(() => imageState.value.loading)
const loadingFiles = computed(() => fileState.value.loading)
const hasMoreImages = computed(() => imageState.value.hasMore)
const hasMoreFiles = computed(() => fileState.value.hasMore)
const imageError = computed(() => imageState.value.error)
const fileError = computed(() => fileState.value.error)

const formatFileSize = (size?: number) => {
  if (!size || Number.isNaN(size)) return '未知大小'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

const getFileExtension = (name?: string) => {
  if (!name) return ''
  const last = name.lastIndexOf('.')
  if (last < 0 || last === name.length - 1) return ''
  return name.slice(last + 1).toLowerCase()
}

const getFileTypeToken = (name?: string) => {
  const ext = getFileExtension(name)
  if (!ext) return 'FILE'

  if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) return 'IMG'
  if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return 'VID'
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) return 'AUD'
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'md'].includes(ext)) return 'DOC'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'XLS'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'ZIP'
  if (['js', 'ts', 'java', 'go', 'py', 'c', 'cpp', 'cs', 'json', 'xml', 'yml', 'yaml'].includes(ext))
    return 'CODE'
  return ext.slice(0, 4).toUpperCase()
}

const openImagePreview = (url?: string) => {
  if (!url) return
  previewImageUrl.value = url
  previewImageError.value = ''
  previewImageKey.value += 1
  imagePreviewOpen.value = true
}

const handlePreviewImageError = () => {
  previewImageError.value = '图片加载失败'
}

const retryPreviewImage = () => {
  previewImageError.value = ''
  previewImageKey.value += 1
}

const openFile = (url?: string) => {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

const copyLink = async (url?: string) => {
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    toast.success('已复制链接')
  } catch {
    toast.error('复制失败')
  }
}

const downloadFile = (url?: string, fileName?: string) => {
  if (!url) return
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName || 'file'
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

const getImageContextMenu = (item: ChatHistoryMessage) =>
  createGroupSharedContextMenu({
    keyPrefix: `shared-image-${item.id}`,
    canOpen: !!item.url,
    canDownload: !!item.url,
    canCopyLink: !!item.url,
    onPreview: () => openImagePreview(item.url),
    onOpen: () => openFile(item.url),
    onDownload: () => downloadFile(item.url, `image-${item.id}.webp`),
    onCopyLink: () => {
      void copyLink(item.url)
    },
  })

const getFileContextMenu = (item: ChatHistoryMessage) =>
  createGroupSharedContextMenu({
    keyPrefix: `shared-file-${item.id}`,
    canOpen: !!item.url,
    canDownload: !!item.url,
    canCopyLink: !!item.url,
    onOpen: () => openFile(item.url),
    onDownload: () => downloadFile(item.url, item.fileName || item.content || 'file'),
    onCopyLink: () => {
      void copyLink(item.url)
    },
  })

const retryLoadImages = () => {
  const state = getImageState(groupRawId.value)
  state.loaded = false
  state.error = ''
  state.nextCursor = null
  state.hasMore = false
  void loadSharedImages()
}

const retryLoadFiles = () => {
  const state = getFileState(groupRawId.value)
  state.loaded = false
  state.error = ''
  state.nextCursor = null
  state.hasMore = false
  void loadSharedFiles()
}

const openGroupDetail = (focus: GroupDetailFocus) => {
  void router.push({
    path: `/groups/${groupRawId.value}`,
    query: { focus },
  })
}

const loadSharedImages = async (loadMore = false) => {
  const state = getImageState(groupRawId.value)
  if (state.loading) return
  if (!loadMore && state.loaded) return
  if (loadMore && !state.hasMore) return

  state.loading = true
  try {
    state.error = ''
    const { data } = await chatApi.getGroupSharedImages({
      groupId: groupRawId.value,
      cursor: loadMore ? state.nextCursor || undefined : undefined,
      limit: PAGE_SIZE,
    })
    const list = data?.list || []
    state.list = loadMore ? mergeById(state.list, list) : list
    state.hasMore = !!data?.hasMore
    state.nextCursor = data?.nextCursor || null
    state.loaded = true
  } catch {
    state.error = '共享图片加载失败'
  } finally {
    state.loading = false
  }
}

const loadSharedFiles = async (loadMore = false) => {
  const state = getFileState(groupRawId.value)
  if (state.loading) return
  if (!loadMore && state.loaded) return
  if (loadMore && !state.hasMore) return

  state.loading = true
  try {
    state.error = ''
    const { data } = await chatApi.getGroupSharedFiles({
      groupId: groupRawId.value,
      cursor: loadMore ? state.nextCursor || undefined : undefined,
      limit: PAGE_SIZE,
    })
    const list = data?.list || []
    state.list = loadMore ? mergeById(state.list, list) : list
    state.hasMore = !!data?.hasMore
    state.nextCursor = data?.nextCursor || null
    state.loaded = true
  } catch {
    state.error = '共享文件加载失败'
  } finally {
    state.loading = false
  }
}

const ensureCurrentTabLoaded = (tab: string) => {
  if (tab === 'images') {
    void loadSharedImages()
  } else if (tab === 'files') {
    void loadSharedFiles()
  }
}

watch(
  () => props.groupId,
  () => {
    ensureCurrentTabLoaded(activeTab.value)
  },
)

watch(
  () => props.initialTab,
  (tab) => {
    if (!tab) return
    if (tab === activeTab.value) return
    activeTab.value = tab
  },
)

watch(activeTab, (tab) => {
  ensureCurrentTabLoaded(tab)
})

onMounted(() => {
  ensureCurrentTabLoaded(activeTab.value)
})
</script>

<template>
  <aside class="flex h-full w-72 shrink-0 flex-col border-l bg-muted/10">
    <div class="border-b bg-background/50 p-4">
      <div class="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
        <Megaphone class="h-4 w-4 text-orange-500" />群公告
      </div>
      <div class="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
        {{ notice || '暂无群公告' }}
      </div>
      <div class="mt-3 space-y-1 text-xs text-muted-foreground">
        <p>成员数：{{ memberTotalText }}</p>
        <p>我的群昵称：{{ myNicknameInGroup || '未设置' }}</p>
        <p>我的头衔：{{ myTitleName || '未设置' }}</p>
      </div>
    </div>

    <Tabs v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
      <div class="border-b px-3 py-2">
        <TabsList class="grid w-full grid-cols-4">
          <TabsTrigger value="members">成员</TabsTrigger>
          <TabsTrigger value="images">图片</TabsTrigger>
          <TabsTrigger value="files">文件</TabsTrigger>
          <TabsTrigger value="manage">管理</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="members" class="mt-0 min-h-0 flex-1">
        <ScrollArea class="h-full px-2 py-2">
          <div class="space-y-1 pb-2">
            <div
              v-for="member in members"
              :key="member.id"
              class="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-background"
            >
              <Avatar class="h-8 w-8">
                <AvatarImage :src="member.avatar || ''" />
                <AvatarFallback>{{ member.name?.slice(0, 1) || '?' }}</AvatarFallback>
              </Avatar>
              <div class="min-w-0 flex-1">
                <div class="truncate text-xs font-medium text-foreground">{{ member.name }}</div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="images" class="mt-0 min-h-0 flex-1">
        <ScrollArea class="h-full px-3 py-3">
          <div v-if="loadingImages" class="text-xs text-muted-foreground">加载中...</div>
          <div
            v-else-if="imageError"
            class="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-xs text-muted-foreground"
          >
            <span>{{ imageError }}</span>
            <Button variant="outline" size="sm" @click="retryLoadImages">
              <RefreshCw class="mr-1 h-3.5 w-3.5" />重试
            </Button>
          </div>
          <div v-else-if="imageItems.length === 0" class="text-xs text-muted-foreground">暂无共享图片</div>
          <div v-else class="space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <QuickContextMenu
                v-for="item in imageItems"
                :key="item.id"
                :menu="getImageContextMenu(item)"
                trigger="contextmenu"
              >
                <button
                  type="button"
                  class="block w-full overflow-hidden rounded-xl border bg-background transition-colors hover:border-primary/40"
                  @click="openImagePreview(item.url)"
                >
                  <img :src="item.url" alt="shared image" class="h-24 w-full object-cover" />
                </button>
              </QuickContextMenu>
            </div>
            <Button
              v-if="hasMoreImages"
              variant="outline"
              size="sm"
              class="w-full"
              :disabled="loadingImages"
              @click="loadSharedImages(true)"
            >
              {{ loadingImages ? '加载中...' : '加载更多图片' }}
            </Button>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="files" class="mt-0 min-h-0 flex-1">
        <ScrollArea class="h-full px-3 py-3">
          <div v-if="loadingFiles" class="text-xs text-muted-foreground">加载中...</div>
          <div
            v-else-if="fileError"
            class="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-xs text-muted-foreground"
          >
            <span>{{ fileError }}</span>
            <Button variant="outline" size="sm" @click="retryLoadFiles">
              <RefreshCw class="mr-1 h-3.5 w-3.5" />重试
            </Button>
          </div>
          <div v-else-if="fileItems.length === 0" class="text-xs text-muted-foreground">暂无共享文件</div>
          <div v-else class="space-y-2">
            <QuickContextMenu
              v-for="item in fileItems"
              :key="item.id"
              :menu="getFileContextMenu(item)"
              trigger="contextmenu"
            >
              <div class="flex items-center gap-3 rounded-xl border bg-background p-3 transition-colors hover:bg-muted/20">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-[10px] font-semibold text-muted-foreground"
                >
                  {{ getFileTypeToken(item.fileName || item.content) }}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium">{{ item.fileName || item.content || '文件' }}</div>
                  <div class="text-[10px] text-muted-foreground">{{ formatFileSize(item.fileSize) }}</div>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" class="h-7 w-7" :disabled="!item.url" @click="openFile(item.url)">
                    <ExternalLink class="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7"
                    :disabled="!item.url"
                    @click="downloadFile(item.url, item.fileName || item.content || 'file')"
                  >
                    <Download class="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </QuickContextMenu>
            <Button
              v-if="hasMoreFiles"
              variant="outline"
              size="sm"
              class="w-full"
              :disabled="loadingFiles"
              @click="loadSharedFiles(true)"
            >
              {{ loadingFiles ? '加载中...' : '加载更多文件' }}
            </Button>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="manage" class="mt-0 min-h-0 flex-1">
        <div class="space-y-3 p-3">
          <Button class="w-full" variant="outline" @click="openGroupDetail('overview')">
            <Users class="mr-2 h-4 w-4" />群资料
          </Button>
          <Button class="w-full" variant="outline" @click="openGroupDetail('members')">
            <Users class="mr-2 h-4 w-4" />成员管理
          </Button>
          <Button class="w-full" variant="outline" @click="openGroupDetail('titles')" :disabled="!canManage">
            <Settings class="mr-2 h-4 w-4" />管理入口
          </Button>
          <Button class="w-full" variant="outline" @click="openGroupDetail('review')">
            <Images class="mr-2 h-4 w-4" />审批记录
          </Button>
        </div>
      </TabsContent>
    </Tabs>

    <Dialog v-model:open="imagePreviewOpen">
      <DialogContent
        :show-close-button="false"
        class="h-[85vh] max-w-[min(92vw,1100px)] overflow-hidden border-0 bg-black/95 p-0"
      >
        <div class="relative h-full w-full">
          <Button
            variant="ghost"
            class="absolute right-3 top-3 z-10 h-9 rounded-md border border-white/20 bg-black/60 px-2 text-white hover:bg-black/80 hover:text-white"
            @click="imagePreviewOpen = false"
          >
            <X class="h-4 w-4" />
          </Button>

          <div class="flex h-full w-full items-center justify-center p-4">
            <div
              v-if="previewImageError"
              class="flex flex-col items-center gap-3 rounded-lg border border-white/20 px-6 py-5 text-sm text-white/80"
            >
              <span>{{ previewImageError }}</span>
              <Button variant="outline" class="border-white/30 text-white hover:bg-white/10" @click="retryPreviewImage">
                <RefreshCw class="mr-1 h-3.5 w-3.5" />重新加载
              </Button>
            </div>
            <img
              v-else-if="previewImageUrl"
              :key="previewImageKey"
              :src="previewImageUrl"
              alt="shared preview"
              class="max-h-full max-w-full rounded object-contain"
              @error="handlePreviewImageError"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </aside>
</template>
