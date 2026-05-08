'use client'

// シーン編集専用ページ。ストーリーボードの expand 内部が狭いので、
// シーン単体を広い作業領域でじっくり編集するために用意した。
// - 左: このシーンが属する動画内の他シーン一覧(クリックで切替)
// - 中央: タイトル・説明・プレビュー・セリフ編集
// - 右: キャスト・BGM・背景・カラータグ等のメタ情報

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Play,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
} from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { LipSyncStage } from '@/components/lip-sync-stage'
import { SaveStatusBadge, useSaveStatus } from '@/components/save-status'
import { useToast } from '@/components/toast'
import { SCENE_COLORS, sceneColorFor } from '@/lib/scene-colors'
import {
  deleteSceneDialogue,
  getAllAudioFiles,
  getAllBgmTracks,
  getAllCharacters,
  getAllDialogues,
  getAllExpressions,
  getAllIllustrations,
  getAllSceneCast,
  getAllSceneDialogues,
  getAllScenes,
  getAllSoundEffects,
  getAllVideos,
  getLayersByIllustration,
  getTelopStyle,
  saveDialogue,
  saveScene,
  saveSceneDialogue,
} from '@/lib/db'
import type {
  AudioFile,
  BgmTrack,
  Character,
  CharacterExpression,
  Dialogue,
  IllustrationWithLayers,
  Layer,
  Scene,
  SceneCastMember,
  SceneColorTag,
  SceneDialogue,
  SoundEffect,
  TelopStyle,
  Video,
} from '@/types/db'
import { DEFAULT_TELOP_STYLE } from '@/types/db'
import { charColorHsl } from '@/lib/char-color'

type SdWithDialogue = SceneDialogue & { dialogue: Dialogue | null }

