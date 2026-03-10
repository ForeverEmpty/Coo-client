const GROUP_UPDATED_EVENT = 'coo:group-updated'

export const emitGroupUpdated = (groupId: string) => {
  if (!groupId || typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<{ groupId: string }>(GROUP_UPDATED_EVENT, {
      detail: { groupId },
    }),
  )
}

export const onGroupUpdated = (handler: (groupId: string) => void) => {
  if (typeof window === 'undefined') return () => {}

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ groupId?: string }>).detail
    const groupId = String(detail?.groupId || '')
    if (!groupId) return
    handler(groupId)
  }

  window.addEventListener(GROUP_UPDATED_EVENT, listener)
  return () => window.removeEventListener(GROUP_UPDATED_EVENT, listener)
}
