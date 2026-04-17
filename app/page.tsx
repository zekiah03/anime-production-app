'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Film, Plus, Mountain, Download, Upload, Package } from 'lucide-react'
import type { Character } from '@/types/db'
import { getAllCharacters, getCounts } from '@/lib/db'
import { Sidebar } from '@/components/sidebar'
import {
  exportProject,
  importProject,
  makeExportFilename,
  triggerDownload,
  type ImportResult,
} from '@/lib/project-export-import'

export default function Dashboard() {
  const [counts, setCounts] = useState({
    characters: 0,
    audio_files: 0,
    dialogues: 0,
    scenes: 0,
    illustrations: 0,
  })
  const [recentCharacters, setRecentCharacters] = useState<Character[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [lastImport, setLastImport] = useState<ImportResult | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    Promise.all([getCounts(), getAllCharacters()])
      .then(([c, chars]) => {
        setCounts(c)
        setRecentCharacters(chars.slice(0, 5))
      })
      .catch((e) => console.error('[anime-app] dashboard load failed', e))
  }, [])

  async function handleExport() {
    if (isExporting) return
    setIsExporting(true)
    try {
      const blob = await exportProject()
      triggerDownload(blob, makeExportFilename())
    } catch (e) {
      console.error('[anime-app] export failed', e)
      alert('エクスポートに失敗しました: ' + (e as Error).message)
    } finally {
      setIsExporting(false)
    }
  }

  async function handleImport(file: File | null) {
    if (!file || isImporting) return
    if (!confirm('インポートすると現在のデータは全て上書きされます。続けますか?')) return
    setIsImporting(true)
    try {
      const result = await importProject(file, { clearExisting: true })
      setLastImport(result)
      // 統計情報を再読み込み
      const [c, chars] = await Promise.all([getCounts(), getAllCharacters()])
      setCounts(c)
      setRecentCharacters(chars.slice(0, 5))
      alert(
        `インポート完了。${Object.entries(result.counts)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `${k}:${n}`)
          .join(', ')}`,
      )
    } catch (e) {
      console.error('[anime-app] import failed', e)
      alert('インポートに失敗しました: ' + (e as Error).message)
    } finally {
      setIsImporting(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">ダッシュボード</h2>
            <p className="text-muted-foreground">アニメプロジェクトを管理しましょう</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <Link href="/characters">
              <Card className="bg-card border-border hover:border-primary/50 transition p-6 cursor-pointer h-full">
                <div className="flex items-center justify-between mb-4">
                  <Users className="text-primary" size={24} />
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                    <Plus size={16} />
                  </Button>
                </div>
                <h3 className="font-semibold text-foreground">キャラクター</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  画像・表情・音声・セリフをまとめて管理
                </p>
              </Card>
            </Link>

            <Link href="/environment">
              <Card className="bg-card border-border hover:border-primary/50 transition p-6 cursor-pointer h-full">
                <div className="flex items-center justify-between mb-4">
                  <Mountain className="text-primary" size={24} />
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                    <Plus size={16} />
                  </Button>
                </div>
                <h3 className="font-semibold text-foreground">環境</h3>
                <p className="text-sm text-muted-foreground mt-1">背景・小物など非キャラ素材</p>
              </Card>
            </Link>

            <Link href="/storyboard">
              <Card className="bg-card border-border hover:border-primary/50 transition p-6 cursor-pointer h-full">
                <div className="flex items-center justify-between mb-4">
                  <Film className="text-accent" size={24} />
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                    <Plus size={16} />
                  </Button>
                </div>
                <h3 className="font-semibold text-foreground">ストーリーボード</h3>
                <p className="text-sm text-muted-foreground mt-1">シーン構成と通し再生</p>
              </Card>
            </Link>
          </div>

          {/* プロジェクト(端末間移行 / バックアップ) */}
          <Card className="bg-card border-border p-6 mb-6">
            <div className="flex items-start gap-4 flex-wrap">
              <Package className="text-primary mt-1 flex-shrink-0" size={24} />
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground">プロジェクト(端末間移行)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  全キャラ・表情・音声・セリフ・シーン・BGM・SE・背景を zip 1ファイルに
                  まとめて書き出し、もう一方の端末で読み込めます。OneDrive や Dropbox の
                  同期フォルダに保存するとバックアップも兼ねられます。
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={(e) => handleImport(e.target.files?.[0] ?? null)}
                />
                <Button
                  variant="outline"
                  onClick={() => importInputRef.current?.click()}
                  disabled={isImporting}
                  className="gap-2"
                  title="zip を選んで、現在のデータを上書きしてインポート"
                >
                  <Upload size={16} />
                  {isImporting ? '読み込み中…' : 'インポート'}
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="gap-2"
                  title="現在のデータを zip で書き出す"
                >
                  <Download size={16} />
                  {isExporting ? '書き出し中…' : 'エクスポート'}
                </Button>
              </div>
            </div>
            {lastImport && (
              <p className="text-xs text-muted-foreground mt-3">
                最後のインポート: {new Date(lastImport.manifest.exported_at).toLocaleString('ja-JP')}
                の書き出し / {Object.values(lastImport.counts).reduce((a, b) => a + b, 0)} 件を読み込み
              </p>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-card border-border p-6">
                <h3 className="text-xl font-semibold text-foreground mb-4">最近のキャラクター</h3>
                <div className="space-y-3">
                  {recentCharacters.length === 0 ? (
                    <div className="flex items-center justify-between p-4 bg-background rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">キャラクター未作成</p>
                        <p className="text-sm text-muted-foreground">最初のキャラクターを作成してください</p>
                      </div>
                    </div>
                  ) : (
                    recentCharacters.map((c) => (
                      <Link
                        key={c.id}
                        href="/characters"
                        className="flex items-center justify-between p-4 bg-background rounded-lg hover:bg-primary/10 transition"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{c.name}</p>
                          {c.description && (
                            <p className="text-sm text-muted-foreground truncate">{c.description}</p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex-shrink-0 ml-4">
                          {new Date(c.created_at).toLocaleDateString('ja-JP')}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <div>
              <Card className="bg-card border-border p-6">
                <h3 className="text-xl font-semibold text-foreground mb-4">統計情報</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">キャラクター数</p>
                    <p className="text-2xl font-bold text-primary">{counts.characters}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">環境素材</p>
                    <p className="text-2xl font-bold text-accent">{counts.illustrations}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">音声ファイル</p>
                    <p className="text-2xl font-bold text-primary">{counts.audio_files}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">セリフ数</p>
                    <p className="text-2xl font-bold text-accent">{counts.dialogues}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">シーン数</p>
                    <p className="text-2xl font-bold text-primary">{counts.scenes}</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
