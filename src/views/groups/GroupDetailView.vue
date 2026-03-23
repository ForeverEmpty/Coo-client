<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  Info,
  ShieldCheck,
  MessageSquare,
  Folder,
  Bell,
} from 'lucide-vue-next'
import { socialApi } from '@/api/social'
import type {
  GroupInfo,
  GroupJoinRequest,
  GroupMember,
  GroupPermission,
  GroupTitle,
} from '@/api/types'
import { useChatStore } from '@/stores/chatStore'
import { useContactStore } from '@/stores/contactStore'
import { useUserStore } from '@/stores/userStore'
import { emitGroupUpdated } from '@/utils/groupSync'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import InfoItem from '@/views/profile/components/InfoItem.vue'
import ProfileSection from '@/views/profile/components/ProfileSection.vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const contactStore = useContactStore()
const userStore = useUserStore()

const loading = ref(true)
const saving = ref(false)
const groupInfo = ref<GroupInfo | null>(null)
const members = ref<GroupMember[]>([])
const titles = ref<GroupTitle[]>([])
const joinRequests = ref<GroupJoinRequest[]>([])
type GroupDetailFocus = 'overview' | 'members' | 'titles' | 'review'
const SECTION_IDS: Record<GroupDetailFocus, string> = {
  overview: 'group-detail-overview',
  members: 'group-detail-members',
  titles: 'group-detail-titles',
  review: 'group-detail-review',
}

const editDialogOpen = ref(false)
const inviteDialogOpen = ref(false)
const titleDialogOpen = ref(false)
const nicknameDialogOpen = ref(false)
const titleOrderIds = ref<string[]>([])
const draggingTitleId = ref<string | null>(null)

const editingTitle = ref<GroupTitle | null>(null)
const editingMember = ref<GroupMember | null>(null)

const groupForm = ref({
  name: '',
  notice: '',
  inviteAuditMode: '0',
})
const inviteReason = ref('')
const selectedInviteUserIds = ref<string[]>([])
const titleForm = ref<{ name: string; sort: number; permissions: GroupPermission[] }>({
  name: '',
  sort: 0,
  permissions: ['GROUP_VIEW'],
})
const nicknameValue = ref('')
const fileConfigForm = ref({
  fileCapacityMb: 1024,
  oversizeThresholdMb: 100,
  tempExpireDays: 7,
})

const permissionLabels: Record<GroupPermission, string> = {
  GROUP_VIEW: '查看群资料',
  GROUP_EDIT_INFO: '编辑群资料',
  GROUP_EDIT_NOTICE: '编辑群公告',
  GROUP_INVITE_MEMBER: '邀请成员',
  GROUP_REVIEW_INVITE: '审批邀请',
  GROUP_REVIEW_APPLY: '审批申请',
  GROUP_REMOVE_MEMBER: '移除成员',
  GROUP_ASSIGN_TITLE: '分配头衔',
  GROUP_MANAGE_TITLE: '管理头衔',
  GROUP_TRANSFER_OWNER: '转让群主',
  GROUP_EDIT_MEMBER_NICKNAME: '修改成员群昵称',
  GROUP_FILE_VIEW: '查看群文件',
  GROUP_FILE_UPLOAD: '上传群文件',
  GROUP_FILE_MANAGE: '管理群文件',
  GROUP_FILE_MANAGE_STORAGE: '管理群文件容量',
  GROUP_RECALL_ANYTIME: '不限时撤回消息',
}

const groupId = computed(() => String(route.params.id || ''))
const myUserId = computed(() => String(userStore.userInfo?.id || ''))
const permissionSet = computed(() => new Set(groupInfo.value?.myPermissions || []))
const canEditGroup = computed(
  () => permissionSet.value.has('GROUP_EDIT_INFO') || permissionSet.value.has('GROUP_EDIT_NOTICE'),
)
const canManageTitles = computed(() => permissionSet.value.has('GROUP_MANAGE_TITLE'))
const canInvite = computed(() => permissionSet.value.has('GROUP_INVITE_MEMBER'))
const canReview = computed(
  () =>
    permissionSet.value.has('GROUP_REVIEW_INVITE') || permissionSet.value.has('GROUP_REVIEW_APPLY'),
)
const canEditOthersNickname = computed(() => permissionSet.value.has('GROUP_EDIT_MEMBER_NICKNAME'))
const canAssignTitle = computed(() => permissionSet.value.has('GROUP_ASSIGN_TITLE'))
const canRemoveMember = computed(() => permissionSet.value.has('GROUP_REMOVE_MEMBER'))
const canManageGroupFileStorage = computed(() =>
  permissionSet.value.has('GROUP_FILE_MANAGE_STORAGE'),
)

