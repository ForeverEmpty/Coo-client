import type { ChatHistoryMessage } from '@/api/types'
import type { ChatUiMessage } from '@/stores/chatStore'
import { randomID } from '@/utils/randomID'

export type GroupSidebarTab = 'members' | 'images' | 'files' | 'manage'

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message || ''
  }
  if (typeof error === 'string') {
    return error
  }
  return ''
}

export const resolveRecallErrorText = (error: unknown, groupChat: boolean) => {
  const message = getErrorMessage(error).trim()
  if (!message) {
    return '撤回失败，请稍后重试'
  }

  if (message.includes('No permission to recall this message')) {
    return groupChat ? '仅群主或超管可撤回他人消息' : '只能撤回自己发送的消息'
  }
  if (message.includes('Recall time window exceeded')) {
    return groupChat
      ? '发送超过 2 分钟的消息不可撤回（群主/超管可撤回他人消息）'
      : '已超过 2 分钟撤回时限'
  }
  if (message.includes('Message not found')) {
    return '消息不存在，可能已被删除'
  }
  if (message.includes('Only sender can recall this message')) {
    return '只能撤回自己发送的消息'
  }
  if (message.includes('Only group chat messages can be recalled')) {
    return '仅支持撤回群聊消息'
  }
  if (message.includes('Only private chat messages can be recalled')) {
    return '仅支持撤回私聊消息'
  }
  return message
}

export const extractGroupId = (chatId: string) =>
  chatId.startsWith('group_') ? chatId.slice(6) : chatId

export const resolveGroupSidebarTab = (raw: unknown): GroupSidebarTab | undefined => {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
  if (value === 'members' || value === 'images' || value === 'files' || value === 'manage') {
    return value
  }
  return undefined
}

export const mapHistoryMessageToUi = (
  item: ChatHistoryMessage,
  currentUserIdValue: string,
): ChatUiMessage => {
  const isOutgoing = item.fromId === currentUserIdValue
  const isRecalled = item.status === 1

  return {
    localId: item.id || randomID(),
    sequence: item.id || undefined,
    fromId: item.fromId,
    toId: item.toId,
    chatType: item.chatType,
    contentType: item.contentType,
    content: isRecalled ? '[已撤回]' : item.content || '',
    url: item.url || '',
    fileName: item.fileName || '',
    fileSize: item.fileSize,
    timestamp: Number(item.timestamp) || Date.now(),
    direction: isOutgoing ? ('out' as const) : ('in' as const),
    status: isRecalled ? ('recalled' as const) : ('sent' as const),
    replyTo: item.replyTo,
  }
}
