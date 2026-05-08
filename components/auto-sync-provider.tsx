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
import { onDBChange } from '@/lib/db'
import { updateProjectInCloud } from '@/lib/cloud-sync'

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

  const timerRef = useRef<number | null>(null)
  const inFlightRef = useRef(false)
  const pendingRef = useRef(false)
  const currentRef = useRef<CurrentProject | null>(null)

  // 初回マウント時に localStorage から復元
  useEffect(() => {
    const stored = loadCurrent()
    setCurrentState(stored)
    currentRef.current = stored
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
  }

  return <AutoSyncContext.Provider value={value}>{children}</AutoSyncContext.Provider>
}
