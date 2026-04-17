'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  ImagePlus,
  Sparkles,
  Play,
  Square,
  Smile,
} from 'lucide-react'
import type { AudioFile, Character, CharacterExpression, Dialogue, ExpressionKind } from '@/types/db'
import {
  deleteCharacter,
  deleteExpression,
  getAllAudioFiles,
  getAllCharacters,
  getAllDialogues,
  getExpressionsByCharacter,
  saveCharacter,
  saveExpression,
} from '@/lib/db'
import { LipSyncStage } from '@/components/lip-sync-stage'
import { Sidebar } from '@/components/sidebar'
import { CharacterAudioTab } from '@/components/character-audio-tab'
import { CharacterDialoguesTab } from '@/components/character-dialogues-tab'

const KIND_LABEL: Record<ExpressionKind, string> = {
  mouth_closed: '口閉じ',
  mouth_open: '口開け',
  expression: '表情',
}

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<{ name: string; description: string; imageBlob: Blob | null; imagePreview: string | null }>({
    name: '',
    description: '',
    imageBlob: null,
    imagePreview: null,
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    getAllCharacters()
      .then(setCharacters)
      .catch((e) => console.error('[anime-app] load characters failed', e))
      .finally(() => setLoading(false))
  }, [])

  function resetForm() {
    if (formData.imagePreview) URL.revokeObjectURL(formData.imagePreview)
    setFormData({ name: '', description: '', imageBlob: null, imagePreview: null })
    setEditingId(null)
    setShowForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) return

    const now = new Date().toISOString()

    if (editingId) {
      const existing = characters.find((c) => c.id === editingId)
      if (!existing) return
      const updated: Character = {
        ...existing,
        name: formData.name,
        description: formData.description || null,
        image_blob: formData.imageBlob ?? existing.image_blob,
        image_url: formData.imageBlob
          ? URL.createObjectURL(formData.imageBlob)
          : existing.image_url,
        updated_at: now,
      }
      await saveCharacter(updated)
      setCharacters((prev) => prev.map((c) => (c.id === editingId ? updated : c)))
    } else {
      const newChar: Character = {
        id: crypto.randomUUID(),
        name: formData.name,
        description: formData.description || null,
        image_blob: formData.imageBlob ?? undefined,
        image_url: formData.imageBlob ? URL.createObjectURL(formData.imageBlob) : null,
        created_at: now,
        updated_at: now,
      }
      await saveCharacter(newChar)
      setCharacters((prev) => [newChar, ...prev])
    }
    resetForm()
  }

  async function handleDelete(id: string) {
    if (!confirm('削除してよろしいですか？関連する表情も削除されます')) return
    await deleteCharacter(id)
    setCharacters((prev) => prev.filter((c) => c.id !== id))
  }

  function handleEdit(character: Character) {
    if (formData.imagePreview) URL.revokeObjectURL(formData.imagePreview)
    setFormData({
      name: character.name,
      description: character.description || '',
      imageBlob: null,
      imagePreview: null,
    })
    setEditingId(character.id)
    setShowForm(true)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (formData.imagePreview) URL.revokeObjectURL(formData.imagePreview)
    setFormData((prev) => ({
      ...prev,
      imageBlob: file,
      imagePreview: URL.createObjectURL(file),
    }))
  }

  const detailChar = detailId ? characters.find((c) => c.id === detailId) ?? null : null

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground">キャラクター管理</h2>
              <p className="text-muted-foreground mt-1">画像・表情・音声を登録してリップシンクプレビューできます</p>
            </div>
            <Button
              onClick={() => {
                if (showForm) {
                  resetForm()
                } else {
                  setEditingId(null)
                  setFormData({ name: '', description: '', imageBlob: null, imagePreview: null })
                  setShowForm(true)
                }
              }}
              className="gap-2"
            >
              <Plus size={18} />
              新規作成
            </Button>
          </div>

          {showForm && (
            <Card className="bg-card border-border p-6 mb-8">
              <h3 className="text-xl font-semibold text-foreground mb-4">
                {editingId ? 'キャラクターを編集' : '新規キャラクターを作成'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">キャラクター名</label>
                  <Input
                    type="text"
                    placeholder="例：太郎"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-background border-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">説明</label>
                  <textarea
                    placeholder="キャラクターの説明を入力..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">メイン画像(口閉じ/通常)</label>
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-background border border-input rounded-md text-sm hover:bg-accent/20 transition">
                      <ImagePlus size={16} />
                      画像を選択
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    {formData.imagePreview && (
                      <img
                        src={formData.imagePreview}
                        alt="プレビュー"
                        className="h-20 w-20 rounded-md object-cover border border-border"
                      />
                    )}
                  </div>
                  {editingId && !formData.imagePreview && (
                    <p className="text-xs text-muted-foreground mt-1">変更しない場合はそのままで構いません</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="submit">
                    {editingId ? '更新' : '作成'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    キャンセル
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">読み込み中...</p>
            </div>
          ) : characters.length === 0 ? (
            <Card className="bg-card border-border p-12 text-center">
              <Users size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">キャラクターがありません</h3>
              <p className="text-muted-foreground">「新規作成」ボタンで最初のキャラクターを作成してください</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {characters.map((character) => (
                <Card key={character.id} className="bg-card border-border p-6 hover:border-primary/50 transition">
                  <div className="flex items-start gap-4 mb-3">
                    {character.image_url ? (
                      <img
                        src={character.image_url}
                        alt={character.name}
                        className="h-16 w-16 rounded-md object-cover border border-border flex-shrink-0"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <Users size={24} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground truncate">{character.name}</h3>
                      {character.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{character.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(character)}
                        className="p-2 hover:bg-primary/20 rounded-lg transition"
                        aria-label="編集"
                      >
                        <Edit2 size={16} className="text-primary" />
                      </button>
                      <button
                        onClick={() => handleDelete(character.id)}
                        className="p-2 hover:bg-destructive/20 rounded-lg transition"
                        aria-label="削除"
                      >
                        <Trash2 size={16} className="text-destructive" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-muted-foreground">
                      {new Date(character.created_at).toLocaleDateString('ja-JP')}
                    </p>
                    <Button size="sm" variant="outline" onClick={() => setDetailId(character.id)} className="gap-1">
                      <Sparkles size={14} />
                      表情・音声・セリフ
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <CharacterDetailDialog
        character={detailChar}
        open={!!detailChar}
        onClose={() => setDetailId(null)}
      />
    </div>
  )
}

// ==================== 詳細ダイアログ(表情・リップシンク) ====================

function CharacterDetailDialog({
  character,
  open,
  onClose,
}: {
  character: Character | null
  open: boolean
  onClose: () => void
}) {
  const [expressions, setExpressions] = useState<CharacterExpression[]>([])
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [dialogues, setDialogues] = useState<Dialogue[]>([])
  const [loading, setLoading] = useState(false)
  const [newExprName, setNewExprName] = useState('')
  const [newExprKind, setNewExprKind] = useState<ExpressionKind>('mouth_open')
  const [newExprBlob, setNewExprBlob] = useState<Blob | null>(null)
  const [newExprPreview, setNewExprPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!character) return
    setLoading(true)
    Promise.all([getExpressionsByCharacter(character.id), getAllAudioFiles(), getAllDialogues()])
      .then(([exprs, audios, dials]) => {
        setExpressions(exprs)
        setAudioFiles(audios.filter((a) => a.character_id === character.id))
        setDialogues(dials.filter((d) => d.character_id === character.id))
      })
      .catch((e) => console.error('[anime-app] load character detail failed', e))
      .finally(() => setLoading(false))
  }, [character])

  function handleNewExprImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (newExprPreview) URL.revokeObjectURL(newExprPreview)
    setNewExprBlob(file)
    setNewExprPreview(URL.createObjectURL(file))
  }

  async function handleAddExpression() {
    if (!character || !newExprBlob || !newExprName.trim()) return
    const expr: CharacterExpression = {
      id: crypto.randomUUID(),
      character_id: character.id,
      name: newExprName.trim(),
      kind: newExprKind,
      image_blob: newExprBlob,
      image_url: URL.createObjectURL(newExprBlob),
      created_at: new Date().toISOString(),
    }
    await saveExpression(expr)
    setExpressions((prev) => [...prev, expr])
    setNewExprName('')
    setNewExprBlob(null)
    if (newExprPreview) URL.revokeObjectURL(newExprPreview)
    setNewExprPreview(null)
  }

  async function handleDeleteExpression(id: string) {
    if (!confirm('この表情を削除しますか？')) return
    await deleteExpression(id)
    setExpressions((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{character?.name ?? ''} の詳細</DialogTitle>
          <DialogDescription>表情・音声・セリフをタブから管理できます</DialogDescription>
        </DialogHeader>

        {loading || !character ? (
          <p className="text-center text-muted-foreground py-8">読み込み中...</p>
        ) : (
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="preview">プレビュー</TabsTrigger>
              <TabsTrigger value="expressions">表情</TabsTrigger>
              <TabsTrigger value="audio">音声</TabsTrigger>
              <TabsTrigger value="dialogues">セリフ</TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="mt-4">
              <LipSyncPreview
                character={character}
                expressions={expressions}
                audioFiles={audioFiles}
              />
            </TabsContent>

            <TabsContent value="expressions" className="mt-4 space-y-6">
              <div className="border border-border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Smile size={18} /> 表情を追加
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <Input
                    placeholder="表情名(例: 笑顔)"
                    value={newExprName}
                    onChange={(e) => setNewExprName(e.target.value)}
                  />
                  <select
                    value={newExprKind}
                    onChange={(e) => setNewExprKind(e.target.value as ExpressionKind)}
                    className="px-3 py-2 bg-background border border-input rounded-md text-sm"
                  >
                    <option value="mouth_open">口開け(リップシンク用)</option>
                    <option value="mouth_closed">口閉じ(リップシンク用)</option>
                    <option value="expression">表情バリエーション</option>
                  </select>
                  <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-3 py-2 bg-background border border-input rounded-md text-sm hover:bg-accent/20 transition">
                    <ImagePlus size={16} />
                    画像を選択
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleNewExprImage}
                      className="hidden"
                    />
                  </label>
                </div>
                {newExprPreview && (
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={newExprPreview}
                      alt="プレビュー"
                      className="h-16 w-16 rounded-md object-cover border border-border"
                    />
                    <span className="text-sm text-muted-foreground">プレビュー</span>
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={handleAddExpression}
                  disabled={!newExprBlob || !newExprName.trim()}
                >
                  追加
                </Button>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-3">登録済みの表情</h4>
                {expressions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">まだ表情が登録されていません</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {expressions.map((e) => (
                      <div key={e.id} className="border border-border rounded-md p-2 bg-card">
                        <img
                          src={e.image_url}
                          alt={e.name}
                          className="w-full aspect-square object-cover rounded"
                        />
                        <div className="mt-2 flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{e.name}</p>
                            <p className="text-xs text-muted-foreground">{KIND_LABEL[e.kind]}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteExpression(e.id)}
                            className="p-1 hover:bg-destructive/20 rounded transition flex-shrink-0"
                            aria-label="削除"
                          >
                            <Trash2 size={14} className="text-destructive" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="audio" className="mt-4">
              <CharacterAudioTab
                character={character}
                audioFiles={audioFiles}
                onChange={setAudioFiles}
              />
            </TabsContent>

            <TabsContent value="dialogues" className="mt-4">
              <CharacterDialoguesTab
                character={character}
                dialogues={dialogues}
                audioFiles={audioFiles}
                expressions={expressions}
                onChange={setDialogues}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ==================== リップシンクプレビュー ====================

function LipSyncPreview({
  character,
  expressions,
  audioFiles,
}: {
  character: Character
  expressions: CharacterExpression[]
  audioFiles: AudioFile[]
}) {
  const [selectedAudioId, setSelectedAudioId] = useState<string>('')
  const [selectedExpressionId, setSelectedExpressionId] = useState<string>('')
  const [playing, setPlaying] = useState(false)
  const [threshold, setThreshold] = useState(40)

  const mouthClosed = expressions.find((e) => e.kind === 'mouth_closed')
  const mouthOpenExpr = expressions.find((e) => e.kind === 'mouth_open')
  const audioUrl = audioFiles.find((a) => a.id === selectedAudioId)?.file_url ?? null

  return (
    <div className="border border-border rounded-lg p-4 bg-muted/30">
      <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <Sparkles size={18} /> リップシンク & 表情プレビュー
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LipSyncStage
          character={character}
          expressions={expressions}
          audioUrl={audioUrl}
          overrideExpressionId={selectedExpressionId || null}
          threshold={threshold}
          playing={playing}
          onEnded={() => setPlaying(false)}
        />

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">音声を選択</label>
            <select
              value={selectedAudioId}
              onChange={(e) => {
                setSelectedAudioId(e.target.value)
                setPlaying(false)
              }}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
            >
              <option value="">このキャラの音声から選ぶ</option>
              {audioFiles.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {audioFiles.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">音声ページでこのキャラに紐づく音声を録音してください</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">表情切替(手動)</label>
            <select
              value={selectedExpressionId}
              onChange={(e) => setSelectedExpressionId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
            >
              <option value="">自動(口パク優先)</option>
              {expressions.filter((e) => e.kind === 'expression').map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              口パク感度 (現在: {threshold})
            </label>
            <input
              type="range"
              min={5}
              max={120}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">小さいほど口が開きやすい</p>
          </div>

          <div className="flex gap-2">
            {!playing ? (
              <Button
                size="sm"
                onClick={() => setPlaying(true)}
                disabled={!selectedAudioId || !mouthOpenExpr || !mouthClosed}
                className="gap-1"
              >
                <Play size={14} /> 再生
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setPlaying(false)} className="gap-1">
                <Square size={14} /> 停止
              </Button>
            )}
          </div>

          {(!mouthOpenExpr || !mouthClosed) && (
            <p className="text-xs text-destructive">
              リップシンクには「口開け」「口閉じ」の画像を両方登録してください
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
