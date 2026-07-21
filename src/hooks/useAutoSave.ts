import { useState, useEffect, useRef, useCallback } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useAutoSave({
  dirty,
  onSave,
  delay = 1500,
  enabled = true,
}: {
  dirty: boolean
  onSave: () => Promise<void>
  delay?: number
  enabled?: boolean
}) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const save = useCallback(async () => {
    setStatus('saving')
    try {
      await onSaveRef.current()
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (!dirty || !enabled) return
    setStatus('saving')
    const timer = setTimeout(save, delay)
    return () => clearTimeout(timer)
  }, [dirty, enabled, delay, save])

  useEffect(() => {
    if (status === 'saved' || status === 'error') {
      const timer = setTimeout(() => setStatus('idle'), 3000)
      return () => clearTimeout(timer)
    }
  }, [status])

  return { status, save }
}
