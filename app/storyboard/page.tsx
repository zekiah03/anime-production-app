'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Film, Plus, Trash2, Edit2, GripVertical, Play, Square, SkipForward, Video } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { SceneExportDialog } from '@/components/scene-export-dialog'
import type { Scene, Dialogue, SceneWithDialogues, Character, AudioFile, CharacterExpression, IllustrationWithLayers, Layer, BgmTrack, SoundEffect, SceneDialogue } from '@/types/db'
import {
  deleteScene,
  deleteSceneDialogue,
  getAllAudioFiles,
  getAllBgmTracks,
  getAllCharacters,
  getAllDialogues,
  getAllExpressions,
  getAllIllustrations,
  getAllSceneDialogues,
  getAllScenes,
  getAllSoundEffects,
  getLayersByIllustration,
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
  const [illustrations, setIllustrations] = useState<IllustrationWithLayers[]>([])
  const [bgmTracks, setBgmTracks] = useState<BgmTrack[]>([])
  const [sounds, setSounds] = useState<SoundEffect[]>([])
  const [loading, setLoading] = useState(true)
  const [showSceneForm, setShowSceneForm] = useState(false)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [sceneFormData, setSceneFormData] = useState({
    title: '',
    description: '',
    background_illustration_id: '',
    bgm_track_id: '',
    bgm_volume: 0.25,
  })
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [dialogueToAdd, setDialogueToAdd] = useState('')
  const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null)
  const [playingSceneId, setPlayingSceneId] = useState<string | null>(null)
  const [exportingSceneId, setExportingSceneId] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    try {
      const [rawScenes, sceneDialogues, allDialogues, allCharacters, allAudio, allExpressions, illusts, allBgm, allSe] = await Promise.all([
        getAllScenes(),
        getAllSceneDialogues(),
        getAllDialogues(),
        getAllCharacters(),
        getAllAudioFiles(),
        getAllExpressions(),
        getAllIllustrations(),
        getAllBgmTracks(),
        getAllSoundEffects(),
      ])
      const withLayers: IllustrationWithLayers[] = await Promise.all(
        illusts.map(async (i) => ({
          ...i,
          layers: await getLayersByIllustration(i.id),
        })),
      )
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
      setIllustrations(withLayers)
      setBgmTracks(allBgm)
      setSounds(allSe)
    } catch (e) {
      console.error('[anime-app] load storyboard failed', e)
    } finally {
      setLoading(false)
    }
  }

  function bgmForScene(scene: Scene): BgmTrack | null {
    if (!scene.bgm_track_id) return null
    return bgmTracks.find((t) => t.id === scene.bgm_track_id) ?? null
  }

  function backgroundLayersForScene(scene: Scene): Layer[] {
    if (!scene.background_illustration_id) return []
    const illust = illustrations.find((i) => i.id === scene.background_illustration_id)
    if (!illust) return []
    return [...illust.layers]
      .filter((l) => l.visible)
      .sort((a, b) => a.order_index - b.order_index)
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
        background_illustration_id: sceneFormData.background_illustration_id || null,
        bgm_track_id: sceneFormData.bgm_track_id || null,
        bgm_volume: sceneFormData.bgm_volume,
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
        background_illustration_id: sceneFormData.background_illustration_id || null,
        bgm_track_id: sceneFormData.bgm_track_id || null,
        bgm_volume: sceneFormData.bgm_volume,
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

    setSceneFormData({
      title: '',
      description: '',
      background_illustration_id: '',
      bgm_track_id: '',
      bgm_volume: 0.25,
    })
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

    const newSceneDialogue: SceneDialogue = {
      id: crypto.randomUUID(),
      scene_id: selectedSceneId,
      dialogue_id: dialogueId,
      order_index: maxOrder + 1,
      se_id: null,
      se_volume: 1,
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

  // SceneDialogue の SE 設定を更新(UI操作のたびにローカル先行で反映、DBは fire-and-forget)
  function updateSceneDialogueSe(sceneId: string, sdId: string, patch: Partial<Pick<SceneDialogue, 'se_id' | 'se_volume'>>) {
    setScenes((prev) =>
      prev.map((s) => {
        if (s.id !== sceneId) return s
        return {
          ...s,
          dialogues: s.dialogues.map((sd) => {
            if (sd.id !== sdId) return sd
            const merged = { ...sd, ...patch }
            // 保存(dialogue は派生データなので取り除く)
            const { dialogue: _drop, ...rowPart } = merged
            void _drop
            const row: SceneDialogue = {
              id: rowPart.id,
              scene_id: rowPart.scene_id,
              dialogue_id: rowPart.dialogue_id,
              order_index: rowPart.order_index,
              se_id: rowPart.se_id ?? null,
              se_volume: typeof rowPart.se_volume === 'number' ? rowPart.se_volume : 1,
              created_at: rowPart.created_at,
            }
            saveSceneDialogue(row).catch((e) => console.error('[anime-app] save se on scene dialogue failed', e))
            return merged
          }),
        }
      }),
    )
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
    setSceneFormData({
      title: scene.title || '',
      description: scene.description || '',
      background_illustration_id: scene.background_illustration_id || '',
      bgm_track_id: scene.bgm_track_id || '',
      bgm_volume: typeof scene.bgm_volume === 'number' ? scene.bgm_volume : 0.25,
    })
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
                setSceneFormData({ title: '', description: '', background_illustration_id: '', bgm_track_id: '', bgm_volume: 0.25 })
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
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">背景</label>
                  <select
                    value={sceneFormData.background_illustration_id}
                    onChange={(e) => setSceneFormData({ ...sceneFormData, background_illustration_id: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">なし(黒)</option>
                    {illustrations.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.layers.length} 層)
                      </option>
                    ))}
                  </select>
                  {illustrations.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      環境タブで素材を作成すると選択できます
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">BGM</label>
                  <select
                    value={sceneFormData.bgm_track_id}
                    onChange={(e) => setSceneFormData({ ...sceneFormData, bgm_track_id: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">なし</option>
                    {bgmTracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {bgmTracks.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      環境タブ → BGMタブで追加すると選択できます
                    </p>
                  )}
                </div>
                {sceneFormData.bgm_track_id && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      BGM音量: {Math.round(sceneFormData.bgm_volume * 100)}%
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={sceneFormData.bgm_volume}
                      onChange={(e) =>
                        setSceneFormData({ ...sceneFormData, bgm_volume: Number(e.target.value) })
                      }
                      className="w-full accent-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      声に対するBGMの音量。25%前後が一般的
                    </p>
                  </div>
                )}
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
                      setSceneFormData({ title: '', description: '', background_illustration_id: '', bgm_track_id: '', bgm_volume: 0.25 })
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
                                  {scene.dialogues.map((sd) => {
                                    const seVol = typeof sd.se_volume === 'number' ? sd.se_volume : 1
                                    return (
                                      <div
                                        key={sd.id}
                                        className="p-2 bg-background rounded text-sm space-y-2"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="text-foreground break-words flex-1 min-w-0">
                                            {sd.dialogue?.text}
                                          </p>
                                          <button
                                            onClick={() => handleRemoveDialogue(sd.id)}
                                            className="flex-shrink-0 p-1 hover:bg-destructive/20 rounded transition"
                                          >
                                            <Trash2 size={14} className="text-destructive" />
                                          </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground flex-shrink-0">SE</span>
                                          <select
                                            value={sd.se_id ?? ''}
                                            onChange={(e) =>
                                              updateSceneDialogueSe(scene.id, sd.id, {
                                                se_id: e.target.value || null,
                                              })
                                            }
                                            className="flex-1 min-w-0 px-2 py-1 bg-card border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                          >
                                            <option value="">なし</option>
                                            {sounds.map((s) => (
                                              <option key={s.id} value={s.id}>
                                                {s.name}
                                              </option>
                                            ))}
                                          </select>
                                          {sd.se_id && (
                                            <>
                                              <input
                                                type="range"
                                                min={0}
                                                max={1}
                                                step={0.05}
                                                value={seVol}
                                                onChange={(e) =>
                                                  updateSceneDialogueSe(scene.id, sd.id, {
                                                    se_volume: Number(e.target.value),
                                                  })
                                                }
                                                className="w-20 accent-primary"
                                                title="SE音量"
                                              />
                                              <span className="text-xs text-muted-foreground w-8 tabular-nums flex-shrink-0">
                                                {Math.round(seVol * 100)}%
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
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
                            onClick={(e) => {
                              e.stopPropagation()
                              setExportingSceneId(scene.id)
                            }}
                            disabled={(scene.dialogues?.length ?? 0) === 0}
                            className="p-2 hover:bg-primary/20 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title="動画書き出し"
                          >
                            <Video size={16} className="text-primary" />
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

      {(() => {
        const playScene = playingSceneId ? scenes.find((s) => s.id === playingSceneId) ?? null : null
        const exportScene = exportingSceneId ? scenes.find((s) => s.id === exportingSceneId) ?? null : null
        return (
          <>
            <ScenePlayerDialog
              scene={playScene}
              characters={characters}
              audioFiles={audioFiles}
              expressions={expressions}
              backgroundLayers={playScene ? backgroundLayersForScene(playScene) : []}
              bgmTrack={playScene ? bgmForScene(playScene) : null}
              bgmVolume={
                playScene && typeof playScene.bgm_volume === 'number' ? playScene.bgm_volume : 0.25
              }
              sounds={sounds}
              onClose={() => setPlayingSceneId(null)}
            />
            <SceneExportDialog
              scene={exportScene}
              characters={characters}
              audioFiles={audioFiles}
              expressions={expressions}
              backgroundLayers={exportScene ? backgroundLayersForScene(exportScene) : []}
              bgmTrack={exportScene ? bgmForScene(exportScene) : null}
              bgmVolume={
                exportScene && typeof exportScene.bgm_volume === 'number'
                  ? exportScene.bgm_volume
                  : 0.25
              }
              sounds={sounds}
              open={!!exportingSceneId}
              onClose={() => setExportingSceneId(null)}
            />
          </>
        )
      })()}
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
  se: SoundEffect | null
  seVolume: number
}

function ScenePlayerDialog({
  scene,
  characters,
  audioFiles,
  expressions,
  backgroundLayers,
  bgmTrack,
  bgmVolume,
  sounds,
  onClose,
}: {
  scene: SceneWithDialogues | null
  characters: Character[]
  audioFiles: AudioFile[]
  expressions: CharacterExpression[]
  backgroundLayers: Layer[]
  bgmTrack: BgmTrack | null
  bgmVolume: number
  sounds: SoundEffect[]
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const bgmRef = useRef<HTMLAudioElement | null>(null)
  const seRef = useRef<HTMLAudioElement | null>(null)

  // scene が変わったらリセット
  useEffect(() => {
    setIndex(0)
    setPlaying(false)
  }, [scene?.id])

  // BGM: playing=true の間だけループ再生
  useEffect(() => {
    const el = bgmRef.current
    if (!el) return
    el.volume = bgmVolume
    if (playing && bgmTrack) {
      el.currentTime = 0
      el.play().catch((e) => console.warn('[anime-app] bgm play blocked', e))
    } else {
      el.pause()
    }
  }, [playing, bgmTrack?.id, bgmVolume])

  // SE: 現在のセリフが切り替わるたびに冒頭で oneshot 再生
  useEffect(() => {
    if (!playing) return
    const current = queue[index]
    if (!current?.se) return
    const el = seRef.current
    if (!el) return
    el.src = current.se.file_url
    el.volume = current.seVolume
    el.currentTime = 0
    el.play().catch((e) => console.warn('[anime-app] se play blocked', e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, playing, scene?.id])

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
      const se = sd.se_id ? sounds.find((s) => s.id === sd.se_id) ?? null : null
      const seVolume = typeof sd.se_volume === 'number' ? sd.se_volume : 1
      return {
        text: d.text,
        character,
        audio,
        expressionId: d.expression_id,
        charExpressions,
        se,
        seVolume,
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
                backgroundLayers={backgroundLayers}
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
        {/* BGM: playing中ループ再生(声側の AudioContext とは独立) */}
        <audio
          ref={bgmRef}
          src={bgmTrack?.file_url ?? undefined}
          loop
          preload="auto"
          className="hidden"
        />
        {/* SE: 各セリフの冒頭で oneshot 再生 */}
        <audio ref={seRef} preload="auto" className="hidden" />
      </DialogContent>
    </Dialog>
  )
}
