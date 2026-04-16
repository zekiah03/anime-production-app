'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Music, Users, MessageSquare, Film, Plus, Layers } from 'lucide-react'
import type { Character } from '@/types/db'
import { getAllCharacters, getCounts } from '@/lib/db'

export default function Dashboard() {
  const [counts, setCounts] = useState({
    characters: 0,
    audio_files: 0,
    dialogues: 0,
    scenes: 0,
    illustrations: 0,
  })
  const [recentCharacters, setRecentCharacters] = useState<Character[]>([])

  useEffect(() => {
    Promise.all([getCounts(), getAllCharacters()])
      .then(([c, chars]) => {
        setCounts(c)
        setRecentCharacters(chars.slice(0, 5))
      })
      .catch((e) => console.error('[anime-app] dashboard load failed', e))
  }, [])

  return (
    <div className="flex h-screen bg-background">
      {/* サイドバー */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-sidebar-primary">アニメ制作</h1>
          <p className="text-sm text-muted-foreground mt-1">制作支援ツール</p>
        </div>

        <nav className="space-y-2">
          <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-sidebar-primary/20 text-sidebar-primary font-medium">
            <Film size={20} />
            ダッシュボード
          </Link>
          <Link href="/characters" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Users size={20} />
            キャラクター
          </Link>
          <Link href="/illustrations" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Layers size={20} />
            イラスト
          </Link>
          <Link href="/audio" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Music size={20} />
            音声
          </Link>
          <Link href="/dialogues" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <MessageSquare size={20} />
            セリフ
          </Link>
          <Link href="/storyboard" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Film size={20} />
            ストーリーボード
          </Link>
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">ダッシュボード</h2>
            <p className="text-muted-foreground">アニメプロジェクトを管理しましょう</p>
          </div>

          {/* クイックアクションカード */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
            <Link href="/characters">
              <Card className="bg-card border-border hover:border-primary/50 transition p-6 cursor-pointer h-full">
                <div className="flex items-center justify-between mb-4">
                  <Users className="text-primary" size={24} />
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                    <Plus size={16} />
                  </Button>
                </div>
                <h3 className="font-semibold text-foreground">キャラクター</h3>
                <p className="text-sm text-muted-foreground mt-1">新規作成</p>
              </Card>
            </Link>

            <Link href="/illustrations">
              <Card className="bg-card border-border hover:border-primary/50 transition p-6 cursor-pointer h-full">
                <div className="flex items-center justify-between mb-4">
                  <Layers className="text-primary" size={24} />
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                    <Plus size={16} />
                  </Button>
                </div>
                <h3 className="font-semibold text-foreground">イラスト</h3>
                <p className="text-sm text-muted-foreground mt-1">レイヤー管理</p>
              </Card>
            </Link>

            <Link href="/audio">
              <Card className="bg-card border-border hover:border-primary/50 transition p-6 cursor-pointer h-full">
                <div className="flex items-center justify-between mb-4">
                  <Music className="text-accent" size={24} />
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                    <Plus size={16} />
                  </Button>
                </div>
                <h3 className="font-semibold text-foreground">音声を録音</h3>
                <p className="text-sm text-muted-foreground mt-1">新規追加</p>
              </Card>
            </Link>

            <Link href="/dialogues">
              <Card className="bg-card border-border hover:border-primary/50 transition p-6 cursor-pointer h-full">
                <div className="flex items-center justify-between mb-4">
                  <MessageSquare className="text-primary" size={24} />
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                    <Plus size={16} />
                  </Button>
                </div>
                <h3 className="font-semibold text-foreground">セリフを作成</h3>
                <p className="text-sm text-muted-foreground mt-1">新規追加</p>
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
                <h3 className="font-semibold text-foreground">シーンを作成</h3>
                <p className="text-sm text-muted-foreground mt-1">新規追加</p>
              </Card>
            </Link>
          </div>

          {/* 最近の活動セクション */}
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
                    <p className="text-sm text-muted-foreground">イラスト数</p>
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
