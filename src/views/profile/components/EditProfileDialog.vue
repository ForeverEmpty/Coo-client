<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { authApi } from '@/api/auth'
import { toast } from 'vue-sonner'
import type { UserInfo } from '@/api/types'

const props = defineProps<{
  open: boolean
  initialData: UserInfo | null
}>()

const emit = defineEmits(['update:open', 'success'])

const loading = ref(false)

const form = reactive({
  nickname: '',
  gender: 0,
  birthday: '',
  signature: '',
  region: '',
  job: '',
})

watch(
  () => props.open,
  (newVal) => {
    if (newVal && props.initialData) {
      Object.assign(form, {
        nickname: props.initialData.nickname || '',
        gender: props.initialData.gender ?? 0,
        birthday: props.initialData.birthday || '',
        signature: props.initialData.signature || '',
        region: props.initialData.region || '',
        job: props.initialData.job || '',
      })
    }
  },
)

const handleSubmit = async () => {
  loading.value = true
  try {
    await authApi.updateProfile(form)
    toast.success('个人资料已成功更新')
    emit('success')
    emit('update:open', false)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="sm:max-w-125">
      <DialogHeader>
        <DialogTitle>编辑个人资料</DialogTitle>
        <DialogDescription> 完善您的个人信息，以便其他用户更好地认识您。 </DialogDescription>
      </DialogHeader>

      <div class="grid grid-cols-6 gap-y-6 gap-x-4 py-4 items-center">
        <Label class="text-right font-bold col-span-1">昵称</Label>
        <Input v-model="form.nickname" placeholder="起一个好听的名字" class="col-span-5 no-drag" />

        <Label class="text-right font-bold col-span-1">性别</Label>
        <Select v-model:model-value="form.gender">
          <SelectTrigger class="col-span-2 no-drag">
            <SelectValue placeholder="性别" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="0">保密</SelectItem>
            <SelectItem :value="1">男</SelectItem>
            <SelectItem :value="2">女</SelectItem>
          </SelectContent>
        </Select>

        <Label class="text-right font-bold col-span-1">生日</Label>
        <Input v-model="form.birthday" type="date" class="col-span-2 w-full no-drag" />

        <Label class="text-right font-bold col-span-1">所在地</Label>
        <Input v-model="form.region" placeholder="例如：北京 朝阳" class="col-span-5 no-drag" />

        <Label class="text-right font-bold col-span-1">职业</Label>
        <Input v-model="form.job" placeholder="例如：全栈工程师" class="col-span-5 no-drag" />

        <Label class="text-right font-bold col-span-1 self-start mt-2">签名</Label>
        <Textarea
          v-model="form.signature"
          placeholder="编辑个性签名..."
          class="col-span-5 resize-none h-24 no-drag"
        />
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)" class="no-drag">取消</Button>
        <Button :disabled="loading" @click="handleSubmit" class="no-drag min-w-24">
          <span v-if="loading">正在保存...</span>
          <span v-else>确认保存</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
input[type='date']::-webkit-calendar-picker-indicator {
  cursor: pointer;
  filter: opacity(0.5);
}
input[type='date']::-webkit-calendar-picker-indicator:hover {
  filter: opacity(1);
}
</style>
