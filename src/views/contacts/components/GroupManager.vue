<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import draggable from 'vuedraggable'
import { Plus, GripVertical, Edit2, Check, X, Trash2, Lock } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { socialApi } from '@/api/social'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePlatform } from '@/composables/usePlatform'
import type { FriendGroup } from '@/api/types'

const { p, isElectron } = usePlatform()

const emit = defineEmits<{
  (e: 'update'): void
  (e: 'close'): void
}>()

const notifyUpdate = () => {
  emit('update')
  if (isElectron) {
    p.send('group-updated')
  }
}

const groups = ref<FriendGroup[]>([])
const loading = ref(false)
const loaded = ref(false)

const isDefaultGroup = (groupId: string) => groupId === '0'

const defaultGroup = computed(() => groups.value.find((g) => isDefaultGroup(g.groupId)))
const draggableGroups = computed({
  get: () => groups.value.filter((g) => !isDefaultGroup(g.groupId)),
  set: (val) => {
    groups.value = defaultGroup.value ? [defaultGroup.value, ...val] : val
  },
})

// Edit state
const editingId = ref<string | null>(null)
const editName = ref('')

// Add state
const isAdding = ref(false)
const newGroupName = ref('')

const fetchGroups = async (force = false) => {
  if (loading.value) return
  if (loaded.value && !force) return

  loading.value = true
  try {
    const res = await socialApi.getFriendList()
    groups.value = res.data || []
    loaded.value = true
  } finally {
    loading.value = false
  }
}

const handleAddGroup = async () => {
  if (!newGroupName.value.trim()) {
    toast.error('分组名称不能为空')
    return
  }

  try {
    await socialApi.addFriendGroup(newGroupName.value.trim())
    toast.success('分组创建成功')
    newGroupName.value = ''
    isAdding.value = false
    await fetchGroups(true)
    notifyUpdate()
  } catch {}
}

const startEdit = (group: FriendGroup) => {
  if (isDefaultGroup(group.groupId)) return
  editingId.value = group.groupId
  editName.value = group.groupName
}

const cancelEdit = () => {
  editingId.value = null
  editName.value = ''
}

const saveEdit = async (groupId: string) => {
  if (isDefaultGroup(groupId)) return
  if (!editName.value.trim()) {
    toast.error('分组名称不能为空')
    return
  }

  try {
    await socialApi.updateFriendGroup(groupId, editName.value.trim())
    toast.success('分组重命名成功')
    cancelEdit()
    await fetchGroups(true)
    notifyUpdate()
  } catch {}
}

const handleDelete = async (groupId: string) => {
  if (isDefaultGroup(groupId)) return

  try {
    await socialApi.deleteFriendGroup(groupId)
    toast.success('分组删除成功')
    await fetchGroups(true)
    notifyUpdate()
  } catch {}
}

const handleDragEnd = async () => {
  const groupIds = draggableGroups.value.map((g) => g.groupId)

  try {
    await socialApi.sortFriendGroups(groupIds)
    notifyUpdate()
  } catch {
    await fetchGroups(true) // revert
  }
}

const handleCloseWindow = () => {
  if (isElectron) {
    p.app.close()
  } else {
    emit('close')
  }
}

onMounted(() => {
  void fetchGroups()
})
</script>

<template>
  <div class="flex flex-col h-full bg-background overflow-hidden relative">
    <div v-if="isElectron" class="absolute top-0 left-0 right-0 h-10 app-region-drag z-10" />

    <!-- 顶部 -->
    <div
      class="flex items-center justify-between px-6 py-4 border-b border-border/40 relative z-20"
      :class="{ 'pt-8': isElectron }"
    >
      <div v-if="isElectron">
        <h2 class="text-lg font-semibold">管理分组</h2>
      </div>
      <DialogHeader v-else>
        <DialogTitle>管理分组</DialogTitle>
      </DialogHeader>

      <div class="flex items-center gap-2">
        <Button size="sm" variant="outline" @click="isAdding = true" v-if="!isAdding">
          <Plus class="w-4 h-4 mr-1" />
          <span class="text-xs">新建分组</span>
        </Button>
        <div
          class="app-region-no-drag ml-2 cursor-pointer p-1.5 hover:bg-muted rounded-md text-muted-foreground"
          @click="handleCloseWindow"
        >
          <X class="w-5 h-5" />
        </div>
      </div>
    </div>

    <!-- 主体内容 -->
    <div class="flex-1 overflow-y-auto p-4 content-scroll">
      <!-- 新增分组栏 -->
      <div
        v-if="isAdding"
        class="flex items-center gap-2 mb-4 p-3 rounded-xl border border-primary/20 bg-primary/5"
      >
        <Input
          v-model="newGroupName"
          placeholder="输入新分组名称..."
          class="flex-1 h-8 max-w-50"
          @keyup.enter="handleAddGroup"
          autoFocus
        />
        <div class="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            class="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
            @click="handleAddGroup"
          >
            <Check class="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            class="h-7 w-7 text-muted-foreground"
            @click="isAdding = false"
          >
            <X class="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center items-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>

      <div
        v-else-if="defaultGroup"
        class="flex items-center gap-3 p-3 mb-2 rounded-xl border border-border/60 bg-muted/30"
      >
        <div class="text-muted-foreground/50 p-1">
          <Lock class="w-4 h-4" />
        </div>
        <div class="flex-1">
          <div class="text-sm font-medium">
            {{ defaultGroup.groupName }}
            <span class="text-xs text-muted-foreground ml-2 font-normal"
              >({{ defaultGroup.children?.length || 0 }})</span
            >
          </div>
        </div>
      </div>

      <draggable
        v-if="!loading"
        v-model="draggableGroups"
        :animation="200"
        handle=".drag-handle"
        item-key="groupId"
        @end="handleDragEnd"
        class="flex flex-col gap-2"
        ghost-class="opacity-50"
      >
        <template #item="{ element }">
          <div
            class="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50 group"
          >
            <div
              class="drag-handle cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground transition-colors p-1"
            >
              <GripVertical class="w-4 h-4" />
            </div>

            <div class="flex-1">
              <div v-if="editingId === element.groupId" class="flex items-center gap-2">
                <Input
                  v-model="editName"
                  class="h-8 flex-1 max-w-37.5"
                  @keyup.enter="saveEdit(element.groupId)"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
                  @click="saveEdit(element.groupId)"
                >
                  <Check class="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-7 w-7 text-muted-foreground"
                  @click="cancelEdit"
                >
                  <X class="w-4 h-4" />
                </Button>
              </div>
              <div v-else class="text-sm font-medium">
                {{ element.groupName }}
                <span class="text-xs text-muted-foreground ml-2 font-normal"
                  >({{ element.children?.length || 0 }})</span
                >
              </div>
            </div>

            <div
              v-if="editingId !== element.groupId"
              class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7 text-muted-foreground hover:text-foreground"
                @click="startEdit(element)"
              >
                <Edit2 class="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                @click="handleDelete(element.groupId)"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>

<style scoped>
.content-scroll::-webkit-scrollbar {
  width: 6px;
}
.content-scroll::-webkit-scrollbar-thumb {
  background-color: var(--border);
  border-radius: 4px;
}
</style>
