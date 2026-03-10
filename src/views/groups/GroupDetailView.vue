<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ArrowLeft, Crown, File as FileIcon, Images, Pencil, Shield, Trash2, UserPlus, Users } from 'lucide-vue-next'
import { socialApi } from '@/api/social'
import type { GroupInfo, GroupJoinRequest, GroupMember, GroupPermission, GroupTitle } from '@/api/types'
import { useChatStore } from '@/stores/chatStore'
import { useContactStore } from '@/stores/contactStore'
import { useUserStore } from '@/stores/userStore'
import { emitGroupUpdated } from '@/utils/groupSync'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
type GroupSharedTab = 'images' | 'files'
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
  GROUP_SET_SUPER_ADMIN: '设置超管',
  GROUP_TRANSFER_OWNER: '转让群主',
  GROUP_EDIT_MEMBER_NICKNAME: '修改成员群昵称',
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
  () => permissionSet.value.has('GROUP_REVIEW_INVITE') || permissionSet.value.has('GROUP_REVIEW_APPLY'),
)
const canEditOthersNickname = computed(() => permissionSet.value.has('GROUP_EDIT_MEMBER_NICKNAME'))
const canAssignTitle = computed(() => permissionSet.value.has('GROUP_ASSIGN_TITLE'))
const canRemoveMember = computed(() => permissionSet.value.has('GROUP_REMOVE_MEMBER'))
const isOwner = computed(() => groupInfo.value?.myRole === 1)
const canSetSuperAdmin = computed(() => isOwner.value || permissionSet.value.has('GROUP_SET_SUPER_ADMIN'))

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

const sortedTitles = computed(() => [...titles.value].sort((a, b) => a.sort - b.sort))
const visibleJoinRequests = computed(() => joinRequests.value.filter((item) => item.status === 'PENDING'))
const meAsMember = computed(
  () => members.value.find((item) => item.userId === myUserId.value) || null,
)

const memberDisplayName = (member: GroupMember) =>
  member.nicknameInGroup || member.displayName || member.nickname || member.username || member.userId

