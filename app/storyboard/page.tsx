'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Music, Users, MessageSquare, Film, Plus, Trash2, Edit2, GripVertical } from 'lucide-react'
import type { Scene, Dialogue, SceneWithDialogues } from '@/types/db'

export default function StoryboardPage() {
  // TODO: DBを組んだらここをfetch等に差し替える
  const [scenes, setScenes] = useState<SceneWithDialogues[]>([])
  const [dialogues] = useState<Dialogue[]>([])
  const [showSceneForm, setShowSceneForm] = useState(false)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [sceneFormData, setSceneFormData] = useState({ title: '', description: '' })
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [dialogueToAdd, setDialogueToAdd] = useState('')
  const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null)

  function handleAddScene(e: React.FormEvent) {
    e.preventDefault()
    if (!sceneFormData.title.trim()) return

    const now = new Date().toISOString()
    const maxOrder = scenes.length > 0 ? Math.max(...scenes.map((s) => s.order_index)) : -1

    if (editingSceneId) {
      setScenes((prev) =>
        prev.map((s) =>
          s.id === editingSceneId
            ? {
                ...s,
                title: sceneFormData.title,
                description: sceneFormData.description || null,
                updated_at: now,
              }
            : s,
        ),
      )
      setEditingSceneId(null)
    } else {
      const newScene: SceneWithDialogues = {
        id: crypto.randomUUID(),
        title: sceneFormData.title,
        description: sceneFormData.description || null,
        order_index: maxOrder + 1,
        created_at: now,
        updated_at: now,
        dialogues: [],
      }
      setScenes((prev) => [...prev, newScene])
    }

    setSceneFormData({ title: '', description: '' })
    setShowSceneForm(false)
  }

  function handleDeleteScene(id: string) {
    if (!confirm('このシーンを削除してよろしいですか？')) return
    setScenes((prev) => prev.filter((s) => s.id !== id))
  }

  function handleAddDialogueToScene(dialogueId: string) {
    if (!selectedSceneId) return
    const now = new Date().toISOString()

    setScenes((prev) =>
      prev.map((s) => {
        if (s.id !== selectedSceneId) return s
        const maxOrder = s.dialogues.reduce((max, d) => Math.max(max, d.order_index), -1)
        const dialogue = dialogues.find((d) => d.id === dialogueId) ?? null
        return {
          ...s,
          dialogues: [
            ...s.dialogues,
            {
              id: crypto.randomUUID(),
              scene_id: selectedSceneId,
              dialogue_id: dialogueId,
              order_index: maxOrder + 1,
              created_at: now,
              dialogue,
            },
          ],
        }
      }),
    )
    setDialogueToAdd('')
  }

  function handleRemoveDialogue(sceneDialogueId: string) {
    setScenes((prev) =>
      prev.map((s) => ({
        ...s,
        dialogues: s.dialogues.filter((d) => d.id !== sceneDialogueId),
      })),
    )
  }

  function handleReorderScenes(from: number, to: number) {
    setScenes((prev) => {
      const reordered = [...prev]
      const [moved] = reordered.splice(from, 1)
      reordered.splice(to, 0, moved)
      return reordered.map((s, i) => ({ ...s, order_index: i }))
    })
  }

  function handleEditScene(scene: Scene) {
    setSceneFormData({ title: scene.title || '', description: scene.description || '' })
    setEditingSceneId(scene.id)
    setShowSceneForm(true)
  }

  return (
    <div className="flex h-screen bg-background">
      {/* サイドバー */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-sidebar-primary">アニメ制作</h1>
          <p className="text-sm text-muted-foreground mt-1">制作支援ツール</p>
        </div>

        <nav className="space-y-2">
          <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Film size={20} />
            ダッシュボード
          </Link>
          <Link href="/characters" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Users size={20} />
            キャラクター
          </Link>
          <Link href="/audio" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Music size={20} />
            音声
          </Link>
          <Link href="/dialogues" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <MessageSquare size={20} />
            セリフ
          </Link>
          <Link href="/storyboard" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-sidebar-primary/20 text-sidebar-primary font-medium">
            <Film size={20} />
            ストーリーボード
          </Link>
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground">ストーリーボード</h2>
              <p className="text-muted-foreground mt-1">シーンを構築してストーリーを作成</p>
            </div>
            <Button
              onClick={() => {
                setEditingSceneId(null)
                setSceneFormData({ title: '', description: '' })
                setShowSceneForm(!showSceneForm)
              }}
              className="gap-2"
            >
              <Plus size={18} />
              新規シーン
            </Button>
          </div>

          {showSceneForm && (
            <Card className="bg-card border-border p-6 mb-8">
              <h3 className="text-xl font-semibold text-foreground mb-4">
                {editingSceneId ? 'シーンを編集' : '新規シーンを作成'}
              </h3>
              <form onSubmit={handleAddScene} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">シーンタイトル</label>
                  <Input
                    type="text"
                    placeholder="例：オープニング"
                    value={sceneFormData.title}
                    onChange={(e) => setSceneFormData({ ...sceneFormData, title: e.target.value })}
                    className="bg-background border-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">説明</label>
                  <textarea
                    placeholder="シーンの説明を入力..."
                    value={sceneFormData.description}
                    onChange={(e) => setSceneFormData({ ...sceneFormData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">
                    {editingSceneId ? '更新' : '作成'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowSceneForm(false)
                      setEditingSceneId(null)
                      setSceneFormData({ title: '', description: '' })
                    }}
                  >
                    キャンセル
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* シーン一覧 */}
            <div className="lg:col-span-2">
              <h3 className="text-xl font-semibold text-foreground mb-4">シーン</h3>
              {scenes.length === 0 ? (
                <Card className="bg-card border-border p-12 text-center">
                  <Film size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">シーンがありません</h3>
                  <p className="text-muted-foreground">「新規シーン」ボタンで最初のシーンを作成してください</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {scenes.map((scene, index) => (
                    <Card
                      key={scene.id}
                      draggable
                      onDragStart={() => setDraggedSceneId(scene.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        const fromIndex = scenes.findIndex((s) => s.id === draggedSceneId)
                        if (fromIndex !== -1) {
                          handleReorderScenes(fromIndex, index)
                        }
                      }}
                      className="bg-card border-border p-4 hover:border-primary/50 transition cursor-move"
                    >
                      <div className="flex items-start gap-4">
                        <GripVertical size={20} className="text-muted-foreground mt-1 flex-shrink-0" />
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => setSelectedSceneId(selectedSceneId === scene.id ? null : scene.id)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-muted-foreground bg-primary/20 px-2 py-1 rounded">
                              #{index + 1}
                            </span>
                            <h4 className="font-semibold text-foreground">{scene.title}</h4>
                          </div>
                          {scene.description && (
                            <p className="text-sm text-muted-foreground mt-1">{scene.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            セリフ数: {scene.dialogues?.length || 0}
                          </p>

                          {selectedSceneId === scene.id && (
                            <div className="mt-4 pt-4 border-t border-border space-y-3">
                              <h5 className="font-medium text-foreground">シーン内のセリフ</h5>
                              {scene.dialogues && scene.dialogues.length > 0 ? (
                                <div className="space-y-2">
                                  {scene.dialogues.map((sd) => (
                                    <div
                                      key={sd.id}
                                      className="flex items-start justify-between gap-2 p-2 bg-background rounded text-sm"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="text-foreground break-words">{sd.dialogue?.text}</p>
                                      </div>
                                      <button
                                        onClick={() => handleRemoveDialogue(sd.id)}
                                        className="flex-shrink-0 p-1 hover:bg-destructive/20 rounded transition"
                                      >
                                        <Trash2 size={14} className="text-destructive" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">セリフがありません</p>
                              )}

                              <div className="flex gap-2">
                                <select
                                  value={dialogueToAdd}
                                  onChange={(e) => setDialogueToAdd(e.target.value)}
                                  className="flex-1 px-2 py-1 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                  <option value="">セリフを選択...</option>
                                  {dialogues.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.text.substring(0, 30)}...
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (dialogueToAdd) {
                                      handleAddDialogueToScene(dialogueToAdd)
                                    }
                                  }}
                                  disabled={!dialogueToAdd}
                                >
                                  追加
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleEditScene(scene)}
                            className="p-2 hover:bg-primary/20 rounded-lg transition"
                          >
                            <Edit2 size={16} className="text-primary" />
                          </button>
                          <button
                            onClick={() => handleDeleteScene(scene.id)}
                            className="p-2 hover:bg-destructive/20 rounded-lg transition"
                          >
                            <Trash2 size={16} className="text-destructive" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* 統計情報 */}
            <div>
              <Card className="bg-card border-border p-6 sticky top-8">
                <h3 className="text-xl font-semibold text-foreground mb-4">統計情報</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">総シーン数</p>
                    <p className="text-2xl font-bold text-primary">{scenes.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">総セリフ数</p>
                    <p className="text-2xl font-bold text-accent">
                      {scenes.reduce((sum, s) => sum + (s.dialogues?.length || 0), 0)}
                    </p>
                  </div>
                  {selectedSceneId && (
                    <div>
                      <p className="text-sm text-muted-foreground">選択中のシーン</p>
                      <p className="text-sm font-medium text-foreground">
                        {scenes.find((s) => s.id === selectedSceneId)?.title}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
