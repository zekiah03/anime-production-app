'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Loader2 } from 'lucide-react'
import { onDBChange } from '@/lib/db'
import { loadProjectFromCloud, updateProjectInCloud } from '@/lib/cloud-sync'

const STORAGE_KEY = 'anime-app:current-cloud-project'
const DEBOUNCE_MS = 3000

export type SyncStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface CurrentProject {
  id: number
  name: string
}

interface AutoSyncContextValue {
  current: CurrentProject | null
  setCurrent: (next: CurrentProject | null) => void
  status: SyncStatus
  lastSavedAt: string | null
  errorMessage: string | null
  syncNow: () => Promise<void>
  // 端末を切替えても同じデータで開けるよう、起動時にクラウドから読み込み中かどうか
  initialLoading: boolean
}

const AutoSyncContext = createContext<AutoSyncContextValue | null>(null)

export function useAutoSync(): AutoSyncContextValue {
  const ctx = useContext(AutoSyncContext)
  if (!ctx) throw new Error('useAutoSync must be used within AutoSyncProvider')
  return ctx
}

function loadCurrent(): CurrentProject | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CurrentProject>
    if (typeof parsed.id !== 'number' || typeof parsed.name !== 'string') return null
    return { id: parsed.id, name: parsed.name }
  } catch {
    return null
  }
}

function persistCurrent(value: CurrentProject | null) {
  if (typeof window === 'undefined') return
  if (value === null) {
    window.localStorage.removeItem(STORAGE_KEY)
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  }
}

export function AutoSyncProvider({ children }: { children: ReactNode }) {
  const [current, setCurrentState] = useState<CurrentProject | null>(null)
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState<string>('クラウドから同期中...')

  const timerRef = useRef<number | null>(null)
  const inFlightRef = useRef(false)
  const pendingRef = useRef(false)
  const currentRef = useRef<CurrentProject | null>(null)
  // クラウドから読込中は IDB への書き込みが大量に走るので、
  // その間は auto-sync を抑制する(自分の書き込みで自分のクラウドを上書きしないため)
  const suppressSyncRef = useRef(false)

  // 初回マウント時に localStorage から復元 + クラウドから自動読込
  useEffect(() => {
    let cancelled = false
    const stored = loadCurrent()
    setCurrentState(stored)
    currentRef.current = stored
    if (!stored) {
      setInitialLoading(false)
      return
    }
    // 既存プロジェクトがある: クラウド最新を取りに行って上書きロード。
    // 同セッション内で何度も読み込まないよう sessionStorage で 1 回だけに絞る。
    const RELOAD_FLAG = 'anime-app:initial-load-done'
    if (sessionStorage.getItem(RELOAD_FLAG) === '1') {
      // 既に読み込み済み → そのまま起動
      setInitialLoading(false)
      return
    }
    setLoadProgress(`「${stored.name}」をクラウドから読み込み中...`)
    suppressSyncRef.current = true
    ;(async () => {
      try {
        await loadProjectFromCloud(stored.id)
        sessionStorage.setItem(RELOAD_FLAG, '1')
        // ロード後はコンポーネントが既に古い state で動いているので、ページを再読込して
        // 全体を新しい IDB 状態で初期化する。再読込中も RELOAD_FLAG は session 内で生存する。
        if (!cancelled) {
          window.location.reload()
        }
      } catch (e) {
        console.warn('[anime-app] initial cloud load failed', e)
        setErrorMessage(
          (e as Error).message + ' — ローカルデータで起動します',
        )
        if (!cancelled) {
          suppressSyncRef.current = false
          setInitialLoading(false)
          setStatus('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setCurrent = useCallback((next: CurrentProject | null) => {
    setCurrentState(next)
    currentRef.current = next
    persistCurrent(next)
    setStatus('idle')
    setErrorMessage(null)
  }, [])

  const performSync = useCallback(async () => {
    const target = currentRef.current
    if (!target) return
    if (inFlightRef.current) {
      // 進行中の保存があるので保存後に追いかける
      pendingRef.current = true
      return
    }
    inFlightRef.current = true
    setStatus('saving')
    setErrorMessage(null)
    try {
      const updated = await updateProjectInCloud(target.id)
      setLastSavedAt(updated.updated_at)
      setStatus('saved')
    } catch (e) {
      console.error('[anime-app] auto-sync failed', e)
      setErrorMessage(e instanceof Error ? e.message : '不明なエラー')
      setStatus('error')
    } finally {
      inFlightRef.current = false
      // 保存中に変更が来ていたら即時に追いかける
      if (pendingRef.current) {
        pendingRef.current = false
        scheduleSync()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scheduleSync = useCallback(() => {
    if (!currentRef.current) return
    if (suppressSyncRef.current) return
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
    }
    setStatus('pending')
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void performSync()
    }, DEBOUNCE_MS)
  }, [performSync])

  // DB 変更を監視
  useEffect(() => {
    const unsubscribe = onDBChange(() => {
      if (!currentRef.current) return // クラウドに紐付いてない場合は何もしない
      if (suppressSyncRef.current) return // 起動時のクラウド読込中は無視
      scheduleSync()
    })
    return unsubscribe
  }, [scheduleSync])

  // unmount でタイマー解除
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    await performSync()
  }, [performSync])

  const value: AutoSyncContextValue = {
    current,
    setCurrent,
    status,
    lastSavedAt,
    errorMessage,
    syncNow,
    initialLoading,
  }

  return (
    <AutoSyncContext.Provider value={value}>
      {initialLoading && current && (
        // クラウド読込中のフルスクリーン オーバーレイ。子コンポーネントは既に
        // マウントされていて IDB アクセスを試みるので、視覚的に隠して操作を防ぐ。
        <div className="fixed inset-0 z-[9999] bg-background/95 flex flex-col items-center justify-center gap-3">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-sm text-foreground font-medium">{loadProgress}</p>
          <p className="text-xs text-muted-foreground">
            別端末で編集された最新の状態を取得しています
          </p>
        </div>
      )}
      {children}
    </AutoSyncContext.Provider>
  )
}
