<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlatform } from '@/composables/usePlatform'
import { resolveProfileImageTarget } from '@/config/profileImage'
import ProfileImageEditor from '@/views/profile/components/ProfileImageEditor.vue'

const route = useRoute()
const router = useRouter()
const { p, isElectron } = usePlatform()

const target = computed(() => resolveProfileImageTarget(route.query.target))

const handleClose = () => {
  if (isElectron) {
    p.app.close()
  } else if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/profile/me')
  }
}

const handleSuccess = (payload: { target: 'avatar' | 'background'; url: string }) => {
  if (isElectron) {
    p.send('profile-image-updated', payload)
    p.app.close()
    return
  }
  handleClose()
}
</script>

<template>
  <div class="h-full w-full overflow-hidden bg-background select-none">
    <ProfileImageEditor
      :target="target"
      window-mode
      @close="handleClose"
      @success="handleSuccess"
    />
  </div>
</template>
