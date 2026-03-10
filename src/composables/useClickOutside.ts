import { onBeforeUnmount, onMounted, type Ref, unref } from 'vue'

type MaybeElement = HTMLElement | null | undefined
type ElementRef = Ref<MaybeElement>
type TargetLike = MaybeElement | ElementRef
type TargetInput = TargetLike | TargetLike[] | (() => TargetLike | TargetLike[])

interface UseClickOutsideOptions {
  enabled?: boolean | Ref<boolean> | (() => boolean)
  event?: 'pointerdown' | 'mousedown' | 'click'
  capture?: boolean
}

const toArray = (value: TargetLike | TargetLike[]) => (Array.isArray(value) ? value : [value])

const resolveElement = (target: TargetLike): MaybeElement => {
  if (!target) return null
  if (target instanceof HTMLElement) return target
  return target.value ?? null
}

const resolveTargets = (target: TargetInput): HTMLElement[] => {
  const raw = typeof target === 'function' ? target() : target
  return toArray(raw).map(resolveElement).filter((item): item is HTMLElement => item instanceof HTMLElement)
}

const resolveEnabled = (enabled: UseClickOutsideOptions['enabled']) => {
  if (typeof enabled === 'function') return enabled()
  if (typeof enabled === 'object' && enabled && 'value' in enabled) return !!enabled.value
  if (typeof enabled === 'boolean') return enabled
  return true
}

export const useClickOutside = (
  target: TargetInput,
  handler: (event: MouseEvent | PointerEvent) => void,
  options: UseClickOutsideOptions = {},
) => {
  const eventName = options.event || 'pointerdown'
  const useCapture = options.capture ?? true

  const listener = (event: MouseEvent | PointerEvent) => {
    if (!resolveEnabled(unref(options.enabled))) return

    const elements = resolveTargets(target)
    if (elements.length === 0) return

    const targetNode = event.target as Node | null
    const path: EventTarget[] =
      typeof event.composedPath === 'function' ? event.composedPath() : []
    const isInside = elements.some((el) => {
      if (path.length > 0 && path.includes(el)) return true
      return !!targetNode && el.contains(targetNode)
    })

    if (isInside) return
    handler(event)
  }

  onMounted(() => {
    document.addEventListener(eventName, listener as EventListener, useCapture)
  })

  onBeforeUnmount(() => {
    document.removeEventListener(eventName, listener as EventListener, useCapture)
  })
}
