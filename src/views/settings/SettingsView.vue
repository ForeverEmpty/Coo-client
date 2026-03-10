<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { FolderOpen, HardDrive } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePlatform } from '@/composables/usePlatform'
import { useChatStore } from '@/stores/chatStore'

const { isElectron } = usePlatform()
const chatStore = useChatStore()

const loading = ref(true)
const saving = ref(false)
const formError = ref('')

const form = reactive({
  directory: '',
  globalLimitMB: 256,
  perChatLimitMB: 32,
})

const validate = () => {
  formError.value = ''
  if (!Number.isFinite(form.globalLimitMB) || form.globalLimitMB <= 0) {
    formError.value = '全局存储上限必须是大于 0 的整数。'
    return false
  }

  if (!Number.isFinite(form.perChatLimitMB) || form.perChatLimitMB <= 0) {
    formError.value = '单会话上限必须是大于 0 的整数。'
    return false
  }

  if (Math.floor(form.perChatLimitMB) > Math.floor(form.globalLimitMB)) {
    formError.value = '单会话上限不能大于全局上限。'
    return false
  }

  return true
}

const loadConfig = async () => {
  if (!isElectron) {
    loading.value = false
    return
  }

  try {
    const config = await chatStore.loadStorageConfig()
    form.directory = config.directory
    form.globalLimitMB = config.globalLimitMB
    form.perChatLimitMB = config.perChatLimitMB
  } catch {
    toast.error('加载聊天存储配置失败')
  } finally {
    loading.value = false
  }
}

const handleChooseDirectory = async () => {
  if (!isElectron) return

  try {
    const selected = await chatStore.chooseStorageDirectory()
    if (!selected) return
    form.directory = selected
  } catch {
    toast.error('选择存储目录失败')
  }
}

const handleSave = async () => {
  if (!isElectron) return
  if (!validate()) return

  saving.value = true
  try {
    const saved = await chatStore.saveStorageConfig({
      directory: form.directory,
      globalLimitMB: Math.floor(form.globalLimitMB),
      perChatLimitMB: Math.floor(form.perChatLimitMB),
    })
    form.directory = saved.directory
    form.globalLimitMB = saved.globalLimitMB
    form.perChatLimitMB = saved.perChatLimitMB
    toast.success('聊天存储设置已保存')
  } catch {
    toast.error('保存聊天存储设置失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadConfig()
})
</script>

<template>
  <div class="h-full overflow-y-auto p-6">
    <div class="mx-auto w-full max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <HardDrive class="h-4 w-4" />
            聊天记录存储
          </CardTitle>
          <CardDescription>
            Electron 端支持本地文件加密缓存，Web 端仅从后端拉取历史消息。
          </CardDescription>
        </CardHeader>

        <CardContent v-if="loading" class="text-sm text-muted-foreground">
          正在加载配置...
        </CardContent>

        <CardContent v-else-if="!isElectron" class="space-y-2 text-sm text-muted-foreground">
          <p>当前运行环境：Web</p>
          <p>聊天消息不会保存在浏览器本地，历史消息将始终通过后端接口获取。</p>
        </CardContent>

        <CardContent v-else class="space-y-5">
          <div class="space-y-2">
            <Label>存储目录</Label>
            <div class="flex items-center gap-2">
              <Input :model-value="form.directory" readonly class="font-mono text-xs" />
              <Button type="button" variant="outline" @click="handleChooseDirectory">
                <FolderOpen class="h-4 w-4" />
                选择目录
              </Button>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <Label for="global-limit">全局上限 (MB)</Label>
              <Input id="global-limit" v-model.number="form.globalLimitMB" type="number" min="1" />
            </div>
            <div class="space-y-2">
              <Label for="per-chat-limit">单会话上限 (MB)</Label>
              <Input
                id="per-chat-limit"
                v-model.number="form.perChatLimitMB"
                type="number"
                min="1"
              />
            </div>
          </div>

          <p v-if="formError" class="text-xs text-destructive">{{ formError }}</p>

          <div class="flex justify-end">
            <Button type="button" :disabled="saving" @click="handleSave">
              {{ saving ? '保存中...' : '保存设置' }}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
