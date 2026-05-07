'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Cloud, CloudUpload, CloudDownload, Trash2, RefreshCw } from 'lucide-react'
import {
  deleteCloudProject,
  listCloudProjects,
  loadProjectFromCloud,
  saveProjectToCloud,
  type CloudProject,
} from '@/lib/cloud-sync'

interface Props {
  open: boolean
  onClose: () => void
}

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'loading' }
  | { kind: 'deleting'; id: number }
  | { kind: 'error'; message: string }
  | { kind: 'done'; message: string }

export function CloudSyncDialog({ open, onClose }: Props) {
  const [projects, setProjects] = useState<CloudProject[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [name, setName] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const refresh = async () => {
    setRefreshing(true)
    try {
      const list = await listCloudProjects()
      setProjects(list)
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message })
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (open) {
      setStatus({ kind: 'idle' })
      refresh()
    }
  }, [open])

  async function handleSave() {
    if (!name.trim()) {
      setStatus({ kind: 'error', message: 'プロジェクト名を入力してください' })
      return
    }
    setStatus({ kind: 'saving' })
    try {
      await saveProjectToCloud(name.trim())
      setStatus({ kind: 'done', message: 'クラウドに保存しました' })
      setName('')
      await refresh()
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message })
    }
  }

  async function handleLoad(id: number) {
    if (
      !confirm(
        'クラウドのプロジェクトを読み込むと、現在の端末のデータに同じ ID のものは上書きされます。続行しますか？',
      )
    )
      return
    setStatus({ kind: 'loading' })
    try {
      await loadProjectFromCloud(id)
      setStatus({ kind: 'done', message: '読込完了。ページを再読み込みしてください' })
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message })
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('このクラウドプロジェクトを削除しますか？(画像/音声ファイルは残ります)')) return
    setStatus({ kind: 'deleting', id })
    try {
      await deleteCloudProject(id)
      setStatus({ kind: 'done', message: '削除しました' })
      await refresh()
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message })
    }
  }

  const busy =
    status.kind === 'saving' || status.kind === 'loading' || status.kind === 'deleting'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud size={20} /> クラウド同期
          </DialogTitle>
          <DialogDescription>
            このプロジェクトを Supabase に丸ごと保存し、別端末からも復元できます
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Save */}
          <div className="border border-border rounded-lg p-4 bg-muted/30">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <CloudUpload size={16} /> このデバイスのデータをクラウドに保存
            </h4>
            <div className="flex flex-col gap-2 md:flex-row">
              <Input
                placeholder="プロジェクト名(例: P丸様風 第1話)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              />
              <Button onClick={handleSave} disabled={busy} className="gap-1">
                <CloudUpload size={14} />
                {status.kind === 'saving' ? '保存中...' : '保存'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              画像・音声は Supabase Storage に、メタデータは anime テーブルに保存されます
            </p>
          </div>

          {/* List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold flex items-center gap-2">
                <CloudDownload size={16} /> クラウドのプロジェクト
              </h4>
              <Button
                size="sm"
                variant="outline"
                onClick={refresh}
                disabled={refreshing || busy}
                className="gap-1"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                更新
              </Button>
            </div>

            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                まだクラウドにプロジェクトがありません
              </p>
            ) : (
              <ul className="space-y-2">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 p-3 bg-background border border-border rounded"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.updated_at).toLocaleString('ja-JP')}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoad(p.id)}
                        disabled={busy}
                        className="gap-1"
                      >
                        <CloudDownload size={14} />
                        読込
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(p.id)}
                        disabled={busy}
                        className="gap-1 text-destructive hover:bg-destructive/20"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {status.kind === 'error' && (
            <p className="text-sm text-destructive">エラー: {status.message}</p>
          )}
          {status.kind === 'done' && (
            <p className="text-sm text-primary">{status.message}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
