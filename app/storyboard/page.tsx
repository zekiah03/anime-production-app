'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Film, Plus, Trash2, Edit2, GripVertical, Play, Square, SkipForward } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import type { Scene, Dialogue, SceneWithDialogues, Character, AudioFile, CharacterExpression } from '@/types/db'
import {
  deleteScene,
  deleteSceneDialogue,
  getAllAudioFiles,
  getAllCharacters,
  getAllDialogues,
  getAllExpressions,
  getAllSceneDialogues,
  getAllScenes,
  saveScene,
  saveSceneDialogue,
  saveScenesBatch,
} from '@/lib/db'
import { LipSyncStage } from '@/components/lip-sync-stage'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function StoryboardPage() {
  const [scenes, setScenes] = useState<SceneWithDialogues[]>([])
  const [dialogues, setDialogues] = useState<Dialogue[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [expressions, setExpressions] = useState<CharacterExpression[]>([])
  const [loading, setLoading] = useState(true)
  const [showSceneForm, setShowSceneForm] = useState(false)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [sceneFormData, setSceneFormData] = useState({ title: '', description: '' })
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [dialogueToAdd, setDialogueToAdd] = useState('')
  const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null)
  const [playingSceneId, setPlayingSceneId] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    try {
      const [rawScenes, sceneDialogues, allDialogues, allCharacters, allAudio, allExpressions] = await Promise.all([
        getAllScenes(),
        getAllSceneDialogues(),
        getAllDialogues(),
        getAllCharacters(),
        getAllAudioFiles(),
        getAllExpressions(),
      ])
      const dialogueById = new Map(allDialogues.map((d) => [d.id, d]))
      const combined: SceneWithDialogues[] = rawScenes.map((scene) => ({
        ...scene,
        dialogues: sceneDialogues
          .filter((sd) => sd.scene_id === scene.id)
          .sort((a, b) => a.order_index - b.order_index)
          .map((sd) => ({ ...sd, dialogue: dialogueById.get(sd.dialogue_id) ?? null })),
      }))
      setScenes(combined)
      setDialogues(allDialogues)
      setCharacters(allCharacters)
      setAudioFiles(allAudio)
      setExpressions(allExpressions)
    } catch (e) {
      console.error('[anime-app] load storyboard failed', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddScene(e: React.FormEvent) {
    e.preventDefault()
    if (!sceneFormData.title.trim()) return

    const now = new Date().toISOString()
    const maxOrder = scenes.length > 0 ? Math.max(...scenes.map((s) => s.order_index)) : -1

    if (editingSceneId) {
      const existing = scenes.find((s) => s.id === editingSceneId)
      if (!existing) return
      const updated: Scene = {
        id: existing.id,
        title: sceneFormData.title,
        description: sceneFormData.description || null,
        order_index: existing.order_index,
        created_at: existing.created_at,
        updated_at: now,
      }
      await saveScene(updated)
      setScenes((prev) =>
        prev.map((s) =>
          s.id === editingSceneId ? { ...updated, dialogues: s.dialogues } : s,
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
      // Strip 'dialogues' before persisting Scene
      const { dialogues: _drop, ...sceneRow } = newScene
      void _drop
      await saveScene(sceneRow)
      setScenes((prev) => [...prev, newScene])
    }

    setSceneFormData({ title: '', description: '' })
    setShowSceneForm(false)
  }

  async function handleDeleteScene(id: string) {
    if (!confirm('このシーンを削除してよろしいですか？')) return
    await deleteScene(id)
    setScenes((prev) => prev.filter((s) => s.id !== id))
    if (selectedSceneId === id) setSelectedSceneId(null)
  }

  async function handleAddDialogueToScene(dialogueId: string) {
    if (!selectedSceneId) return
    const target = scenes.find((s) => s.id === selectedSceneId)
    if (!target) return

    const now = new Date().toISOString()
    const maxOrder = target.dialogues.reduce((max, d) => Math.max(max, d.order_index), -1)
    const dialogue = dialogues.find((d) => d.id === dialogueId) ?? null

    const newSceneDialogue = {
      id: crypto.randomUUID(),
      scene_id: selectedSceneId,
      dialogue_id: dialogueId,
      order_index: maxOrder + 1,
      created_at: now,
    }
    await saveSceneDialogue(newSceneDialogue)

    setScenes((prev) =>
      prev.map((s) =>
        s.id === selectedSceneId
          ? { ...s, dialogues: [...s.dialogues, { ...newSceneDialogue, dialogue }] }
          : s,
      ),
    )
    setDialogueToAdd('')
  }

  async function handleRemoveDialogue(sceneDialogueId: string) {
    await deleteSceneDialogue(sceneDialogueId)
    setScenes((prev) =>
      prev.map((s) => ({
        ...s,
        dialogues: s.dialogues.filter((d) => d.id !== sceneDialogueId),
      })),
    )
  }

  async function handleReorderScenes(from: number, to: number) {
    const reordered = [...scenes]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    const renumbered = reordered.map((s, i) => ({ ...s, order_index: i }))
    // persist (strip dialogues)
    await saveScenesBatch(
      renumbered.map(({ dialogues: _d, ...row }) => {
        void _d
        return row
      }),
    )
    setScenes(renumbered)
  }

  function handleEditScene(scene: Scene) {
    setSceneFormData({ title: scene.title || '', description: scene.description || '' })
    setEditingSceneId(scene.id)
    setShowSceneForm(true)
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

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
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">読み込み中...</p>
                </div>
              ) : scenes.length === 0 ? (
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
                            onClick={(e) => {
                              e.stopPropagation()
                              setPlayingSceneId(scene.id)
                            }}
                            disabled={(scene.dialogues?.length ?? 0) === 0}
                            className="p-2 hover:bg-primary/20 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title="シーン再生"
                          >
                            <Play size={16} className="text-primary" />
                          </button>
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

      <ScenePlayerDialog
        scene={playingSceneId ? scenes.find((s) => s.id === playingSceneId) ?? null : null}
        characters={characters}
        audioFiles={audioFiles}
        expressions={expressions}
        onClose={() => setPlayingSceneId(null)}
      />
    </div>
  )
}

// ==================== シーン再生ダイアログ ====================

interface SceneDialogueResolved {
  text: string
  character: Character | null
  audio: AudioFile | null
  expressionId: string | null
  charExpressions: CharacterExpression[]
}

function ScenePlayerDialog({
  scene,
  characters,
  audioFiles,
  expressions,
  onClose,
}: {
  scene: SceneWithDialogues | null
  characters: Character[]
  audioFiles: AudioFile[]
  expressions: CharacterExpression[]
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  // scene が変わったらリセット
  useEffect(() => {
    setIndex(0)
    setPlaying(false)
  }, [scene?.id])

  if (!scene) return null

  // 音声のあるセリフだけを再生対象にする
  const queue: SceneDialogueResolved[] = scene.dialogues
    .map((sd) => {
      const d = sd.dialogue
      if (!d) return null
      const character = characters.find((c) => c.id === d.character_id) ?? null
      const audio = audioFiles.find((a) => a.id === d.audio_id) ?? null
      const charExpressions = character
        ? expressions.filter((x) => x.character_id === character.id)
        : []
      return {
        text: d.text,
        character,
        audio,
        expressionId: d.expression_id,
        charExpressions,
      } satisfies SceneDialogueResolved
    })
    .filter((x): x is SceneDialogueResolved => x !== null && x.audio !== null && x.character !== null)

  const current = queue[index] ?? null
  const hasNext = index + 1 < queue.length

  function handleEnded() {
    if (hasNext) {
      setIndex((i) => i + 1)
    } else {
      setPlaying(false)
    }
  }

  function handleSkip() {
    if (hasNext) {
      setIndex((i) => i + 1)
    } else {
      setPlaying(false)
    }
  }

  function handleStart() {
    setIndex(0)
    setPlaying(true)
  }

  return (
    <Dialog open={!!scene} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{scene.title} を再生</DialogTitle>
          <DialogDescription>
            キャラと音声が設定されたセリフを順番に再生します(
            {queue.length} / {scene.dialogues.length} 件が対象)
          </DialogDescription>
        </DialogHeader>

        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            再生できるセリフがありません。セリフにキャラクターと音声を紐付けてください
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LipSyncStage
                character={current?.character ?? null}
                expressions={current?.charExpressions ?? []}
                audioUrl={current?.audio?.file_url ?? null}
                overrideExpressionId={current?.expressionId ?? null}
                caption={current?.text ?? null}
                playing={playing}
                onEnded={handleEnded}
              />
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">現在のセリフ</p>
                  <p className="text-base font-medium text-foreground mt-1">
                    {current?.text ?? '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">キャラクター</p>
                  <p className="text-sm text-foreground">{current?.character?.name ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">進行</p>
                  <p className="text-sm text-foreground">
                    {index + 1} / {queue.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {!playing ? (
                <Button size="sm" onClick={handleStart} className="gap-1">
                  <Play size={14} /> 最初から再生
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setPlaying(false)} className="gap-1">
                  <Square size={14} /> 停止
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleSkip} disabled={!playing} className="gap-1">
                <SkipForward size={14} /> 次へ
              </Button>
            </div>

            {/* セリフ一覧(プレビュー) */}
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-2">再生キュー</p>
              <ol className="space-y-1 text-sm">
                {queue.map((q, i) => (
                  <li
                    key={i}
                    className={`px-2 py-1 rounded ${
                      i === index ? 'bg-primary/20 text-primary font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {i + 1}. {q.character?.name}: {q.text}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
