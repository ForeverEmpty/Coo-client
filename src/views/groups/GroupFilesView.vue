<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  ArrowLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  FolderPlus,
  RefreshCw,
  Upload,
  Minus,
  X,
} from 'lucide-vue-next'
import { socialApi } from '@/api/social'
import type { GroupFileConfig, GroupFileFolder, GroupFileItem, GroupInfo } from '@/api/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { usePlatform } from '@/composables/usePlatform'

const route = useRoute()
const router = useRouter()
const { p, isElectron } = usePlatform()

const PAGE_SIZE = 30

const loading = ref(false)
const loadingMore = ref(false)
const uploading = ref(false)
const errorText = ref('')
const hasMore = ref(false)
const pageNum = ref(1)
const files = ref<GroupFileItem[]>([])
const folders = ref<GroupFileFolder[]>([])
const groupInfo = ref<GroupInfo | null>(null)
const groupFileConfig = ref<GroupFileConfig | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const newFolderName = ref('')

const currentFolderId = ref<string>('0')
const folderStack = ref<Array<{ id: string; name: string }>>([])

const groupId = computed(() => String(route.params.id || '').trim())
const pageTitle = computed(() => groupInfo.value?.remark || groupInfo.value?.name || `群文件(${groupId.value})`)
const currentFolderName = computed(() => {
  if (folderStack.value.length === 0) return '根目录'
  return folderStack.value[folderStack.value.length - 1]?.name || '根目录'
})

const handleMinimizeWindow = () => {
  if (!isElectron) return
  p.app.minimize()
}

const handleCloseWindow = () => {
  if (!isElectron) return
  p.app.close()
}

