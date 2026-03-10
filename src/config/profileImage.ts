export type ProfileImageTarget = 'avatar' | 'background'

export interface ProfileImageCropPreset {
  target: ProfileImageTarget
  title: string
  aspect: number
  outputWidth: number
  outputHeight: number
  mimeType: 'image/webp'
  quality: number
  maxSourceSizeMB: number
  minZoom: number
  maxZoom: number
}

export const profileImagePresets: Record<ProfileImageTarget, ProfileImageCropPreset> = {
  avatar: {
    target: 'avatar',
    title: '头像',
    aspect: 1,
    outputWidth: 512,
    outputHeight: 512,
    mimeType: 'image/webp',
    quality: 0.9,
    maxSourceSizeMB: 10,
    minZoom: 1,
    maxZoom: 3,
  },
  background: {
    target: 'background',
    title: '背景',
    aspect: 3,
    outputWidth: 1500,
    outputHeight: 500,
    mimeType: 'image/webp',
    quality: 0.9,
    maxSourceSizeMB: 10,
    minZoom: 1,
    maxZoom: 3,
  },
}

export const resolveProfileImageTarget = (raw: unknown): ProfileImageTarget => {
  const value = String(raw || '').trim().toLowerCase()
  return value === 'background' ? 'background' : 'avatar'
}
