'use client'

// 保存ステータスの小さなインジケータ。ヘッダ等に置く用。
// - useSaveStatus() を親で管理し、トラッカーで書き込みを包むと自動で状態更新される。
// - 「保存中…」「保存済み HH:MM」「保存失敗」の 3 状態。

import { useCallback, useRef, useState } from 'react'
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function useSaveStatus() {
  const [state, setState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const pendingCountRef = useRef(0)

  // 任意の Promise<T> をラップして、開始時に saving、成功時に saved、失敗時に error に変える。
  const track = useCallback(async function track<T>(promise: Promise<T>): Promise<T> {
    pendingCountRef.current += 1
    setState('saving')
    try {
      const res = await promise
      pendingCountRef.current = Math.max(0, pendingCountRef.current - 1)
      if (pendingCountRef.current === 0) {
        setState('saved')
        setLastSavedAt(new Date())
      }
      return res
    } catch (e) {
      pendingCountRef.current = Math.max(0, pendingCountRef.current - 1)
      setState('error')
      throw e
    }
  }, [])

  return { state, lastSavedAt, track }
}

export function SaveStatusBadge({
  state,
  lastSavedAt,
  className,
}: {
  state: SaveState
  lastSavedAt: Date | null
  className?: string
}) {
  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (state === 'saving') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className ?? ''}`}
        title="IndexedDB に書き込み中"
      >
        <Loader2 size={12} className="animate-spin" />
        保存中…
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs text-destructive ${className ?? ''}`}
        title="書き込みに失敗しました。コンソールを確認してください"
      >
        <AlertTriangle size={12} />
        保存失敗
      </span>
    )
  }
  if (state === 'saved' && lastSavedAt) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className ?? ''}`}
        title={`最終保存: ${lastSavedAt.toLocaleString()}`}
      >
        <CheckCircle2 size={12} className="text-green-600" />
        保存済み {fmt(lastSavedAt)}
      </span>
    )
  }
  return null
}