const formatFileSize = (size?: number) => {
  if (!size || Number.isNaN(size)) return '未知大小'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

const loadGroupInfo = async () => {
  if (!groupId.value) return
  try {
    const { data } = await socialApi.getGroupInfo(groupId.value)
    groupInfo.value = data || null
  } catch {
    groupInfo.value = null
  }
}

const loadGroupFileConfig = async () => {
  if (!groupId.value) return
  try {
    const { data } = await socialApi.getGroupFileConfig(groupId.value)
    groupFileConfig.value = data || null
  } catch {
    groupFileConfig.value = null
  }
}

const loadFolders = async () => {
  if (!groupId.value) return
  const { data } = await socialApi.listGroupFolders(groupId.value, currentFolderId.value === '0' ? undefined : currentFolderId.value)
  folders.value = data || []
}

const loadFiles = async (loadMore = false) => {
  if (!groupId.value) return
  if (loadMore) {
    if (!hasMore.value || loadingMore.value) return
    loadingMore.value = true
  } else {
    if (loading.value) return
    loading.value = true
  }

  try {
    if (!loadMore) {
      errorText.value = ''
      pageNum.value = 1
      hasMore.value = false
    }
    const targetPage = loadMore ? pageNum.value + 1 : 1
    const { data } = await socialApi.listGroupFiles(groupId.value, {
      folderId: currentFolderId.value === '0' ? undefined : currentFolderId.value,
      pageNum: targetPage,
      pageSize: PAGE_SIZE,
    })
    const list = data?.list || []
    files.value = loadMore ? [...files.value, ...list] : list
    pageNum.value = targetPage
    hasMore.value = !!data?.hasMore
  } catch {
    if (!loadMore) errorText.value = '加载群文件失败'
  } finally {
    if (loadMore) loadingMore.value = false
    else loading.value = false
  }
}

const refreshCurrent = async () => {
  await Promise.all([loadFolders(), loadFiles(false)])
}

const openFolder = async (folder: GroupFileFolder) => {
  currentFolderId.value = String(folder.id)
  folderStack.value.push({ id: String(folder.id), name: folder.name })
  await refreshCurrent()
}

const goRoot = async () => {
  currentFolderId.value = '0'
  folderStack.value = []
  await refreshCurrent()
}

const goBackOne = async () => {
  if (folderStack.value.length === 0) return
  folderStack.value.pop()
  currentFolderId.value =
    folderStack.value.length > 0 ? folderStack.value[folderStack.value.length - 1]?.id || '0' : '0'
  await refreshCurrent()
}

const createFolder = async () => {
  const name = newFolderName.value.trim()
  if (!name) {
    toast.error('请输入文件夹名称')
    return
  }
  await socialApi.createGroupFolder(groupId.value, {
    parentId: currentFolderId.value === '0' ? undefined : currentFolderId.value,
    name,
  })
  newFolderName.value = ''
  toast.success('已创建文件夹')
  await loadFolders()
}

const triggerUpload = () => fileInputRef.value?.click()

const handleUploadChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  if (!selected) return
  const capacityMb = groupFileConfig.value?.fileCapacityMb || 1024
  const usedStorageBytes = groupFileConfig.value?.usedStorageBytes || 0
  const oversizeThresholdMb = groupFileConfig.value?.oversizeThresholdMb || 100
  const remaining = capacityMb * 1024 * 1024 - usedStorageBytes
  if (selected.size > remaining && selected.size <= oversizeThresholdMb * 1024 * 1024) {
    toast.error('群文件容量不足，请清理后再上传')
    input.value = ''
    return
  }

  uploading.value = true
  try {
    const { data } = await socialApi.uploadGroupFile(groupId.value, selected, {
      folderId: currentFolderId.value === '0' ? undefined : currentFolderId.value,
      source: 'MANUAL',
    })
    if (data?.temp) {
      toast.success('文件已按临时文件存储')
    } else {
      toast.success('文件上传成功')
      if (groupFileConfig.value) {
        groupFileConfig.value.usedStorageBytes += selected.size
      }
    }
    await loadFiles(false)
  } catch {
    toast.error('文件上传失败')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

const deleteFile = async (fileId: string) => {
  await socialApi.deleteGroupFile(groupId.value, fileId)
  toast.success('文件已删除')
  await loadFiles(false)
}

const openFile = (url?: string) => {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
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

onMounted(async () => {
  await Promise.all([loadGroupInfo(), loadGroupFileConfig(), refreshCurrent()])
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-background">
    <div
      v-if="isElectron"
      class="flex h-10 shrink-0 items-center justify-between border-b bg-background/95 px-2"
      style="-webkit-app-region: drag"
    >
      <div class="truncate px-2 text-xs text-muted-foreground">群文件</div>
      <div class="flex items-center gap-1" style="-webkit-app-region: no-drag">
        <Button variant="ghost" size="icon" class="h-8 w-8" @click="handleMinimizeWindow">
          <Minus class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
          @click="handleCloseWindow"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <div class="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-4 md:px-6">
      <header class="mb-4 flex items-center justify-between">
        <div class="flex min-w-0 items-center gap-2">
          <Button
            v-if="!isElectron"
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            @click="router.back()"
          >
            <ArrowLeft class="h-4 w-4" />
          </Button>
          <div class="min-w-0">
            <p class="truncate text-lg font-semibold">{{ pageTitle }}</p>
            <div class="flex items-center gap-1 text-xs text-muted-foreground">
              <span class="truncate">群号: {{ groupId }}</span>
              <ChevronRight class="h-3 w-3" />
              <span class="truncate">{{ currentFolderName }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" :disabled="uploading" @click="triggerUpload">
            <Upload class="mr-1 h-3.5 w-3.5" />
            {{ uploading ? '上传中...' : '上传文件' }}
          </Button>
          <Button variant="outline" size="sm" @click="refreshCurrent">
            <RefreshCw class="mr-1 h-3.5 w-3.5" />
            刷新
          </Button>
        </div>
      </header>

      <input ref="fileInputRef" type="file" class="hidden" @change="handleUploadChange" />

      <div class="mb-3 flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <Button variant="outline" size="sm" :disabled="folderStack.length === 0" @click="goRoot">根目录</Button>
        <Button variant="outline" size="sm" :disabled="folderStack.length === 0" @click="goBackOne">返回上级</Button>
        <div class="flex min-w-[280px] items-center gap-2">
          <Input v-model="newFolderName" placeholder="新建文件夹名称" class="h-8" />
          <Button variant="outline" size="sm" @click="createFolder">
            <FolderPlus class="mr-1 h-3.5 w-3.5" />
            新建文件夹
          </Button>
        </div>
      </div>

      <div v-if="loading" class="flex-1 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        加载中...
      </div>

      <div
        v-else-if="errorText"
        class="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
      >
        <p>{{ errorText }}</p>
        <Button variant="outline" size="sm" @click="refreshCurrent">重试</Button>
      </div>

      <ScrollArea v-else class="min-h-0 flex-1 rounded-lg border">
        <div class="space-y-2 p-3">
          <button
            v-for="folder in folders"
            :key="folder.id"
            class="flex w-full items-center gap-3 rounded-lg border bg-muted/30 p-3 text-left hover:bg-muted"
            @click="openFolder(folder)"
          >
            <Folder class="h-4 w-4 text-muted-foreground" />
            <span class="truncate text-sm font-medium">{{ folder.name }}</span>
          </button>

          <div
            v-for="item in files"
            :key="item.id"
            class="flex items-center gap-3 rounded-lg border bg-card p-3"
          >
            <div class="rounded-md bg-muted p-2 text-muted-foreground">
              <FileText class="h-4 w-4" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ item.fileName || '文件' }}</p>
              <p class="text-xs text-muted-foreground">
                {{ formatFileSize(item.fileSize) }}
                <span v-if="item.temp && item.expireAt"> · 临时文件，过期于 {{ item.expireAt }}</span>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                :disabled="!item.url"
                @click="openFile(item.url)"
              >
                <ExternalLink class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                :disabled="!item.url"
                @click="downloadFile(item.url, item.fileName || 'file')"
              >
                <Download class="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" class="h-8 text-xs" @click="deleteFile(item.id)">
                删除
              </Button>
            </div>
          </div>

          <p
            v-if="!folders.length && !files.length"
            class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
          >
            当前目录为空
          </p>

          <Button
            v-if="hasMore"
            variant="outline"
            class="w-full"
            :disabled="loadingMore"
            @click="loadFiles(true)"
          >
            {{ loadingMore ? '加载中...' : '加载更多' }}
          </Button>
        </div>
      </ScrollArea>
    </div>
  </div>
</template>
