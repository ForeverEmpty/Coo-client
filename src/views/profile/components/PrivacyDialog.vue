<script setup lang="ts">
import { reactive, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { authApi } from '@/api/auth'
import { toast } from 'vue-sonner'
import type { UserInfo } from '@/api/types'

const props = defineProps<{ open: boolean; initialData: UserInfo | null }>()
const emit = defineEmits(['update:open', 'changed'])

const settings = reactive({
  publicGender: true,
  publicBirthday: true,
  publicRegion: true,
  publicJob: true,
  publicMutualFriend: true,
})

watch(
  () => props.open,
  (newVal) => {
    if (newVal && props.initialData) {
      settings.publicGender = props.initialData.publicGender
      settings.publicBirthday = props.initialData.publicBirthday
      settings.publicRegion = props.initialData.publicRegion
      settings.publicJob = props.initialData.publicJob
      settings.publicMutualFriend = props.initialData.publicMutualFriend
    }
  },
)

const togglePrivacy = async (key: keyof typeof settings, val: boolean) => {
  try {
    await authApi.updatePrivacy({ [key]: val })
    settings[key] = val
    emit('changed')
    toast.success('设置已同步')
  } catch {
    // 由 useRequestManager 处理
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="sm:max-w-87.5" aria-describedby="隐私设置">
      <DialogHeader>
        <DialogTitle>隐私设置</DialogTitle>
        <DialogDescription>请在此设置您的隐私选项。</DialogDescription>
      </DialogHeader>
      <div class="space-y-6 py-4">
        <div class="flex items-center justify-between">
          <Label>公开性别</Label>
          <Switch
            :modelValue="settings.publicGender"
            @update:modelValue="(v: boolean) => togglePrivacy('publicGender', v)"
          />
        </div>
        <div class="flex items-center justify-between">
          <Label>公开生日</Label>
          <Switch
            :modelValue="settings.publicBirthday"
            @update:modelValue="(v: boolean) => togglePrivacy('publicBirthday', v)"
          />
        </div>
        <div class="flex items-center justify-between">
          <Label>公开所在地</Label>
          <Switch
            :modelValue="settings.publicRegion"
            @update:modelValue="(v: boolean) => togglePrivacy('publicRegion', v)"
          />
        </div>
        <div class="flex items-center justify-between">
          <Label>公开工作</Label>
          <Switch
            :modelValue="settings.publicJob"
            @update:modelValue="(v: boolean) => togglePrivacy('publicJob', v)"
          />
        </div>
        <div class="flex items-center justify-between">
          <Label>公开共同好友</Label>
          <Switch
            :modelValue="settings.publicMutualFriend"
            @update:modelValue="(v: boolean) => togglePrivacy('publicMutualFriend', v)"
          />
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
