'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
} from 'lucide-react'
import type { IllustrationWithLayers, Layer, Illustration } from '@/types/db'
import {
  deleteIllustration,
  deleteLayer,
  getAllIllustrations,
  getLayersByIllustration,
  saveIllustration,
  saveLayer,
  saveLayersBatch,
} from '@/lib/db'
import { Sidebar } from '@/components/sidebar'

// 「環境」タブ: 背景・小物など、キャラに依存しない素材を管理する。
// 内部的には Illustration/Layer エンティティをそのまま使う(背景イラストなどが既に入っているかもしれないため)。
export default function EnvironmentPage() {
  const [illustrations, setIllustrations] = useState<IllustrationWithLayers[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newIllustrationName, setNewIllustrationName] = useState('')
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const selected = illustrations.find((i) => i.id === selectedId) ?? null

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
  }, [])

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
              <p className="text-muted-foreground mt-1">背景・小物などキャラ非依存の素材を管理(複数レイヤーで構成可)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <Card className="bg-card border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">素材一覧</h3>
                <form onSubmit={handleCreateIllustration} className="flex gap-2 mb-4">
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

                {loading ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    読み込み中...
                  </div>
                ) : illustrations.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    素材がまだありません
                  </div>
                ) : (
                  <div className="space-y-2">
                    {illustrations.map((illust) => (
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
      </main>
    </div>
  )
}
