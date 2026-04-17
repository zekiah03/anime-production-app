'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Layers,
  Upload,
  Image as ImageIcon,
  Music,
  Zap,
  Sparkles,
} from 'lucide-react'
import { generateSampleBgmTracks, generateSampleSoundEffects } from '@/lib/sample-audio'
import { generateSampleIllustrations } from '@/lib/sample-images'
import type { BgmTrack, IllustrationWithLayers, Layer, Illustration, SoundEffect } from '@/types/db'
import {
  deleteBgmTrack,
  deleteIllustration,
  deleteLayer,
  deleteSoundEffect,
  getAllBgmTracks,
  getAllIllustrations,
  getAllSoundEffects,
  getLayersByIllustration,
  saveBgmTrack,
  saveIllustration,
  saveLayer,
  saveLayersBatch,
  saveSoundEffect,
} from '@/lib/db'
import { Sidebar } from '@/components/sidebar'
import { ListSkeleton } from '@/components/skeleton'

// 「環境」タブ: 背景・小物など、キャラに依存しない素材を管理する。
// 内部的には Illustration/Layer エンティティをそのまま使う(背景イラストなどが既に入っているかもしれないため)。
export default function EnvironmentPage() {
  const [illustrations, setIllustrations] = useState<IllustrationWithLayers[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newIllustrationName, setNewIllustrationName] = useState('')
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // BGM state
  const [bgmTracks, setBgmTracks] = useState<BgmTrack[]>([])
  const [bgmLoading, setBgmLoading] = useState(true)
  const bgmInputRef = useRef<HTMLInputElement | null>(null)

  // SE state
  const [sounds, setSounds] = useState<SoundEffect[]>([])
  const [seLoading, setSeLoading] = useState(true)
  const seInputRef = useRef<HTMLInputElement | null>(null)

  // サンプル生成中フラグ
  const [seedingBgm, setSeedingBgm] = useState(false)
  const [seedingSe, setSeedingSe] = useState(false)
  const [seedingIllust, setSeedingIllust] = useState(false)
  const illustImageInputRef = useRef<HTMLInputElement | null>(null)
  // D&D 用: いまどのタブの上にファイルがドラッグされているか
  const [dragOverTab, setDragOverTab] = useState<'images' | 'bgm' | 'se' | null>(null)
  // 検索クエリ(タブ別)
  const [imgSearch, setImgSearch] = useState('')
  const [bgmSearch, setBgmSearch] = useState('')
  const [seSearch, setSeSearch] = useState('')

  const selected = illustrations.find((i) => i.id === selectedId) ?? null
  const matches = (name: string, q: string) =>
    q.trim().length === 0 || name.toLowerCase().includes(q.trim().toLowerCase())
  const filteredIllustrations = illustrations.filter((i) => matches(i.name, imgSearch))
  const filteredBgm = bgmTracks.filter((b) => matches(b.name, bgmSearch))
  const filteredSe = sounds.filter((s) => matches(s.name, seSearch))

  useEffect(() => {
    getAllIllustrations()
      .then(async (rows) => {
        const withLayers = await Promise.all(
          rows.map(async (r) => ({
            ...r,
            layers: await getLayersByIllustration(r.id),
          })),
        )
        setIllustrations(withLayers)
      })
      .catch((e) => console.error('[anime-app] load environment failed', e))
      .finally(() => setLoading(false))

    getAllBgmTracks()
      .then(setBgmTracks)
      .catch((e) => console.error('[anime-app] load bgm failed', e))
      .finally(() => setBgmLoading(false))

    getAllSoundEffects()
      .then(setSounds)
      .catch((e) => console.error('[anime-app] load se failed', e))
      .finally(() => setSeLoading(false))
  }, [])

  // ==================== SE handlers (BGMと同じ形) ====================

  async function handleAddSeFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const now = new Date().toISOString()
    const newItems: SoundEffect[] = []
    for (const file of Array.from(files)) {
      const duration = await readAudioDuration(file)
      const se: SoundEffect = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ''),
        file_url: URL.createObjectURL(file),
        file_blob: file,
        duration,
        created_at: now,
      }
      try {
        await saveSoundEffect(se)
        newItems.push(se)
      } catch (e) {
        console.error('[anime-app] save se failed', e)
      }
    }
    setSounds((prev) => [...newItems, ...prev])
  }

  async function handleDeleteSe(id: string) {
    if (!confirm('この効果音を削除してよろしいですか？(使用中のセリフからは自動で外れます)')) return
    const target = sounds.find((t) => t.id === id)
    if (target?.file_url.startsWith('blob:')) URL.revokeObjectURL(target.file_url)
    await deleteSoundEffect(id)
    setSounds((prev) => prev.filter((t) => t.id !== id))
  }

  async function handleRenameSe(id: string, name: string) {
    const existing = sounds.find((t) => t.id === id)
    if (!existing) return
    const updated = { ...existing, name }
    await saveSoundEffect(updated)
    setSounds((prev) => prev.map((t) => (t.id === id ? updated : t)))
  }

  // ==================== サンプル生成(Web Audio で合成) ====================

  async function handleSeedBgm() {
    if (seedingBgm) return
    setSeedingBgm(true)
    try {
      const clips = await generateSampleBgmTracks()
      const now = new Date().toISOString()
      const newTracks: BgmTrack[] = []
      for (const clip of clips) {
        const track: BgmTrack = {
          id: crypto.randomUUID(),
          name: clip.name,
          file_url: URL.createObjectURL(clip.blob),
          file_blob: clip.blob,
          duration: clip.duration,
          created_at: now,
        }
        await saveBgmTrack(track)
        newTracks.push(track)
      }
      setBgmTracks((prev) => [...newTracks, ...prev])
    } catch (e) {
      console.error('[anime-app] seed bgm failed', e)
      alert('BGMサンプル生成に失敗しました')
    } finally {
      setSeedingBgm(false)
    }
  }

  async function handleSeedSe() {
    if (seedingSe) return
    setSeedingSe(true)
    try {
      const clips = await generateSampleSoundEffects()
      const now = new Date().toISOString()
      const newItems: SoundEffect[] = []
      for (const clip of clips) {
        const se: SoundEffect = {
          id: crypto.randomUUID(),
          name: clip.name,
          file_url: URL.createObjectURL(clip.blob),
          file_blob: clip.blob,
          duration: clip.duration,
          created_at: now,
        }
        await saveSoundEffect(se)
        newItems.push(se)
      }
      setSounds((prev) => [...newItems, ...prev])
    } catch (e) {
      console.error('[anime-app] seed se failed', e)
      alert('SEサンプル生成に失敗しました')
    } finally {
      setSeedingSe(false)
    }
  }

  // 複数ファイルをまとめて取り込む: 1ファイル = 1イラスト(1レイヤー)
  async function handleQuickAddImages(files: FileList | null) {
    if (!files || files.length === 0) return
    const now = new Date().toISOString()
    const created: IllustrationWithLayers[] = []
    for (const file of Array.from(files)) {
      const name = file.name.replace(/\.[^.]+$/, '')
      const illust: Illustration = {
        id: crypto.randomUUID(),
        name,
        created_at: now,
        updated_at: now,
      }
      try {
        await saveIllustration(illust)
        const layer: Layer = {
          id: crypto.randomUUID(),
          illustration_id: illust.id,
          name,
          image_url: URL.createObjectURL(file),
          image_blob: file,
          visible: true,
          opacity: 1,
          order_index: 0,
          created_at: now,
        }
        await saveLayer(layer)
        created.push({ ...illust, layers: [layer] })
      } catch (e) {
        console.error('[anime-app] quick add image failed', e)
      }
    }
    setIllustrations((prev) => [...created, ...prev])
    if (created[0]) setSelectedId(created[0].id)
  }

  // D&D: タブに応じてファイルを振り分ける
  function makeDropHandler(tab: 'images' | 'bgm' | 'se') {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDragOverTab(tab)
        }
      },
      onDragLeave: (e: React.DragEvent) => {
        // 子要素に移っただけでは leave 扱いしない
        if (e.currentTarget === e.target) setDragOverTab(null)
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        setDragOverTab(null)
        const files = e.dataTransfer.files
        if (!files || files.length === 0) return
        if (tab === 'images') {
          // 画像ファイルのみ通す
          const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'))
          if (imgs.length > 0) {
            const dt = new DataTransfer()
            imgs.forEach((f) => dt.items.add(f))
            handleQuickAddImages(dt.files)
          }
        } else {
          const audios = Array.from(files).filter((f) => f.type.startsWith('audio/'))
          if (audios.length > 0) {
            const dt = new DataTransfer()
            audios.forEach((f) => dt.items.add(f))
            if (tab === 'bgm') handleAddBgmFiles(dt.files)
            else handleAddSeFiles(dt.files)
          }
        }
      },
    }
  }

  async function handleSeedIllustrations() {
    if (seedingIllust) return
    setSeedingIllust(true)
    try {
      const samples = await generateSampleIllustrations()
      const now = new Date().toISOString()
      const created: IllustrationWithLayers[] = []
      for (const s of samples) {
        const illust: Illustration = {
          id: crypto.randomUUID(),
          name: s.name,
          created_at: now,
          updated_at: now,
        }
        await saveIllustration(illust)
        const layer: Layer = {
          id: crypto.randomUUID(),
          illustration_id: illust.id,
          name: s.name,
          image_url: URL.createObjectURL(s.blob),
          image_blob: s.blob,
          visible: true,
          opacity: 1,
          order_index: 0,
          created_at: now,
        }
        await saveLayer(layer)
        created.push({ ...illust, layers: [layer] })
      }
      setIllustrations((prev) => [...created, ...prev])
    } catch (e) {
      console.error('[anime-app] seed illustrations failed', e)
      alert('背景サンプル生成に失敗しました')
    } finally {
      setSeedingIllust(false)
    }
  }

  // ==================== BGM handlers ====================

  function readAudioDuration(file: File): Promise<number | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const audio = new Audio()
      audio.preload = 'metadata'
      audio.src = url
      const cleanup = () => {
        URL.revokeObjectURL(url)
        audio.src = ''
      }
      audio.onloadedmetadata = () => {
        const d = Number.isFinite(audio.duration) ? audio.duration : null
        cleanup()
        resolve(d)
      }
      audio.onerror = () => {
        cleanup()
        resolve(null)
      }
    })
  }

  async function handleAddBgmFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const now = new Date().toISOString()
    const newTracks: BgmTrack[] = []
    for (const file of Array.from(files)) {
      const duration = await readAudioDuration(file)
      const track: BgmTrack = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ''),
        file_url: URL.createObjectURL(file),
        file_blob: file,
        duration,
        created_at: now,
      }
      try {
        await saveBgmTrack(track)
        newTracks.push(track)
      } catch (e) {
        console.error('[anime-app] save bgm failed', e)
      }
    }
    setBgmTracks((prev) => [...newTracks, ...prev])
  }

  async function handleDeleteBgm(id: string) {
    if (!confirm('このBGMを削除してよろしいですか？(使用中のシーンからは自動で外れます)')) return
    const target = bgmTracks.find((t) => t.id === id)
    if (target?.file_url.startsWith('blob:')) URL.revokeObjectURL(target.file_url)
    await deleteBgmTrack(id)
    setBgmTracks((prev) => prev.filter((t) => t.id !== id))
  }

  async function handleRenameBgm(id: string, name: string) {
    const existing = bgmTracks.find((t) => t.id === id)
    if (!existing) return
    const updated = { ...existing, name }
    await saveBgmTrack(updated)
    setBgmTracks((prev) => prev.map((t) => (t.id === id ? updated : t)))
  }

  function formatDuration(sec: number | null): string {
    if (sec == null || !Number.isFinite(sec)) return '-'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  async function handleCreateIllustration(e: React.FormEvent) {
    e.preventDefault()
    if (!newIllustrationName.trim()) return
    const now = new Date().toISOString()
    const row: Illustration = {
      id: crypto.randomUUID(),
      name: newIllustrationName.trim(),
      created_at: now,
      updated_at: now,
    }
    await saveIllustration(row)
    const newIllust: IllustrationWithLayers = { ...row, layers: [] }
    setIllustrations((prev) => [newIllust, ...prev])
    setSelectedId(newIllust.id)
    setNewIllustrationName('')
  }

  async function handleDeleteIllustration(id: string) {
    if (!confirm('この素材(とすべてのレイヤー)を削除してよろしいですか？')) return
    const target = illustrations.find((i) => i.id === id)
    target?.layers.forEach((l) => {
      if (l.image_url.startsWith('blob:')) URL.revokeObjectURL(l.image_url)
    })
    await deleteIllustration(id)
    setIllustrations((prev) => prev.filter((i) => i.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  async function handleRenameIllustration(id: string, name: string) {
    const now = new Date().toISOString()
    const existing = illustrations.find((i) => i.id === id)
    if (!existing) return
    const updated: Illustration = {
      id: existing.id,
      name,
      created_at: existing.created_at,
      updated_at: now,
    }
    await saveIllustration(updated)
    setIllustrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, name, updated_at: now } : i)),
    )
  }

  function updateLayersLocal(
    illustrationId: string,
    mapper: (layers: Layer[]) => Layer[],
  ) {
    const now = new Date().toISOString()
    setIllustrations((prev) =>
      prev.map((i) =>
        i.id === illustrationId
          ? { ...i, layers: mapper(i.layers), updated_at: now }
          : i,
      ),
    )
  }

  async function handleAddLayerFiles(files: FileList | null) {
    if (!selected || !files || files.length === 0) return
    const baseOrder = selected.layers.reduce((max, l) => Math.max(max, l.order_index), -1)
    const now = new Date().toISOString()

    const newLayers: Layer[] = Array.from(files).map((file, i) => ({
      id: crypto.randomUUID(),
      illustration_id: selected.id,
      name: file.name.replace(/\.[^.]+$/, ''),
      image_url: URL.createObjectURL(file),
      image_blob: file,
      visible: true,
      opacity: 1,
      order_index: baseOrder + i + 1,
      created_at: now,
    }))

    try {
      await Promise.all(newLayers.map((l) => saveLayer(l)))
      updateLayersLocal(selected.id, (layers) => [...layers, ...newLayers])
    } catch (e) {
      console.error('[anime-app] save layer failed', e)
      alert('レイヤーの保存に失敗しました')
    }
  }

  async function handleDeleteLayer(layerId: string) {
    if (!selected) return
    const layer = selected.layers.find((l) => l.id === layerId)
    if (layer?.image_url.startsWith('blob:')) URL.revokeObjectURL(layer.image_url)
    await deleteLayer(layerId)
    updateLayersLocal(selected.id, (layers) => layers.filter((l) => l.id !== layerId))
  }

  async function handleRenameLayer(layerId: string, name: string) {
    if (!selected) return
    const layer = selected.layers.find((l) => l.id === layerId)
    if (!layer) return
    const updated = { ...layer, name }
    await saveLayer(updated)
    updateLayersLocal(selected.id, (layers) =>
      layers.map((l) => (l.id === layerId ? updated : l)),
    )
  }

  async function handleToggleVisible(layerId: string) {
    if (!selected) return
    const layer = selected.layers.find((l) => l.id === layerId)
    if (!layer) return
    const updated = { ...layer, visible: !layer.visible }
    await saveLayer(updated)
    updateLayersLocal(selected.id, (layers) =>
      layers.map((l) => (l.id === layerId ? updated : l)),
    )
  }

  async function handleChangeOpacity(layerId: string, opacity: number) {
    if (!selected) return
    const layer = selected.layers.find((l) => l.id === layerId)
    if (!layer) return
    const updated = { ...layer, opacity }
    updateLayersLocal(selected.id, (layers) =>
      layers.map((l) => (l.id === layerId ? updated : l)),
    )
    saveLayer(updated).catch((e) => console.error('[anime-app] save opacity failed', e))
  }

  async function handleMoveLayer(layerId: string, direction: 'up' | 'down') {
    if (!selected) return
    const sortedDesc = [...selected.layers].sort((a, b) => b.order_index - a.order_index)
    const idx = sortedDesc.findIndex((l) => l.id === layerId)
    if (idx === -1) return
    const swapWith = direction === 'up' ? idx - 1 : idx + 1
    if (swapWith < 0 || swapWith >= sortedDesc.length) return
    const a = sortedDesc[idx]
    const b = sortedDesc[swapWith]
    const newLayers = selected.layers.map((l) => {
      if (l.id === a.id) return { ...l, order_index: b.order_index }
      if (l.id === b.id) return { ...l, order_index: a.order_index }
      return l
    })
    await saveLayersBatch(newLayers.filter((l) => l.id === a.id || l.id === b.id))
    updateLayersLocal(selected.id, () => newLayers)
  }

  const layersTopFirst = selected
    ? [...selected.layers].sort((a, b) => b.order_index - a.order_index)
    : []
  const layersBackToFront = selected
    ? [...selected.layers].sort((a, b) => a.order_index - b.order_index)
    : []

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground">環境素材</h2>
              <p className="text-muted-foreground mt-1">背景・小物・BGM などキャラに依存しない素材を管理</p>
            </div>
          </div>

          <Tabs defaultValue="images" className="w-full">
            <TabsList>
              <TabsTrigger value="images" className="gap-2">
                <ImageIcon size={14} />
                画像・背景
              </TabsTrigger>
              <TabsTrigger value="bgm" className="gap-2">
                <Music size={14} />
                BGM
              </TabsTrigger>
              <TabsTrigger value="se" className="gap-2">
                <Zap size={14} />
                SE
              </TabsTrigger>
            </TabsList>

            <TabsContent value="images" className="mt-6 space-y-4">
              <div
                {...makeDropHandler('images')}
                className={`space-y-4 rounded-lg transition ${
                  dragOverTab === 'images' ? 'ring-2 ring-primary bg-primary/5 p-2' : ''
                }`}
              >
              {dragOverTab === 'images' && (
                <div className="text-center text-sm font-medium text-primary py-2">
                  ここに画像ファイルをドロップ(複数ファイル可)
                </div>
              )}
              <Card className="bg-card border-border p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">画像・背景素材</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      背景・小物などキャラ非依存の素材を管理(複数レイヤーで構成可)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={illustImageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleQuickAddImages(e.target.files)
                        if (illustImageInputRef.current) illustImageInputRef.current.value = ''
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSeedIllustrations}
                      disabled={seedingIllust}
                      className="gap-1"
                      title="Canvas で合成した権利フリーの背景サンプルを追加します"
                    >
                      <Sparkles size={14} />
                      {seedingIllust ? '生成中…' : 'サンプル追加'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => illustImageInputRef.current?.click()}
                      className="gap-1"
                      title="画像ファイルを複数選ぶと、それぞれ1レイヤーの素材として一括追加されます"
                    >
                      <Upload size={14} />
                      画像追加
                    </Button>
                  </div>
                </div>
              </Card>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <Card className="bg-card border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">素材一覧</h3>
                <form onSubmit={handleCreateIllustration} className="flex gap-2 mb-2">
                  <Input
                    type="text"
                    placeholder="新規素材名(例: 教室背景)"
                    value={newIllustrationName}
                    onChange={(e) => setNewIllustrationName(e.target.value)}
                    className="bg-background border-input"
                  />
                  <Button type="submit" size="sm" className="gap-1 flex-shrink-0">
                    <Plus size={16} />
                  </Button>
                </form>
                <Input
                  type="text"
                  placeholder="名前で検索..."
                  value={imgSearch}
                  onChange={(e) => setImgSearch(e.target.value)}
                  className="bg-background border-input mb-4 h-8 text-xs"
                />

                {loading ? (
                  <ListSkeleton rows={3} />
                ) : filteredIllustrations.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {imgSearch ? '該当する素材がありません' : '素材がまだありません'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredIllustrations.map((illust) => (
                      <div
                        key={illust.id}
                        onClick={() => setSelectedId(illust.id)}
                        className={`flex items-center justify-between gap-2 p-3 rounded-lg cursor-pointer transition ${
                          selectedId === illust.id
                            ? 'bg-primary/20 border border-primary/40'
                            : 'bg-background hover:bg-primary/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <ImageIcon size={16} className="text-primary flex-shrink-0" />
                          <p className="text-sm font-medium text-foreground truncate">
                            {illust.name}
                          </p>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {illust.layers.length} 層
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteIllustration(illust.id)
                          }}
                          className="p-1 hover:bg-destructive/20 rounded transition flex-shrink-0"
                        >
                          <Trash2 size={14} className="text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className="lg:col-span-2">
              {!selected ? (
                <Card className="bg-card border-border p-12 text-center">
                  <Layers size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    素材を選択してください
                  </h3>
                  <p className="text-muted-foreground">
                    左の一覧から選ぶか、新しく作成してください
                  </p>
                </Card>
              ) : (
                <div className="space-y-6">
                  <Card className="bg-card border-border p-4">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      素材名
                    </label>
                    <Input
                      type="text"
                      value={selected.name}
                      onChange={(e) => handleRenameIllustration(selected.id, e.target.value)}
                      className="bg-background border-input text-lg font-semibold"
                    />
                  </Card>

                  <Card className="bg-card border-border p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3">プレビュー</h4>
                    <div
                      className="relative w-full bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:24px_24px] rounded-lg overflow-hidden border border-border"
                      style={{ aspectRatio: '16 / 9' }}
                    >
                      {layersBackToFront.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                          レイヤーがありません
                        </div>
                      ) : (
                        layersBackToFront.map((layer) =>
                          layer.visible ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={layer.id}
                              src={layer.image_url}
                              alt={layer.name}
                              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                              style={{ opacity: layer.opacity }}
                            />
                          ) : null,
                        )
                      )}
                    </div>
                  </Card>

                  <Card className="bg-card border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-foreground">レイヤー (上が前面)</h4>
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            handleAddLayerFiles(e.target.files)
                            if (fileInputRef.current) fileInputRef.current.value = ''
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="gap-1"
                        >
                          <Upload size={14} />
                          レイヤー追加
                        </Button>
                      </div>
                    </div>

                    {layersTopFirst.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        「レイヤー追加」ボタンで画像を読み込んでください
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {layersTopFirst.map((layer, idx) => (
                          <div
                            key={layer.id}
                            className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border"
                          >
                            <div className="w-12 h-12 flex-shrink-0 bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:8px_8px] rounded overflow-hidden border border-border">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={layer.image_url}
                                alt={layer.name}
                                className="w-full h-full object-contain"
                              />
                            </div>

                            <div className="flex-1 min-w-0 space-y-1">
                              <Input
                                type="text"
                                value={layer.name}
                                onChange={(e) => handleRenameLayer(layer.id, e.target.value)}
                                className="bg-card border-input h-8 text-sm"
                              />
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-14 flex-shrink-0">
                                  不透明度
                                </span>
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  value={layer.opacity}
                                  onChange={(e) =>
                                    handleChangeOpacity(layer.id, Number(e.target.value))
                                  }
                                  className="flex-1 accent-primary"
                                />
                                <span className="text-xs text-muted-foreground w-10 text-right flex-shrink-0">
                                  {Math.round(layer.opacity * 100)}%
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => handleMoveLayer(layer.id, 'up')}
                                disabled={idx === 0}
                                className="p-2 hover:bg-primary/20 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                                title="上へ(前面)"
                              >
                                <ChevronUp size={16} />
                              </button>
                              <button
                                onClick={() => handleMoveLayer(layer.id, 'down')}
                                disabled={idx === layersTopFirst.length - 1}
                                className="p-2 hover:bg-primary/20 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                                title="下へ(背面)"
                              >
                                <ChevronDown size={16} />
                              </button>
                              <button
                                onClick={() => handleToggleVisible(layer.id)}
                                className="p-2 hover:bg-primary/20 rounded transition"
                                title={layer.visible ? '非表示にする' : '表示する'}
                              >
                                {layer.visible ? (
                                  <Eye size={16} className="text-primary" />
                                ) : (
                                  <EyeOff size={16} className="text-muted-foreground" />
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteLayer(layer.id)}
                                className="p-2 hover:bg-destructive/20 rounded transition"
                                title="削除"
                              >
                                <Trash2 size={16} className="text-destructive" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </div>
          </div>
              </div>
            </TabsContent>

            <TabsContent value="bgm" className="mt-6">
              <div
                {...makeDropHandler('bgm')}
                className={`rounded-lg transition ${
                  dragOverTab === 'bgm' ? 'ring-2 ring-primary bg-primary/5 p-2' : ''
                }`}
              >
              {dragOverTab === 'bgm' && (
                <div className="text-center text-sm font-medium text-primary py-2">
                  ここに音声ファイルをドロップしてBGMとして取り込み
                </div>
              )}
              <Card className="bg-card border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">BGMトラック</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      シーンに割り当てると会話と並行して再生されます(ループ・音量調整あり)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={bgmInputRef}
                      type="file"
                      accept="audio/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleAddBgmFiles(e.target.files)
                        if (bgmInputRef.current) bgmInputRef.current.value = ''
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSeedBgm}
                      disabled={seedingBgm}
                      className="gap-1"
                      title="Web Audio で合成した権利フリーのサンプルを追加します"
                    >
                      <Sparkles size={14} />
                      {seedingBgm ? '生成中…' : 'サンプル追加'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => bgmInputRef.current?.click()}
                      className="gap-1"
                    >
                      <Upload size={14} />
                      BGM追加
                    </Button>
                  </div>
                </div>

                <Input
                  type="text"
                  placeholder="BGMを名前で検索..."
                  value={bgmSearch}
                  onChange={(e) => setBgmSearch(e.target.value)}
                  className="bg-background border-input mb-3 h-8 text-xs"
                />

                {bgmLoading ? (
                  <ListSkeleton rows={3} />
                ) : filteredBgm.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    <Music size={32} className="mx-auto mb-2 opacity-50" />
                    {bgmSearch
                      ? '該当するBGMがありません'
                      : 'BGMがまだありません。「BGM追加」からアップロードしてください'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredBgm.map((track) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border"
                      >
                        <Music size={18} className="text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0 space-y-2">
                          <Input
                            type="text"
                            value={track.name}
                            onChange={(e) => handleRenameBgm(track.id, e.target.value)}
                            className="bg-card border-input h-8 text-sm"
                          />
                          <audio src={track.file_url} controls className="w-full h-8" />
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatDuration(track.duration)}
                          </span>
                          <button
                            onClick={() => handleDeleteBgm(track.id)}
                            className="p-1.5 hover:bg-destructive/20 rounded transition"
                            title="削除"
                          >
                            <Trash2 size={14} className="text-destructive" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              </div>
            </TabsContent>

            <TabsContent value="se" className="mt-6">
              <div
                {...makeDropHandler('se')}
                className={`rounded-lg transition ${
                  dragOverTab === 'se' ? 'ring-2 ring-primary bg-primary/5 p-2' : ''
                }`}
              >
              {dragOverTab === 'se' && (
                <div className="text-center text-sm font-medium text-primary py-2">
                  ここに音声ファイルをドロップしてSEとして取り込み
                </div>
              )}
              <Card className="bg-card border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">効果音(SE)</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      セリフの冒頭で鳴らす短いクリップ(ピコッ・ドンッ等)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={seInputRef}
                      type="file"
                      accept="audio/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleAddSeFiles(e.target.files)
                        if (seInputRef.current) seInputRef.current.value = ''
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSeedSe}
                      disabled={seedingSe}
                      className="gap-1"
                      title="Web Audio で合成した権利フリーのサンプルを追加します"
                    >
                      <Sparkles size={14} />
                      {seedingSe ? '生成中…' : 'サンプル追加'}
                    </Button>
                    <Button size="sm" onClick={() => seInputRef.current?.click()} className="gap-1">
                      <Upload size={14} />
                      SE追加
                    </Button>
                  </div>
                </div>

                <Input
                  type="text"
                  placeholder="SEを名前で検索..."
                  value={seSearch}
                  onChange={(e) => setSeSearch(e.target.value)}
                  className="bg-background border-input mb-3 h-8 text-xs"
                />

                {seLoading ? (
                  <ListSkeleton rows={3} />
                ) : filteredSe.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    <Zap size={32} className="mx-auto mb-2 opacity-50" />
                    {seSearch
                      ? '該当する効果音がありません'
                      : '効果音がまだありません。「SE追加」からアップロードしてください'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSe.map((se) => (
                      <div
                        key={se.id}
                        className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border"
                      >
                        <Zap size={18} className="text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0 space-y-2">
                          <Input
                            type="text"
                            value={se.name}
                            onChange={(e) => handleRenameSe(se.id, e.target.value)}
                            className="bg-card border-input h-8 text-sm"
                          />
                          <audio src={se.file_url} controls className="w-full h-8" />
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatDuration(se.duration)}
                          </span>
                          <button
                            onClick={() => handleDeleteSe(se.id)}
                            className="p-1.5 hover:bg-destructive/20 rounded transition"
                            title="削除"
                          >
                            <Trash2 size={14} className="text-destructive" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