const friendOptions = computed(() =>
  contactStore.friendGroups.flatMap((group) =>
    group.children.map((friend) => ({
      id: String(friend.id),
      label: friend.showName || friend.nickname || String(friend.id),
    })),
  ),
)

const availableInviteOptions = computed(() => {
  const memberIdSet = new Set(members.value.map((item) => item.userId))
  return friendOptions.value.filter((item) => !memberIdSet.has(item.id))
})

const baseSortedTitles = computed(() => [...titles.value].sort((a, b) => a.sort - b.sort))
const sortedTitles = computed(() => {
  const orderedIds = titleOrderIds.value
  if (orderedIds.length !== baseSortedTitles.value.length) {
    return baseSortedTitles.value
  }
  const titleMap = new Map(baseSortedTitles.value.map((title) => [title.id, title]))
  const ordered = orderedIds
    .map((id) => titleMap.get(id))
    .filter((title): title is GroupTitle => !!title)
  return ordered.length === baseSortedTitles.value.length ? ordered : baseSortedTitles.value
})
const titleSortDirty = computed(() =>
  titleOrderIds.value.length === baseSortedTitles.value.length &&
  titleOrderIds.value.some((id, index) => id !== baseSortedTitles.value[index]?.id),
)
const visibleJoinRequests = computed(() =>
  joinRequests.value.filter((item) => item.status === 'PENDING'),
)
const meAsMember = computed(
  () => members.value.find((item) => item.userId === myUserId.value) || null,
)

watch(
  baseSortedTitles,
  (list) => {
    titleOrderIds.value = list.map((title) => title.id)
  },
  { immediate: true },
)

const memberDisplayName = (member: GroupMember) =>
  member.nicknameInGroup ||
  member.displayName ||
  member.nickname ||
  member.username ||
  member.userId

const isOwnerMember = (member: GroupMember) => {
  const ownerId = String(groupInfo.value?.ownerId || '')
  return ownerId && String(member.userId) === ownerId
}

const inviteAuditModeText = (mode?: number) => {
  if (mode === 1) return '邀请需要审批'
  if (mode === 2) return '申请需要审批'
  if (mode === 3) return '邀请和申请都需要审批'
  return '不需要审批'
}

const syncChatSessionMeta = (info?: GroupInfo | null) => {
  if (!info?.id) return
  chatStore.ensureSession({
    id: `group_${info.id}`,
    title: info.remark || info.name,
    avatar: info.avatar || '',
    type: 2,
    subTitle: `${info.memberCount || 0} 人 · ${info.myTitleName || '群成员'}`,
  })
}

const loadAll = async () => {
  loading.value = true
  try {
    const [groupRes, memberRes, titleRes] = await Promise.all([
      socialApi.getGroupInfo(groupId.value),
      socialApi.getGroupMembers(groupId.value),
      socialApi.getGroupTitles(groupId.value),
      contactStore.fetchFriendGroups(),
    ])

    groupInfo.value = groupRes.data
    members.value = memberRes.data || []
    titles.value = titleRes.data || []
    syncChatSessionMeta(groupRes.data)

    groupForm.value = {
      name: groupRes.data?.name || '',
      notice: groupRes.data?.notice || '',
      inviteAuditMode: String(groupRes.data?.inviteAuditMode ?? 0),
    }
    fileConfigForm.value = {
      fileCapacityMb: Number(groupRes.data?.fileCapacityMb || 1024),
      oversizeThresholdMb: Number(groupRes.data?.oversizeThresholdMb || 100),
      tempExpireDays: Number(groupRes.data?.tempExpireDays || 7),
    }

    if (
      (groupRes.data?.myPermissions || []).some(
        (item) => item === 'GROUP_REVIEW_INVITE' || item === 'GROUP_REVIEW_APPLY',
      )
    ) {
      const requestRes = await socialApi.getGroupJoinRequests(groupId.value)
      joinRequests.value = requestRes.data || []
    } else {
      joinRequests.value = []
    }
  } finally {
    loading.value = false
  }
}