export default function SceneEditorPage({
  params,
}: {
  params: Promise<{ sceneId: string }>
}) {
  const { sceneId } = use(params)
  const router = useRouter()
  const toast = useToast()
  const save = useSaveStatus()

  const [loading, setLoading] = useState(true)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [dialogues, setDialogues] = useState<Dialogue[]>([])
  const [sceneDialogues, setSceneDialogues] = useState<SdWithDialogue[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [expressions, setExpressions] = useState<CharacterExpression[]>([])
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [cast, setCast] = useState<SceneCastMember[]>([])
  const [bgmTracks, setBgmTracks] = useState<BgmTrack[]>([])
  const [sounds, setSounds] = useState<SoundEffect[]>([])
  const [illustrations, setIllustrations] = useState<IllustrationWithLayers[]>([])
  const [telopStyle, setTelopStyle] = useState<TelopStyle>(DEFAULT_TELOP_STYLE)
  // プレビュー中のセリフ index
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)

  const scene = scenes.find((s) => s.id === sceneId) ?? null

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [
          sc,
          vids,
          sd,
          dl,
          chs,
          exprs,
          au,
          cs,
          bgs,
          ses,
          illus,
          tp,
        ] = await Promise.all([
          getAllScenes(),
          getAllVideos(),
          getAllSceneDialogues(),
          getAllDialogues(),
          getAllCharacters(),
          getAllExpressions(),
          getAllAudioFiles(),
          getAllSceneCast(),
          getAllBgmTracks(),
          getAllSoundEffects(),
          getAllIllustrations(),
          getTelopStyle(),
        ])
        if (cancelled) return
        const withLayers: IllustrationWithLayers[] = await Promise.all(
          illus.map(async (i) => ({ ...i, layers: await getLayersByIllustration(i.id) })),
        )
        const dialogueById = new Map(dl.map((d) => [d.id, d]))
        const sceneSdList: SdWithDialogue[] = sd
          .filter((x) => x.scene_id === sceneId)
          .sort((a, b) => a.order_index - b.order_index)
          .map((x) => ({ ...x, dialogue: dialogueById.get(x.dialogue_id) ?? null }))
        setScenes(sc)
        setVideos(vids)
        setSceneDialogues(sceneSdList)
        setDialogues(dl)
        setCharacters(chs)
        setExpressions(exprs)
        setAudioFiles(au)
        setCast(cs)
        setBgmTracks(bgs)
        setSounds(ses)
        setIllustrations(withLayers)
        setTelopStyle(tp)
      } catch (e) {
        console.error('[scene-editor] load failed', e)
        toast.error('シーンの読み込みに失敗しました')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sceneId, toast])

  const video = scene?.video_id ? videos.find((v) => v.id === scene.video_id) ?? null : null
  const siblingScenes = useMemo(
    () =>
      scenes
        .filter((s) => (s.video_id ?? null) === (scene?.video_id ?? null))
        .sort((a, b) => a.order_index - b.order_index),
    [scenes, scene],
  )
  const mySiblingIdx = siblingScenes.findIndex((s) => s.id === sceneId)
  const prevScene = mySiblingIdx > 0 ? siblingScenes[mySiblingIdx - 1] : null
  const nextScene =
    mySiblingIdx >= 0 && mySiblingIdx < siblingScenes.length - 1
      ? siblingScenes[mySiblingIdx + 1]
      : null

  const castMembers = cast
    .filter((c) => c.scene_id === sceneId)
    .sort((a, b) => a.order_index - b.order_index)

  const bgLayers: Layer[] = useMemo(() => {
    if (!scene?.background_illustration_id) return []
    const illust = illustrations.find((i) => i.id === scene.background_illustration_id)
    if (!illust) return []
    return [...illust.layers]
      .filter((l) => l.visible)
      .sort((a, b) => a.order_index - b.order_index)
  }, [scene, illustrations])

  // 現在プレビュー中のセリフから LipSyncStage に渡すデータを組み立てる
  const previewSd =
    previewIdx !== null && previewIdx >= 0 && previewIdx < sceneDialogues.length
      ? sceneDialogues[previewIdx]
      : null
  const previewChar = previewSd?.dialogue?.character_id
    ? characters.find((c) => c.id === previewSd.dialogue!.character_id) ?? null
    : null
  const previewAudio = previewSd?.dialogue?.audio_id
    ? audioFiles.find((a) => a.id === previewSd.dialogue!.audio_id) ?? null
    : null
  const previewCharExprs = previewChar
    ? expressions.filter((e) => e.character_id === previewChar.id)
    : []
  const extras = previewSd
    ? castMembers
        .filter((m) => m.character_id !== previewSd.dialogue?.character_id)
        .map((m) => {
          const c = characters.find((cc) => cc.id === m.character_id)
          if (!c) return null
          return {
            character: c,
            expressions: expressions.filter((e) => e.character_id === m.character_id),
            x: m.x,
            scale: m.scale,
            idleExpressionId: m.idle_expression_id,
            flipped: !!m.flipped,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    : []

  // シーン保存
  async function persistScene(patch: Partial<Scene>) {
    if (!scene) return
    const now = new Date().toISOString()
    const updated: Scene = { ...scene, ...patch, updated_at: now }
    setScenes((prev) => prev.map((s) => (s.id === scene.id ? updated : s)))
    await save.track(saveScene(updated))
  }

  // セリフテキストの編集
  async function editDialogueText(dialogueId: string, text: string) {
    const d = dialogues.find((x) => x.id === dialogueId)
    if (!d) return
    const now = new Date().toISOString()
    const updated: Dialogue = { ...d, text, updated_at: now }
    setDialogues((prev) => prev.map((x) => (x.id === dialogueId ? updated : x)))
    setSceneDialogues((prev) =>
      prev.map((sd) => (sd.dialogue?.id === dialogueId ? { ...sd, dialogue: updated } : sd)),
    )
    await save.track(saveDialogue(updated))
  }

  async function addNarration() {
    if (!scene) return
    const now = new Date().toISOString()
    const maxOrder = sceneDialogues.reduce((m, sd) => Math.max(m, sd.order_index), -1)
    const d: Dialogue = {
      id: crypto.randomUUID(),
      text: '(新しいセリフ)',
      character_id: null,
      audio_id: null,
      expression_id: null,
      emotion: null,
      notes: 'narration',
      duration_ms: 3000,
      created_at: now,
      updated_at: now,
    }
    const sd: SceneDialogue = {
      id: crypto.randomUUID(),
      scene_id: scene.id,
      dialogue_id: d.id,
      order_index: maxOrder + 1,
      se_id: null,
      se_volume: 1,
      character_x: 0.5,
      character_scale: 1.0,
      pause_after_ms: 0,
      created_at: now,
    }
    await save.track(saveDialogue(d))
    await save.track(saveSceneDialogue(sd))
    setDialogues((prev) => [d, ...prev])
    setSceneDialogues((prev) => [...prev, { ...sd, dialogue: d }])
  }

  async function removeSd(sdId: string) {
    if (!window.confirm('このセリフをシーンから外しますか?')) return
    await save.track(deleteSceneDialogue(sdId))
    setSceneDialogues((prev) => prev.filter((x) => x.id !== sdId))
  }

  async function moveSd(sdId: string, step: -1 | 1) {
    const sorted = [...sceneDialogues].sort((a, b) => a.order_index - b.order_index)
    const idx = sorted.findIndex((x) => x.id === sdId)
    const swap = idx + step
    if (idx === -1 || swap < 0 || swap >= sorted.length) return
    const a = sorted[idx]
    const b = sorted[swap]
    const aNew = { ...a, order_index: b.order_index }
    const bNew = { ...b, order_index: a.order_index }
    const strip = (sd: typeof aNew) => {
      const { dialogue: _d, ...row } = sd
      void _d
      return row as SceneDialogue
    }
    await save.track(saveSceneDialogue(strip(aNew)))
    await save.track(saveSceneDialogue(strip(bNew)))
    setSceneDialogues((prev) =>
      prev.map((sd) => (sd.id === a.id ? aNew : sd.id === b.id ? bNew : sd)),
    )
  }

  async function duplicateSd(sdId: string) {
    const sd = sceneDialogues.find((x) => x.id === sdId)
    if (!sd?.dialogue) return
    const now = new Date().toISOString()
    const d: Dialogue = { ...sd.dialogue, id: crypto.randomUUID(), updated_at: now, created_at: now }
    const maxOrder = sceneDialogues.reduce((m, x) => Math.max(m, x.order_index), -1)
    const newSd: SceneDialogue = {
      ...sd,
      id: crypto.randomUUID(),
      dialogue_id: d.id,
      order_index: maxOrder + 1,
      created_at: now,
    }
    const { dialogue: _d, ...row } = newSd as typeof newSd & { dialogue?: unknown }
    void _d
    await save.track(saveDialogue(d))
    await save.track(saveSceneDialogue(row as SceneDialogue))
    setDialogues((prev) => [d, ...prev])
    setSceneDialogues((prev) => [...prev, { ...newSd, dialogue: d }])
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <p className="text-muted-foreground">シーンを読み込み中...</p>
        </main>
      </div>
    )
  }

  if (!scene) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-lg space-y-3">
            <h2 className="text-2xl font-bold text-foreground">シーンが見つかりません</h2>
            <p className="text-muted-foreground text-sm">
              このシーンは削除されたか、別端末のデータを参照している可能性があります。
            </p>
            <Link
              href="/storyboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
            >
              <ArrowLeft size={16} />
              ストーリーボードへ戻る
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const colorHex = sceneColorFor(scene.color_tag ?? null)?.hsl

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden grid grid-rows-[auto_1fr]">
        {/* 上部ナビゲーション */}
        <div className="border-b border-border p-4 flex items-center gap-3 flex-wrap bg-card">
          <Link
            href="/storyboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} />
            ストーリーボード
          </Link>
          {video && <span className="text-xs text-muted-foreground">/ {video.name}</span>}
          <span className="text-xs text-muted-foreground">
            / シーン {mySiblingIdx + 1} / {siblingScenes.length}
          </span>
          <SaveStatusBadge state={save.state} lastSavedAt={save.lastSavedAt} className="ml-2" />
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => prevScene && router.push(`/storyboard/scene/${prevScene.id}`)}
              disabled={!prevScene}
              className="gap-1"
            >
              <ChevronLeft size={14} />
              前のシーン
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => nextScene && router.push(`/storyboard/scene/${nextScene.id}`)}
              disabled={!nextScene}
              className="gap-1"
            >
              次のシーン
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>

        {/* 3 ペイン: 左=兄弟シーンリスト / 中=編集 / 右=メタ */}
        <div className="grid grid-cols-[220px_1fr_320px] overflow-hidden">
          {/* 左: 兄弟シーン */}
          <aside className="border-r border-border overflow-y-auto bg-card p-3 space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground px-2 py-1">
              {video?.name ?? '未分類'} のシーン
            </p>
            {siblingScenes.map((s, i) => {
              const color = sceneColorFor(s.color_tag ?? null)
              return (
                <Link
                  key={s.id}
                  href={`/storyboard/scene/${s.id}`}
                  className={`block px-2 py-1.5 rounded text-sm transition ${
                    s.id === sceneId
                      ? 'bg-primary/20 text-primary font-medium'
                      : 'text-foreground hover:bg-primary/10'
                  }`}
                  style={
                    color ? { borderLeft: `3px solid ${color.hsl}` } : undefined
                  }
                >
                  <span className="text-xs text-muted-foreground tabular-nums mr-1.5">
                    #{i + 1}
                  </span>
                  <span className="truncate">{s.title ?? '(無題)'}</span>
                </Link>
              )
            })}
          </aside>

          {/* 中央: 編集 */}
          <section className="overflow-y-auto p-6 space-y-6">
            {/* タイトル・色 */}
            <Card
              className="bg-card border-border p-4 space-y-3"
              style={colorHex ? { borderLeft: `4px solid ${colorHex}` } : undefined}
            >
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                  シーンタイトル
                </label>
                <Input
                  type="text"
                  value={scene.title ?? ''}
                  onChange={(e) => persistScene({ title: e.target.value })}
                  className="bg-background border-input"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                  説明 / メモ
                </label>
                <textarea
                  value={scene.description ?? ''}
                  onChange={(e) =>
                    persistScene({ description: e.target.value || null })
                  }
                  rows={3}
                  placeholder="このシーンの意図やメモ…"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                  カラータグ
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => persistScene({ color_tag: null })}
                    className={`h-7 w-7 rounded-full border-2 transition ${
                      !scene.color_tag
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-input hover:border-primary/50'
                    }`}
                  />
                  {SCENE_COLORS.map((c) => (
                    <button
                      key={c.tag}
                      type="button"
                      onClick={() =>
                        persistScene({ color_tag: c.tag as SceneColorTag })
                      }
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        scene.color_tag === c.tag
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-transparent hover:border-foreground/30'
                      }`}
                      style={{ background: c.hsl }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </Card>

            {/* プレビュー */}
            <Card className="bg-card border-border p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">プレビュー</h3>
                <div className="flex gap-2">
                  {sceneDialogues.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPreviewIdx((idx) =>
                          idx === null ? 0 : (idx + 1) % sceneDialogues.length,
                        )
                      }
                      className="gap-1"
                    >
                      <Play size={14} />
                      {previewIdx === null ? '最初から試聴' : '次のセリフ'}
                    </Button>
                  )}
                  {previewIdx !== null && (
                    <Button size="sm" variant="outline" onClick={() => setPreviewIdx(null)}>
                      停止
                    </Button>
                  )}
                </div>
              </div>
              <div className="aspect-video w-full bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] rounded-lg overflow-hidden border border-border">
                <LipSyncStage
                  character={previewChar}
                  expressions={previewCharExprs}
                  audioUrl={previewAudio?.file_url ?? null}
                  overrideExpressionId={previewSd?.dialogue?.expression_id ?? null}
                  caption={previewSd?.dialogue?.text ?? null}
                  telopStyle={telopStyle}
                  backgroundLayers={bgLayers}
                  characterX={previewSd?.character_x ?? 0.5}
                  characterScale={previewSd?.character_scale ?? 1.0}
                  characterFlipped={previewSd?.character_flipped ?? false}
                  extraCharacters={extras}
                  silentDurationMs={previewSd?.dialogue?.duration_ms ?? 3000}
                  audioVolume={previewSd?.voice_volume ?? 1}
                  playing={previewIdx !== null}
                  onEnded={() => {
                    setPreviewIdx((idx) => {
                      if (idx === null) return null
                      const next = idx + 1
                      return next < sceneDialogues.length ? next : null
                    })
                  }}
                />
              </div>
            </Card>

            {/* セリフ */}
            <Card className="bg-card border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  セリフ({sceneDialogues.length})
                </h3>
                <Button size="sm" onClick={addNarration} className="gap-1">
                  <Plus size={14} />
                  ナレーション追加
                </Button>
              </div>
              {sceneDialogues.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  セリフがまだありません。「ナレーション追加」から開始するか、
                  <Link href="/storyboard" className="text-primary hover:underline mx-1">
                    ストーリーボード
                  </Link>
                  でキャラクターのセリフを追加してください。
                </p>
              ) : (
                <ul className="space-y-2">
                  {sceneDialogues.map((sd, i) => {
                    const d = sd.dialogue
                    const char = d?.character_id
                      ? characters.find((c) => c.id === d.character_id) ?? null
                      : null
                    const isNarration = !char
                    return (
                      <li
                        key={sd.id}
                        className="p-3 bg-background rounded border border-border space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground tabular-nums w-6">
                            #{i + 1}
                          </span>
                          {isNarration ? (
                            <span className="inline-block text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded">
                              ナレーション
                            </span>
                          ) : (
                            char && (
                              <span
                                className="inline-block text-[10px] px-1.5 py-0.5 rounded text-white"
                                style={{ background: charColorHsl(char.id) }}
                              >
                                {char.name}
                              </span>
                            )
                          )}
                          <div className="ml-auto flex gap-1">
                            <button
                              onClick={() => setPreviewIdx(i)}
                              className="p-1 hover:bg-primary/20 rounded"
                              title="このセリフだけ試聴"
                            >
                              <Play size={12} className="text-primary" />
                            </button>
                            <button
                              onClick={() => duplicateSd(sd.id)}
                              className="p-1 hover:bg-primary/20 rounded"
                              title="複製"
                            >
                              <Copy size={12} className="text-primary" />
                            </button>
                            <button
                              onClick={() => moveSd(sd.id, -1)}
                              disabled={i === 0}
                              className="p-1 hover:bg-primary/20 rounded disabled:opacity-30"
                              title="上へ"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              onClick={() => moveSd(sd.id, 1)}
                              disabled={i === sceneDialogues.length - 1}
                              className="p-1 hover:bg-primary/20 rounded disabled:opacity-30"
                              title="下へ"
                            >
                              <ChevronDown size={12} />
                            </button>
                            <button
                              onClick={() => removeSd(sd.id)}
                              className="p-1 hover:bg-destructive/20 rounded"
                              title="シーンから外す"
                            >
                              <Trash2 size={12} className="text-destructive" />
                            </button>
                          </div>
                        </div>
                        {d ? (
                          <textarea
                            value={d.text}
                            onChange={(e) => editDialogueText(d.id, e.target.value)}
                            rows={2}
                            className="w-full px-2 py-1 bg-card border border-input rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                          />
                        ) : (
                          <p className="text-muted-foreground text-sm">(セリフ未解決)</p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </section>

          {/* 右: メタデータ */}
          <aside className="border-l border-border overflow-y-auto p-4 space-y-4 bg-card">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">背景</p>
              <select
                value={scene.background_illustration_id ?? ''}
                onChange={(e) =>
                  persistScene({ background_illustration_id: e.target.value || null })
                }
                className="w-full px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground"
              >
                <option value="">なし</option>
                {illustrations.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">BGM</p>
              <select
                value={scene.bgm_track_id ?? ''}
                onChange={(e) => persistScene({ bgm_track_id: e.target.value || null })}
                className="w-full px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground"
              >
                <option value="">なし</option>
                {bgmTracks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {scene.bgm_track_id && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-10">音量</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={scene.bgm_volume ?? 0.25}
                    onChange={(e) =>
                      persistScene({ bgm_volume: Number(e.target.value) })
                    }
                    className="flex-1 accent-primary"
                  />
                  <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                    {Math.round((scene.bgm_volume ?? 0.25) * 100)}%
                  </span>
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">
                登場キャスト({castMembers.length})
              </p>
              <p className="text-[11px] text-muted-foreground">
                キャストの追加や位置調整はストーリーボード画面で行ってください。
              </p>
              <ul className="mt-2 space-y-1">
                {castMembers.map((m) => {
                  const c = characters.find((x) => x.id === m.character_id)
                  if (!c) return null
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-2 p-2 bg-background rounded"
                    >
                      <span
                        className="h-4 w-1 rounded flex-shrink-0"
                        style={{ background: charColorHsl(c.id) }}
                      />
                      <span className="text-xs text-foreground truncate">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        x={m.x.toFixed(2)}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <Link
                href="/storyboard"
                className="inline-block mt-2 text-[11px] text-primary hover:underline"
              >
                ストーリーボードで詳細編集 →
              </Link>
            </div>
            <div className="text-[10px] text-muted-foreground border-t border-border pt-3">
              <p>作成: {new Date(scene.created_at).toLocaleString()}</p>
              <p>更新: {new Date(scene.updated_at).toLocaleString()}</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