const roleText = (role?: number) => {
  if (role === 1) return '群主'
  if (role === 2) return '超级管理员'
  return '成员'
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

    if ((groupRes.data?.myPermissions || []).some((item) => item === 'GROUP_REVIEW_INVITE' || item === 'GROUP_REVIEW_APPLY')) {
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
  const value = String(raw || '').trim().toLowerCase()
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

const openGroupSharedTab = (tab: GroupSharedTab) => {
  if (!groupInfo.value) return
  const sessionId = `group_${groupId.value}`
  chatStore.setActiveChat({
    id: sessionId,
    title: groupInfo.value.remark || groupInfo.value.name || sessionId,
    avatar: groupInfo.value.avatar || '',
    type: 2,
    subTitle: `${groupInfo.value.memberCount || 0} 人 · ${groupInfo.value.myTitleName || '群成员'}`,
  })
  void router.push({
    path: '/chat',
    query: {
      groupId: groupId.value,
      sidebarTab: tab,
    },
  })
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

const updateRole = async (member: GroupMember, role: number) => {
  await socialApi.updateGroupMemberRole(groupId.value, member.userId, role)
  toast.success('成员角色已更新')
  await refreshAfterMutation()
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
  <div class="h-full overflow-y-auto p-6">
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" @click="router.back()">
          <ArrowLeft class="h-5 w-5" />
        </Button>
        <span class="text-xl font-semibold">群资料</span>
      </div>

      <div v-if="loading" class="text-sm text-muted-foreground">加载中...</div>

      <template v-else-if="groupInfo">
        <Card :id="SECTION_IDS.overview">
          <CardContent class="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
            <div class="flex items-start gap-4">
              <Avatar class="h-20 w-20 rounded-2xl">
                <AvatarImage :src="groupInfo.avatar || ''" />
                <AvatarFallback class="rounded-2xl text-lg">群</AvatarFallback>
              </Avatar>
              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <h1 class="text-2xl font-bold">{{ groupInfo.name }}</h1>
                  <Badge variant="secondary">{{ groupInfo.memberCount }} 人</Badge>
                  <Badge variant="outline">{{ inviteAuditModeText(groupInfo.inviteAuditMode) }}</Badge>
                </div>
                <p class="max-w-3xl text-sm text-muted-foreground">
                  {{ groupInfo.notice || '暂无群公告' }}
                </p>
                <div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>我的身份：{{ roleText(groupInfo.myRole) }}</span>
                  <span>我的头衔：{{ groupInfo.myTitleName || '未设置' }}</span>
                  <span>我的群昵称：{{ groupInfo.myNicknameInGroup || '未设置' }}</span>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <Button variant="outline" @click="openMyNicknameDialog">设置我的群昵称</Button>
              <Button variant="outline" @click="openGroupSharedTab('images')">
                <Images class="mr-2 h-4 w-4" />共享图片
              </Button>
              <Button variant="outline" @click="openGroupSharedTab('files')">
                <FileIcon class="mr-2 h-4 w-4" />共享文件
              </Button>
              <Button v-if="canEditGroup" variant="outline" @click="openEditDialog">编辑群资料</Button>
              <Button v-if="canInvite" @click="inviteDialogOpen = true">
                <UserPlus class="mr-2 h-4 w-4" />邀请成员
              </Button>
            </div>
          </CardContent>
        </Card>

        <div class="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card :id="SECTION_IDS.members">
            <CardHeader>
              <CardTitle>成员列表</CardTitle>
            </CardHeader>
            <CardContent class="space-y-3">
              <div
                v-for="member in members"
                :key="member.userId"
                class="flex flex-col gap-3 rounded-lg border p-3 xl:flex-row xl:items-center"
              >
                <div class="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar class="h-10 w-10">
                    <AvatarImage :src="member.avatar || ''" />
                    <AvatarFallback>{{ memberDisplayName(member).slice(0, 1) }}</AvatarFallback>
                  </Avatar>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="truncate text-sm font-medium">{{ memberDisplayName(member) }}</span>
                      <Badge v-if="member.role === 1" variant="secondary">
                        <Crown class="mr-1 h-3 w-3" />群主
                      </Badge>
                      <Badge v-else-if="member.role === 2" variant="secondary">
                        <Shield class="mr-1 h-3 w-3" />超管
                      </Badge>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      账号昵称：{{ member.nickname || member.username || member.userId }}
                    </p>
                    <p class="text-xs text-muted-foreground">头衔：{{ member.titleName || '未设置' }}</p>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2 xl:justify-end">
                  <Button
                    v-if="member.userId === myUserId || canEditOthersNickname"
                    variant="outline"
                    size="sm"
                    @click="openNicknameDialog(member)"
                  >
                    <Pencil class="mr-1 h-3.5 w-3.5" />群昵称
                  </Button>

                  <Select
                    v-if="canAssignTitle && member.role !== 1"
                    :model-value="member.titleId"
                    @update:model-value="(value) => value && updateTitleForMember(member, String(value))"
                  >
                    <SelectTrigger class="h-8 w-36">
                      <SelectValue placeholder="设置头衔" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="title in sortedTitles" :key="title.id" :value="title.id">
                        {{ title.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    v-if="canSetSuperAdmin && member.role !== 1"
                    variant="outline"
                    size="sm"
                    @click="updateRole(member, member.role === 2 ? 3 : 2)"
                  >
                    {{ member.role === 2 ? '取消超管' : '设为超管' }}
                  </Button>

                  <Button
                    v-if="canRemoveMember && member.role !== 1"
                    variant="destructive"
                    size="sm"
                    @click="removeMember(member)"
                  >
                    <Trash2 class="mr-1 h-3.5 w-3.5" />移除
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div class="space-y-6">
            <Card :id="SECTION_IDS.titles">
              <CardHeader class="flex flex-row items-center justify-between">
                <CardTitle>头衔权限</CardTitle>
                <Button v-if="canManageTitles" size="sm" @click="openCreateTitle">新建头衔</Button>
              </CardHeader>
              <CardContent class="space-y-3">
                <div v-for="title in sortedTitles" :key="title.id" class="rounded-lg border p-3">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-medium">{{ title.name }}</span>
                        <Badge v-if="title.isDefault" variant="secondary">默认</Badge>
                      </div>
                      <p class="text-xs text-muted-foreground">{{ title.memberCount }} 人使用</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <Button
                        v-if="canManageTitles && !title.isDefault"
                        variant="outline"
                        size="sm"
                        @click="setDefaultTitle(title.id)"
                      >
                        设为默认
                      </Button>
                      <Button v-if="canManageTitles" variant="outline" size="sm" @click="openEditTitle(title)">
                        编辑
                      </Button>
                      <Button
                        v-if="canManageTitles && !title.isDefault"
                        variant="destructive"
                        size="sm"
                        @click="deleteTitle(title.id)"
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <Badge v-for="permission in title.permissions" :key="permission" variant="outline">
                      {{ permissionLabels[permission] || permission }}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>我的权限</CardTitle>
              </CardHeader>
              <CardContent class="flex flex-wrap gap-2">
                <Badge v-for="permission in groupInfo.myPermissions" :key="permission" variant="secondary">
                  {{ permissionLabels[permission] || permission }}
                </Badge>
              </CardContent>
            </Card>

            <Card v-if="canReview" :id="SECTION_IDS.review">
              <CardHeader>
                <CardTitle>待审批列表</CardTitle>
              </CardHeader>
              <CardContent class="space-y-3">
                <div
                  v-for="request in visibleJoinRequests"
                  :key="request.id"
                  class="rounded-lg border p-3"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0 space-y-1">
                      <p class="text-sm font-medium">
                        {{ request.type === 'INVITE' ? '邀请入群' : '申请入群' }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        发起人：{{ request.fromUser?.nickname || request.fromUser?.username || '-' }}
                        <template v-if="request.targetUser">
                          · 目标：{{ request.targetUser.nickname || request.targetUser.username || '-' }}
                        </template>
                      </p>
                      <p class="text-xs text-muted-foreground">理由：{{ request.reason || '无' }}</p>
                    </div>
                    <div class="flex gap-2">
                      <Button size="sm" variant="outline" @click="auditRequest(request.id, false)">拒绝</Button>
                      <Button size="sm" @click="auditRequest(request.id, true)">通过</Button>
                    </div>
                  </div>
                </div>

                <p v-if="visibleJoinRequests.length === 0" class="text-sm text-muted-foreground">
                  暂无待审批记录
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </template>
    </div>

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
                <SelectItem value="0">不需要审批</SelectItem>
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
          <Button :disabled="saving" @click="sendInvite">{{ saving ? '提交中...' : '提交邀请' }}</Button>
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
          <Button :disabled="saving" @click="saveNickname">{{ saving ? '保存中...' : '保存' }}</Button>
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
              <label class="text-sm font-medium">排序</label>
              <Input v-model.number="titleForm.sort" type="number" min="0" />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">权限</label>
            <div class="flex flex-wrap gap-2 rounded-lg border p-3">
              <button
                v-for="permission in Object.keys(permissionLabels) as GroupPermission[]"
                :key="permission"
                type="button"
                class="rounded-full border px-3 py-1 text-sm transition-colors"
                :class="
                  titleForm.permissions.includes(permission)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                "
                :disabled="permission === 'GROUP_VIEW'"
                @click="togglePermission(permission)"
              >
                {{ permissionLabels[permission] }}
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