const resolveFocus = (raw: unknown): GroupDetailFocus | null => {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
  if (value === 'overview' || value === 'members' || value === 'titles' || value === 'review') {
    return value
  }
  return null
}

const scrollToFocus = async (focus: GroupDetailFocus | null) => {
  if (!focus || loading.value) return
  await nextTick()
  const target = document.getElementById(SECTION_IDS[focus])
  const fallback = document.getElementById(SECTION_IDS.overview)

  if (focus === 'review' && !target) {
    fallback?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const refreshAfterMutation = async () => {
  await Promise.all([loadAll(), contactStore.fetchGroupChats(true)])
  emitGroupUpdated(groupId.value)
}

const openEditDialog = () => {
  groupForm.value = {
    name: groupInfo.value?.name || '',
    notice: groupInfo.value?.notice || '',
    inviteAuditMode: String(groupInfo.value?.inviteAuditMode ?? 0),
  }
  editDialogOpen.value = true
}

const saveGroup = async () => {
  saving.value = true
  try {
    await socialApi.updateGroup(groupId.value, {
      name: groupForm.value.name.trim() || undefined,
      notice: groupForm.value.notice.trim() || undefined,
      inviteAuditMode: Number(groupForm.value.inviteAuditMode),
    })
    toast.success('群资料已更新')
    editDialogOpen.value = false
    await refreshAfterMutation()
  } finally {
    saving.value = false
  }
}

const saveGroupFileConfig = async () => {
  if (!canManageGroupFileStorage.value) return
  const capacity = Number(fileConfigForm.value.fileCapacityMb)
  const threshold = Number(fileConfigForm.value.oversizeThresholdMb)
  const expireDays = Number(fileConfigForm.value.tempExpireDays)

  if (!Number.isFinite(capacity) || capacity < 1) {
    toast.error('群文件总容量需为正整数')
    return
  }
  if (!Number.isFinite(threshold) || threshold < 1) {
    toast.error('超大文件阈值需为正整数')
    return
  }
  if (!Number.isFinite(expireDays) || expireDays < 1) {
    toast.error('请选择要邀请的好友')
    return
  }

  saving.value = true
  try {
    await socialApi.updateGroupFileConfig(groupId.value, {
      fileCapacityMb: Math.trunc(capacity),
      oversizeThresholdMb: Math.trunc(threshold),
      tempExpireDays: Math.trunc(expireDays),
    })
    toast.success('群文件配置已更新')
    await loadAll()
  } finally {
    saving.value = false
  }
}

const toggleInviteUser = (userId: string) => {
  if (selectedInviteUserIds.value.includes(userId)) {
    selectedInviteUserIds.value = selectedInviteUserIds.value.filter((id) => id !== userId)
    return
  }
  selectedInviteUserIds.value = [...selectedInviteUserIds.value, userId]
}

const sendInvite = async () => {
  if (selectedInviteUserIds.value.length === 0) {
    toast.error('请选择要邀请的好友')
    return
  }

  saving.value = true
  try {
    await socialApi.inviteGroupMembers(groupId.value, {
      targetUserIds: selectedInviteUserIds.value,
      reason: inviteReason.value.trim() || undefined,
    })
    toast.success('邀请已提交')
    inviteDialogOpen.value = false
    selectedInviteUserIds.value = []
    inviteReason.value = ''
    await refreshAfterMutation()
  } finally {
    saving.value = false
  }
}

const openNicknameDialog = (member: GroupMember) => {
  editingMember.value = member
  nicknameValue.value = member.nicknameInGroup || ''
  nicknameDialogOpen.value = true
}

const openMyNicknameDialog = () => {
  if (!meAsMember.value) return
  openNicknameDialog(meAsMember.value)
}

const saveNickname = async () => {
  if (!editingMember.value) return
  saving.value = true
  try {
    if (editingMember.value.userId === myUserId.value) {
      await socialApi.updateMyGroupNickname(groupId.value, nicknameValue.value.trim())
    } else {
      await socialApi.updateGroupMemberNickname(
        groupId.value,
        editingMember.value.userId,
        nicknameValue.value.trim(),
      )
    }
    toast.success('群昵称已更新')
    nicknameDialogOpen.value = false
    await refreshAfterMutation()
  } finally {
    saving.value = false
  }
}

const updateTitleForMember = async (member: GroupMember, titleId: string) => {
  await socialApi.updateGroupMemberTitle(groupId.value, member.userId, titleId)
  toast.success('成员头衔已更新')
  await refreshAfterMutation()
}

const removeMember = async (member: GroupMember) => {
  await socialApi.removeGroupMember(groupId.value, member.userId)
  toast.success('成员已移除')
  await refreshAfterMutation()
}

const openCreateTitle = () => {
  editingTitle.value = null
  titleForm.value = {
    name: '',
    sort: (titles.value[titles.value.length - 1]?.sort || 0) + 10,
    permissions: ['GROUP_VIEW'],
  }
  titleDialogOpen.value = true
}

const isOwnerTitle = (title: GroupTitle) => title.systemKey === 'OWNER'

const moveTitle = (titleId: string, direction: -1 | 1) => {
  const currentIndex = titleOrderIds.value.findIndex((id) => id === titleId)
  if (currentIndex < 0) return

  const nextIndex = currentIndex + direction
  if (currentIndex === 0 || nextIndex < 1 || nextIndex >= titleOrderIds.value.length) {
    return
  }

  const next = [...titleOrderIds.value]
  const currentValue = next[currentIndex]
  const targetValue = next[nextIndex]
  if (currentValue === undefined || targetValue === undefined) return
  next[currentIndex] = targetValue
  next[nextIndex] = currentValue
  titleOrderIds.value = next
}

const handleTitleDragStart = (titleId: string) => {
  draggingTitleId.value = titleId
}

const handleTitleDrop = (targetTitleId: string) => {
  const sourceTitleId = draggingTitleId.value
  draggingTitleId.value = null

  if (!sourceTitleId || sourceTitleId === targetTitleId) return

  const sourceIndex = titleOrderIds.value.findIndex((id) => id === sourceTitleId)
  const targetIndex = titleOrderIds.value.findIndex((id) => id === targetTitleId)
  if (sourceIndex < 1 || targetIndex < 1) return

  const next = [...titleOrderIds.value]
  next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, sourceTitleId)
  titleOrderIds.value = next
}

const openEditTitle = (title: GroupTitle) => {
  editingTitle.value = title
  titleForm.value = {
    name: title.name,
    sort: title.sort,
    permissions: [...title.permissions],
  }
  titleDialogOpen.value = true
}

const togglePermission = (permission: GroupPermission) => {
  if (permission === 'GROUP_VIEW') return
  if (titleForm.value.permissions.includes(permission)) {
    titleForm.value.permissions = titleForm.value.permissions.filter((item) => item !== permission)
    return
  }
  titleForm.value.permissions = [...titleForm.value.permissions, permission]
}

const saveTitle = async () => {
  saving.value = true
  try {
    const payload = {
      name: titleForm.value.name.trim(),
      sort: titleForm.value.sort,
      permissions: titleForm.value.permissions,
    }
    if (editingTitle.value) {
      await socialApi.updateGroupTitle(groupId.value, editingTitle.value.id, payload)
      toast.success('头衔已更新')
    } else {
      await socialApi.createGroupTitle(groupId.value, payload)
      toast.success('头衔已创建')
    }
    titleDialogOpen.value = false
    await refreshAfterMutation()
  } finally {
    saving.value = false
  }
}

const setDefaultTitle = async (titleId: string) => {
  await socialApi.setDefaultGroupTitle(groupId.value, titleId)
  toast.success('默认头衔已更新')
  await refreshAfterMutation()
}

const deleteTitle = async (titleId: string) => {
  await socialApi.deleteGroupTitle(groupId.value, titleId)
  toast.success('头衔已删除')
  await refreshAfterMutation()
}

const saveTitleOrder = async () => {
  if (!titleSortDirty.value) return
  await socialApi.sortGroupTitles(groupId.value, titleOrderIds.value)
  toast.success('头衔排序已更新')
  await refreshAfterMutation()
}

const auditRequest = async (requestId: string, approve: boolean) => {
  await socialApi.auditGroupJoinRequest(groupId.value, requestId, { approve })
  toast.success(approve ? '已通过申请' : '已拒绝申请')
  await refreshAfterMutation()
}

onMounted(() => {
  void loadAll().then(() => {
    const focus = resolveFocus(route.query.focus)
    void scrollToFocus(focus)
  })
})

watch(
  () => route.query.focus,
  (value) => {
    const focus = resolveFocus(value)
    void scrollToFocus(focus)
  },
)
</script>

<template>
  <div class="flex flex-col h-full bg-background select-none">
    
    <header
      class="h-14 border-b flex items-center px-4 gap-4 shrink-0 bg-background/80 backdrop-blur-md z-10 sticky top-0"
    >
      <Button variant="ghost" size="icon" @click="router.back()" class="rounded-full no-drag">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <span class="font-semibold text-lg">群资料</span>
    </header>

    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <div v-if="loading" class="text-sm text-muted-foreground p-6">加载中...</div>

      <template v-else-if="groupInfo">
        
        <div
          class="h-56 bg-muted relative transition-all duration-500 bg-cover bg-center"
          :style="{
            backgroundImage: groupInfo?.coverUrl ? `url(${groupInfo.coverUrl})` : 'none',
            backgroundColor: !groupInfo?.coverUrl ? 'hsl(var(--primary) / 0.1)' : '',
          }"
        >
          <div
            v-if="!groupInfo?.coverUrl"
            class="absolute inset-0 bg-linear-to-r from-blue-600/20 via-indigo-500/20 to-purple-500/20"
          ></div>
        </div>

        
        <div class="max-w-5xl mx-auto px-6 -mt-16 relative pb-10" :id="SECTION_IDS.overview">
          <div class="bg-card border rounded-3xl p-8 shadow-2xl">
            <div class="flex flex-col md:flex-row gap-8 items-start">
              
              <div class="relative group mx-auto md:mx-0 shrink-0">
                <Avatar
                  class="h-36 w-36 border-4 border-background shadow-xl hover:scale-105 transition-transform"
                >
                  <AvatarImage :src="groupInfo?.avatar || ''" />
                  <AvatarFallback class="text-4xl bg-primary text-primary-foreground"
                    >群</AvatarFallback
                  >
                </Avatar>
              </div>

              
              <div class="flex-1 space-y-6 w-full mt-2">
                <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div class="space-y-1.5 text-center md:text-left">
                    <div class="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                      <h1 class="text-3xl font-bold tracking-tight">{{ groupInfo?.name }}</h1>
                      <Badge variant="secondary" class="h-5">{{ groupInfo?.memberCount }} 人</Badge>
                      <Badge variant="outline" class="h-5 border-primary/30 text-primary">{{
                        inviteAuditModeText(groupInfo?.inviteAuditMode)
                      }}</Badge>
                    </div>
                  </div>

                  <div class="flex gap-2 justify-center flex-wrap no-drag">
                    <Button
                      variant="outline"
                      @click="openMyNicknameDialog"
                      class="rounded-xl h-10 px-4"
                    >
                      设置群昵称
                    </Button>
                    <Button
                      v-if="canEditGroup"
                      variant="outline"
                      @click="openEditDialog"
                      class="rounded-xl h-10 px-4"
                    >
                      <Pencil class="mr-2 h-4 w-4" />编辑群资料
                    </Button>
                    <Button
                      v-if="canInvite"
                      class="rounded-xl gap-2 h-10 px-6"
                      @click="inviteDialogOpen = true"
                    >
                      <UserPlus class="h-4 w-4" />邀请成员
                    </Button>
                  </div>
                </div>

                <Separator />

                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <InfoItem
                    class="col-span-full"
                    :icon="Info"
                    label="群公告"
                    :value="groupInfo?.notice"
                    :is-self="true"
                    placeholder="暂无群公告"
                  />
                  <InfoItem
                    :icon="ShieldCheck"
                    label="我的头衔"
                    :value="groupInfo?.myTitleName || '未设置'"
                    :is-self="true"
                  />
                  <InfoItem
                    :icon="MessageSquare"
                    label="我的群昵称"
                    :value="groupInfo?.myNicknameInGroup || '未设置'"
                    :is-self="true"
                  />
                </div>
              </div>
            </div>
          </div>

          
          <div class="mt-8 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
            
            <div class="space-y-6">
              <ProfileSection :id="SECTION_IDS.members" title="成员列表" :icon="Users">
                <div class="space-y-3 mt-4">
                  <div
                    v-for="member in members"
                    :key="member.userId"
                    class="flex flex-col gap-3 rounded-xl border border-border/50 p-3 xl:flex-row xl:items-center hover:bg-muted/50 transition-colors"
                  >
                    <div class="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar class="h-10 w-10">
                        <AvatarImage :src="member.avatar || ''" />
                        <AvatarFallback>{{ memberDisplayName(member).slice(0, 1) }}</AvatarFallback>
                      </Avatar>
                      <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="truncate text-sm font-medium">{{
                            memberDisplayName(member)
                          }}</span>
                          <Badge v-if="isOwnerMember(member)" variant="secondary">群主</Badge>
                        </div>
                        <p class="text-xs text-muted-foreground mt-0.5">
                          帐号：{{ member.nickname || member.username || member.userId }}
                        </p>
                        <p class="text-xs text-muted-foreground font-medium mt-0.5">
                          头衔：{{ member.titleName || '未设置' }}
                        </p>
                      </div>
                    </div>

                    <div class="flex flex-wrap gap-2 xl:justify-end">
                      <Button
                        v-if="member.userId === myUserId || canEditOthersNickname"
                        variant="outline"
                        size="sm"
                        @click="openNicknameDialog(member)"
                        class="rounded-lg h-8"
                      >
                        <Pencil class="mr-1 h-3 w-3" />群昵称
                      </Button>

                      <Select
                        v-if="canAssignTitle && !isOwnerMember(member)"
                        :model-value="member.titleId"
                        @update:model-value="
                          (value) => value && updateTitleForMember(member, String(value))
                        "
                      >
                        <SelectTrigger class="h-8 w-28 rounded-lg text-xs">
                          <SelectValue placeholder="设置头衔" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            v-for="title in sortedTitles"
                            :key="title.id"
                            :value="title.id"
                          >
                            {{ title.name }}
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        v-if="canRemoveMember && !isOwnerMember(member)"
                        variant="destructive"
                        size="sm"
                        @click="removeMember(member)"
                        class="rounded-lg h-8"
                      >
                        <Trash2 class="mr-1 h-3 w-3" />移除
                      </Button>
                    </div>
                  </div>
                </div>
              </ProfileSection>
            </div>

            
            <div class="space-y-6">
              <ProfileSection title="我的权限" :icon="ShieldCheck">
                <div class="flex flex-wrap gap-2 mt-4">
                  <Badge
                    v-for="permission in groupInfo.myPermissions"
                    :key="permission"
                    variant="secondary"
                    class="rounded-md"
                  >
                    {{ permissionLabels[permission] || permission }}
                  </Badge>
                  <p v-if="!groupInfo.myPermissions?.length" class="text-xs text-muted-foreground">
                    无特殊权限
                  </p>
                </div>
              </ProfileSection>

              <ProfileSection
                v-if="canReview"
                :id="SECTION_IDS.review"
                title="待审批列表"
                :icon="Bell"
              >
                <div class="space-y-3 mt-4">
                  <div
                    v-for="request in visibleJoinRequests"
                    :key="request.id"
                    class="rounded-xl border border-border/50 p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div class="flex flex-col gap-3">
                      <div class="min-w-0 space-y-1">
                        <div class="flex items-center gap-2">
                          <Badge variant="outline" class="text-[10px] px-1.5 py-0">
                            {{ request.type === 'INVITE' ? '邀请入群' : '申请入群' }}
                          </Badge>
                        </div>
                        <p class="text-xs text-muted-foreground mt-2">
                          发起人：{{
                            request.fromUser?.nickname || request.fromUser?.username || '-'
                          }}
                          <template v-if="request.targetUser">
                            <br />目标：{{
                              request.targetUser.nickname || request.targetUser.username || '-'
                            }}
                          </template>
                        </p>
                        <p class="text-xs text-muted-foreground">
                          理由：{{ request.reason || '无' }}
                        </p>
                      </div>
                      <div class="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          class="h-7 text-xs rounded-lg"
                          @click="auditRequest(request.id, false)"
                          >拒绝</Button
                        >
                        <Button
                          size="sm"
                          class="h-7 text-xs rounded-lg"
                          @click="auditRequest(request.id, true)"
                          >通过</Button
                        >
                      </div>
                    </div>
                  </div>

                  <p
                    v-if="visibleJoinRequests.length === 0"
                    class="text-sm text-muted-foreground text-center py-4"
                  >
                    暂无待审批记录
                  </p>
                </div>
              </ProfileSection>

              <ProfileSection
                :id="SECTION_IDS.titles"
                title="头衔权限"
                :icon="ShieldCheck"
                :show-action="canManageTitles"
                action-text="新建头衔"
                @action="openCreateTitle"
              >
                <div
                  v-if="canManageTitles"
                  class="mb-3 mt-4 flex items-center justify-end"
                >
                  <Button
                    size="sm"
                    class="h-7 rounded-lg text-xs"
                    :disabled="!titleSortDirty"
                    @click="saveTitleOrder"
                  >
                    保存排序
                  </Button>
                </div>
                <div class="space-y-3 mt-4">
                  <div
                    v-for="title in sortedTitles"
                    :key="title.id"
                    class="rounded-xl border border-border/50 p-3 hover:bg-muted/50 transition-colors"
                    :class="canManageTitles && !isOwnerTitle(title) ? 'cursor-move' : ''"
                    :draggable="canManageTitles && !isOwnerTitle(title)"
                    @dragstart="handleTitleDragStart(title.id)"
                    @dragover.prevent
                    @drop="handleTitleDrop(title.id)"
                  >
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-medium">{{ title.name }}</span>
                          <Badge
                            v-if="isOwnerTitle(title)"
                            variant="outline"
                            class="text-[10px] px-1.5 py-0 h-4"
                            >群主</Badge
                          >
                          <Badge
                            v-if="title.isDefault"
                            variant="secondary"
                            class="text-[10px] px-1.5 py-0 h-4"
                            >默认</Badge
                          >
                        </div>
                        <p class="text-[10px] text-muted-foreground mt-0.5">
                          {{ title.memberCount }} 人使用
                        </p>
                      </div>
                      <div class="flex gap-2">
                        <Button
                          v-if="canManageTitles && !isOwnerTitle(title)"
                          variant="ghost"
                          size="sm"
                          class="h-6 px-2 text-[10px]"
                          @click="moveTitle(title.id, -1)"
                        >
                          <ArrowUp class="h-3 w-3" />
                        </Button>
                        <Button
                          v-if="canManageTitles && !isOwnerTitle(title)"
                          variant="ghost"
                          size="sm"
                          class="h-6 px-2 text-[10px]"
                          @click="moveTitle(title.id, 1)"
                        >
                          <ArrowDown class="h-3 w-3" />
                        </Button>
                        <Button
                          v-if="canManageTitles && !title.isDefault && !isOwnerTitle(title)"
                          variant="ghost"
                          size="sm"
                          class="h-6 px-2 text-[10px]"
                          @click="setDefaultTitle(title.id)"
                        >
                          设为默认
                        </Button>
                        <Button
                          v-if="canManageTitles && !isOwnerTitle(title)"
                          variant="ghost"
                          size="sm"
                          class="h-6 px-2 text-[10px]"
                          @click="openEditTitle(title)"
                        >
                          设置
                        </Button>
                        <Button
                          v-if="canManageTitles && !title.isDefault && !isOwnerTitle(title)"
                          variant="ghost"
                          size="sm"
                          class="h-6 px-2 text-[10px] text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          @click="deleteTitle(title.id)"
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-1">
                      <Badge
                        v-for="permission in title.permissions"
                        :key="permission"
                        variant="outline"
                        class="text-[9px] font-normal px-1 py-0 h-4 border-muted-foreground/30"
                      >
                        {{ permissionLabels[permission] || permission }}
                      </Badge>
                    </div>
                  </div>
                </div>
              </ProfileSection>

              <ProfileSection title="群文件配置" :icon="Folder">
                <div class="space-y-4 mt-4">
                  <div class="grid gap-1">
                    <label class="text-xs font-medium text-muted-foreground">总容量 (MB)</label>
                    <Input
                      v-model.number="fileConfigForm.fileCapacityMb"
                      type="number"
                      min="1"
                      class="h-8 text-sm rounded-lg"
                    />
                  </div>
                  <div class="grid gap-1">
                    <label class="text-xs font-medium text-muted-foreground"
                      >超大文件阈值 (MB)</label
                    >
                    <Input
                      v-model.number="fileConfigForm.oversizeThresholdMb"
                      type="number"
                      min="1"
                      class="h-8 text-sm rounded-lg"
                    />
                  </div>
                  <div class="grid gap-1">
                    <label class="text-xs font-medium text-muted-foreground"
                      >临时文件过期时长 (天)</label
                    >
                    <Input
                      v-model.number="fileConfigForm.tempExpireDays"
                      type="number"
                      min="1"
                      class="h-8 text-sm rounded-lg"
                    />
                  </div>

                  <div class="flex items-center justify-between pt-2">
                    <p class="text-[10px] text-muted-foreground">
                      已用容量：{{ groupInfo.usedStorageBytes || 0 }} B
                    </p>
                    <Button
                      v-if="canManageGroupFileStorage"
                      size="sm"
                      class="h-8 rounded-lg text-xs"
                      :disabled="saving"
                      @click="saveGroupFileConfig"
                    >
                      {{ saving ? '保存中...' : '保存配置' }}
                    </Button>
                  </div>
                  <p v-if="!canManageGroupFileStorage" class="text-xs text-muted-foreground">
                    暂无修改配置权限
                  </p>
                </div>
              </ProfileSection>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Modals -->
    <Dialog v-model:open="editDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>编辑群资料</DialogTitle>
          <DialogDescription>更新群名称、公告和审批模式。</DialogDescription>

        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">群名称</label>

            <Input v-model="groupForm.name" maxlength="50" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">群公告</label>
            <Textarea v-model="groupForm.notice" rows="4" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">审批模式</label>
            <Select v-model:model-value="groupForm.inviteAuditMode">
              <SelectTrigger>
                <SelectValue placeholder="选择审批模式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">
                不需要审批</SelectItem>
                <SelectItem value="1">邀请需要审批</SelectItem>
                <SelectItem value="2">申请需要审批</SelectItem>
                <SelectItem value="3">邀请和申请都需要审批</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="editDialogOpen = false">取消</Button>
          <Button :disabled="saving" @click="saveGroup">{{ saving ? '保存中...' : '保存' }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="inviteDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>邀请成员</DialogTitle>
          <DialogDescription>从好友中选择要邀请加入群聊的成员。</DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <Textarea v-model="inviteReason" rows="3" placeholder="邀请理由（可选）" />
          <div class="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
            <button
              v-for="friend in availableInviteOptions"
              :key="friend.id"
              type="button"
              class="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              :class="selectedInviteUserIds.includes(friend.id) ? 'bg-primary/10 text-primary' : ''"
              @click="toggleInviteUser(friend.id)"
            >
              <span class="truncate">{{ friend.label }}</span>
              <span class="text-xs text-muted-foreground">
                {{ selectedInviteUserIds.includes(friend.id) ? '已选' : '' }}
              </span>
            </button>
            <p v-if="availableInviteOptions.length === 0" class="text-sm text-muted-foreground">
              没有可邀请的好友
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="inviteDialogOpen = false">取消</Button>
          <Button :disabled="saving" @click="sendInvite">{{
            saving ? '提交中...' : '提交邀请'
          }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="nicknameDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>设置群昵称</DialogTitle>
          <DialogDescription>
            {{ editingMember ? `为 ${memberDisplayName(editingMember)} 设置群昵称` : '设置群昵称' }}
          </DialogDescription>
        </DialogHeader>
        <Input v-model="nicknameValue" maxlength="32" placeholder="输入群昵称，留空则清除" />
        <DialogFooter>
          <Button variant="outline" @click="nicknameDialogOpen = false">取消</Button>
          <Button :disabled="saving" @click="saveNickname">{{
            saving ? '保存中...' : '保存'
          }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="titleDialogOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ editingTitle ? '编辑头衔' : '新建头衔' }}</DialogTitle>
          <DialogDescription>配置头衔名称、排序和权限范围。</DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium">头衔名称</label>
              <Input v-model="titleForm.name" maxlength="32" placeholder="输入头衔名称" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">排序号（越小越靠前）</label>
              <Input v-model.number="titleForm.sort" type="number" min="0" />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">包含权限</label>
            <div class="flex flex-wrap gap-2 rounded-lg border p-3">
              <button
                v-for="permission in Object.keys(permissionLabels)"
                :key="permission"
                type="button"
                class="rounded-full border px-3 py-1 text-sm transition-colors"
                :class="
                  titleForm.permissions.includes(permission as GroupPermission)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                "
                :disabled="permission === 'GROUP_VIEW'"
                @click="togglePermission(permission as GroupPermission)"
              >
                {{ permissionLabels[permission as GroupPermission] }}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="titleDialogOpen = false">取消</Button>
          <Button :disabled="saving || !titleForm.name.trim()" @click="saveTitle">
            {{ saving ? '保存中...' : '保存' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>


