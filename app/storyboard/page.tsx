'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Film, Plus, Trash2, Edit2, GripVertical, Play, Square, SkipForward, Video as VideoIcon, Type, FlipHorizontal, ChevronDown, ChevronUp, Minimize2, Pencil, Folder, FolderPlus, Copy, Clock } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { SceneExportDialog } from '@/components/scene-export-dialog'
import { TelopSettingsDialog } from '@/components/telop-settings-dialog'
import { SceneTimelineBar, type TimelineClip } from '@/components/scene-timeline'
import { VideoExportDialog } from '@/components/video-export-dialog'
import type { Scene, Dialogue, SceneWithDialogues, Character, AudioFile, CharacterExpression, IllustrationWithLayers, Layer, BgmTrack, SoundEffect, SceneDialogue, TelopStyle, SceneCastMember, Video, CastPreset } from '@/types/db'
import { DEFAULT_TELOP_STYLE } from '@/types/db'
import {
  deleteCastPreset,
  deleteScene,
  deleteSceneCastMember,
  deleteSceneDialogue,
  deleteVideo,
  getAllAudioFiles,
  getAllBgmTracks,
  getAllCastPresets,
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
  saveCastPreset,
  saveDialogue,
  saveScene,
  saveSceneCastMember,
  saveSceneDialogue,
  saveScenesBatch,
  saveTelopStyle,
  saveVideo,
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
  const [cast, setCast] = useState<SceneCastMember[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null)
  const [editingVideoName, setEditingVideoName] = useState('')
  const [castPresets, setCastPresets] = useState<CastPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [showSceneForm, setShowSceneForm] = useState(false)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [sceneFormData, setSceneFormData] = useState({
    title: '',
    description: '',
    background_illustration_id: '',
    bgm_track_id: '',
    bgm_volume: 0.25,
    video_id: '',
  })
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [dialogueToAdd, setDialogueToAdd] = useState('')
  const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null)
  const [playingSceneId, setPlayingSceneId] = useState<string | null>(null)
  const [previewingSdId, setPreviewingSdId] = useState<string | null>(null)
  const [exportingSceneId, setExportingSceneId] = useState<string | null>(null)
  const [exportingVideoId, setExportingVideoId] = useState<string | null>(null)
  const [telopStyle, setTelopStyle] = useState<TelopStyle>(DEFAULT_TELOP_STYLE)
  const [showTelopSettings, setShowTelopSettings] = useState(false)
  // ナレーション追加フォーム(展開中のシーンに対して使う)
  const [narrationText, setNarrationText] = useState('')
  const [narrationAudioId, setNarrationAudioId] = useState('')
  const [narrationDurationSec, setNarrationDurationSec] = useState(3)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    try {
      const [rawScenes, sceneDialogues, allDialogues, allCharacters, allAudio, allExpressions, illusts, allBgm, allSe, savedTelop, allCast, loadedVideos, loadedPresets] = await Promise.all([
        getAllScenes(),
        getAllSceneDialogues(),
        getAllDialogues(),
        getAllCharacters(),
        getAllAudioFiles(),
        getAllExpressions(),
        getAllIllustrations(),
        getAllBgmTracks(),
        getAllSoundEffects(),
        getTelopStyle(),
        getAllSceneCast(),
        getAllVideos(),
        getAllCastPresets(),
      ])

      // 旧データ互換: 動画が1つもなく、未分類シーンがある場合は自動で「動画1」を作って全シーンを移す
      let workingVideos = loadedVideos
      let workingScenes = rawScenes
      if (workingVideos.length === 0 && rawScenes.length > 0) {
        const now = new Date().toISOString()
        const defaultVideo: Video = {
          id: crypto.randomUUID(),
          name: '動画1',
          order_index: 0,
          created_at: now,
          updated_at: now,
        }
        await saveVideo(defaultVideo)
        const migratedScenes = rawScenes.map((s) => ({ ...s, video_id: defaultVideo.id }))
        await Promise.all(migratedScenes.map((s) => saveScene(s)))
        workingVideos = [defaultVideo]
        workingScenes = migratedScenes
      }
      // まだ動画が1つもなければ 動画1 を作って選択状態にする
      if (workingVideos.length === 0) {
        const now = new Date().toISOString()
        const defaultVideo: Video = {
          id: crypto.randomUUID(),
          name: '動画1',
          order_index: 0,
          created_at: now,
          updated_at: now,
        }
        await saveVideo(defaultVideo)
        workingVideos = [defaultVideo]
      }
      const withLayers: IllustrationWithLayers[] = await Promise.all(
        illusts.map(async (i) => ({
          ...i,
          layers: await getLayersByIllustration(i.id),
        })),
      )
      const dialogueById = new Map(allDialogues.map((d) => [d.id, d]))
      const combined: SceneWithDialogues[] = workingScenes.map((scene) => ({
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
      setTelopStyle(savedTelop)
      setCast(allCast)
      setVideos(workingVideos)
      setCastPresets(loadedPresets)
      // デフォルト選択: 先頭の動画
      setSelectedVideoId((prev) => prev ?? workingVideos[0]?.id ?? null)
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

  // ==================== 動画(Video)管理 ====================

  async function handleCreateVideo() {
    const name = window.prompt(
      '新しい動画の名前を入力してください',
      `動画${videos.length + 1}`,
    )
    if (!name || !name.trim()) return
    const now = new Date().toISOString()
    const video: Video = {
      id: crypto.randomUUID(),
      name: name.trim(),
      order_index: videos.length,
      created_at: now,
      updated_at: now,
    }
    await saveVideo(video)
    setVideos((prev) => [...prev, video])
    setSelectedVideoId(video.id)
  }

  async function handleRenameVideo(id: string, name: string) {
    if (!name.trim()) return
    const existing = videos.find((v) => v.id === id)
    if (!existing) return
    const updated: Video = { ...existing, name: name.trim(), updated_at: new Date().toISOString() }
    await saveVideo(updated)
    setVideos((prev) => prev.map((v) => (v.id === id ? updated : v)))
  }

  async function handleDeleteVideo(id: string) {
    const video = videos.find((v) => v.id === id)
    if (!video) return
    const scenesInVideo = scenes.filter((s) => (s.video_id ?? null) === id).length
    const msg =
      scenesInVideo > 0
        ? `動画「${video.name}」を削除しますか?\n含まれる ${scenesInVideo} 個のシーンは「未分類」に移動します(シーン自体は削除されません)。`
        : `動画「${video.name}」を削除しますか?`
    if (!window.confirm(msg)) return
    await deleteVideo(id)
    setVideos((prev) => prev.filter((v) => v.id !== id))
    // シーン側の video_id を null に反映(DB は deleteVideo 内で既に更新済み)
    setScenes((prev) =>
      prev.map((s) => (s.video_id === id ? { ...s, video_id: null } : s)),
    )
    // 削除後は先頭の動画を選択(なければ null = 未分類)
    setSelectedVideoId(videos.find((v) => v.id !== id)?.id ?? null)
  }

  // シーン複製: Scene 本体 + その scene_cast + scene_dialogues を新 id で複製(Dialogue は共有)
  async function handleDuplicateScene(sceneId: string) {
    const source = scenes.find((s) => s.id === sceneId)
    if (!source) return
    const now = new Date().toISOString()
    const sameVideoScenes = scenes
      .filter((s) => (s.video_id ?? null) === (source.video_id ?? null))
      .sort((a, b) => a.order_index - b.order_index)
    const maxOrder =
      sameVideoScenes.length > 0
        ? sameVideoScenes[sameVideoScenes.length - 1].order_index
        : -1
    const newSceneId = crypto.randomUUID()
    const newScene: Scene = {
      id: newSceneId,
      title: (source.title ?? '') + ' (コピー)',
      description: source.description,
      background_illustration_id: source.background_illustration_id,
      bgm_track_id: source.bgm_track_id,
      bgm_volume: source.bgm_volume,
      video_id: source.video_id ?? null,
      order_index: maxOrder + 1,
      created_at: now,
      updated_at: now,
    }
    await saveScene(newScene)

    // キャスト複製
    const sourceCast = cast.filter((c) => c.scene_id === sceneId)
    const newCastMembers: SceneCastMember[] = sourceCast.map((c) => ({
      ...c,
      id: crypto.randomUUID(),
      scene_id: newSceneId,
      created_at: now,
    }))
    await Promise.all(newCastMembers.map((c) => saveSceneCastMember(c)))

    // セリフ複製(SceneDialogue のみ新しい id。Dialogue 自体は共有)
    const newSds = source.dialogues.map((sd) => ({
      id: crypto.randomUUID(),
      scene_id: newSceneId,
      dialogue_id: sd.dialogue_id,
      order_index: sd.order_index,
      se_id: sd.se_id ?? null,
      se_volume: typeof sd.se_volume === 'number' ? sd.se_volume : 1,
      character_x: typeof sd.character_x === 'number' ? sd.character_x : 0.5,
      character_scale:
        typeof sd.character_scale === 'number' ? sd.character_scale : 1.0,
      character_flipped: sd.character_flipped ?? false,
      pause_after_ms: typeof sd.pause_after_ms === 'number' ? sd.pause_after_ms : 0,
      created_at: now,
      dialogue: sd.dialogue,
    }))
    await Promise.all(
      newSds.map((sd) => {
        const { dialogue: _d, ...row } = sd
        void _d
        return saveSceneDialogue(row)
      }),
    )

    setScenes((prev) => [
      ...prev,
      {
        ...newScene,
        dialogues: newSds,
      },
    ])
    setCast((prev) => [...prev, ...newCastMembers])
  }

  // セリフ複製: 下敷きの Dialogue も新しい id で複製し、完全に独立したコピーにする
  async function handleDuplicateDialogue(sceneId: string, sdId: string) {
    const scene = scenes.find((s) => s.id === sceneId)
    const sd = scene?.dialogues.find((d) => d.id === sdId)
    if (!sd) return
    const now = new Date().toISOString()

    let newDialogue: Dialogue | null = null
    if (sd.dialogue) {
      newDialogue = {
        ...sd.dialogue,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      }
      await saveDialogue(newDialogue)
    }

    const maxOrder =
      scene?.dialogues.reduce((m, d) => Math.max(m, d.order_index), -1) ?? -1
    const newSd: SceneDialogue = {
      id: crypto.randomUUID(),
      scene_id: sceneId,
      dialogue_id: newDialogue?.id ?? sd.dialogue_id,
      order_index: maxOrder + 1,
      se_id: sd.se_id ?? null,
      se_volume: typeof sd.se_volume === 'number' ? sd.se_volume : 1,
      character_x: typeof sd.character_x === 'number' ? sd.character_x : 0.5,
      character_scale: typeof sd.character_scale === 'number' ? sd.character_scale : 1.0,
      character_flipped: sd.character_flipped ?? false,
      pause_after_ms: typeof sd.pause_after_ms === 'number' ? sd.pause_after_ms : 0,
      created_at: now,
    }
    await saveSceneDialogue(newSd)

    if (newDialogue) setDialogues((prev) => [newDialogue as Dialogue, ...prev])
    setScenes((prev) =>
      prev.map((s) =>
        s.id === sceneId
          ? {
              ...s,
              dialogues: [...s.dialogues, { ...newSd, dialogue: newDialogue }],
            }
          : s,
      ),
    )
  }

  // ある動画にシーンを移す(シーン編集フォームから使う)
  async function handleMoveSceneToVideo(sceneId: string, videoId: string | null) {
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene) return
    const updated: Scene = {
      id: scene.id,
      title: scene.title,
      description: scene.description,
      background_illustration_id: scene.background_illustration_id,
      bgm_track_id: scene.bgm_track_id,
      bgm_volume: scene.bgm_volume,
      video_id: videoId,
      order_index: scene.order_index,
      created_at: scene.created_at,
      updated_at: new Date().toISOString(),
    }
    await saveScene(updated)
    setScenes((prev) =>
      prev.map((s) =>
        s.id === sceneId ? { ...updated, dialogues: s.dialogues } : s,
      ),
    )
  }

  // タイムライン用: 各セリフ(SceneDialogue)の所要時間などを計算する
  function buildTimelineClips(scene: SceneWithDialogues): TimelineClip[] {
    return scene.dialogues.map((sd) => {
      const d = sd.dialogue
      const isNarration = !d?.character_id
      const character = characters.find((c) => c.id === d?.character_id)
      const audio = audioFiles.find((a) => a.id === d?.audio_id)
      const audioDuration = typeof audio?.duration === 'number' ? audio.duration : 0
      const silentMs = typeof d?.duration_ms === 'number' ? d.duration_ms : 3000
      const durationSec = audio ? audioDuration : silentMs / 1000
      return {
        id: sd.id,
        label: isNarration ? 'ナレーション' : character?.name ?? '?',
        durationSec: Math.max(0.1, durationSec),
        hasSe: !!sd.se_id,
        isNarration,
        text: d?.text ?? '',
      }
    })
  }

  // シーン内のセリフ(scene_dialogues)の並び替え
  async function handleReorderDialogues(sceneId: string, from: number, to: number) {
    if (from === to) return
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene) return
    const reordered = [...scene.dialogues]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    const renumbered = reordered.map((sd, idx) => ({ ...sd, order_index: idx }))

    // 各 SceneDialogue を永続化(dialogue は派生データなので保存しない)
    await Promise.all(
      renumbered.map((sd) => {
        const row: SceneDialogue = {
          id: sd.id,
          scene_id: sd.scene_id,
          dialogue_id: sd.dialogue_id,
          order_index: sd.order_index,
          se_id: sd.se_id ?? null,
          se_volume: typeof sd.se_volume === 'number' ? sd.se_volume : 1,
          character_x: typeof sd.character_x === 'number' ? sd.character_x : 0.5,
          character_scale:
            typeof sd.character_scale === 'number' ? sd.character_scale : 1.0,
          character_flipped: sd.character_flipped ?? false,
          pause_after_ms:
            typeof sd.pause_after_ms === 'number' ? sd.pause_after_ms : 0,
          created_at: sd.created_at,
        }
        return saveSceneDialogue(row)
      }),
    )

    setScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, dialogues: renumbered } : s)),
    )
  }

  function castForScene(sceneId: string): SceneCastMember[] {
    return cast
      .filter((c) => c.scene_id === sceneId)
      .sort((a, b) => a.order_index - b.order_index)
  }

  async function handleAddCastMember(sceneId: string, characterId: string) {
    if (!characterId) return
    const sceneCast = castForScene(sceneId)
    if (sceneCast.some((c) => c.character_id === characterId)) return // 重複不可
    const maxOrder = sceneCast.reduce((m, c) => Math.max(m, c.order_index), -1)
    const member: SceneCastMember = {
      id: crypto.randomUUID(),
      scene_id: sceneId,
      character_id: characterId,
      x: 0.5,
      scale: 1.0,
      idle_expression_id: null,
      order_index: maxOrder + 1,
      created_at: new Date().toISOString(),
    }
    await saveSceneCastMember(member)
    setCast((prev) => [...prev, member])
  }

  function updateCastMember(memberId: string, patch: Partial<SceneCastMember>) {
    setCast((prev) =>
      prev.map((c) => {
        if (c.id !== memberId) return c
        const merged = { ...c, ...patch }
        saveSceneCastMember(merged).catch((e) =>
          console.error('[anime-app] save cast member failed', e),
        )
        return merged
      }),
    )
  }

  async function handleDeleteCastMember(memberId: string) {
    await deleteSceneCastMember(memberId)
    setCast((prev) => prev.filter((c) => c.id !== memberId))
  }

  // 現在のシーンの登場キャラ構成をプリセットとして保存
  async function handleSaveCastPreset(sceneId: string) {
    const members = castForScene(sceneId)
    if (members.length === 0) {
      alert('保存できる登場キャラがいません')
      return
    }
    const name = window.prompt('プリセット名を入力してください', `プリセット${castPresets.length + 1}`)
    if (!name || !name.trim()) return
    const now = new Date().toISOString()
    const preset: CastPreset = {
      id: crypto.randomUUID(),
      name: name.trim(),
      members: members.map((m) => ({
        character_id: m.character_id,
        x: m.x,
        scale: m.scale,
        idle_expression_id: m.idle_expression_id,
        order_index: m.order_index,
        flipped: m.flipped ?? false,
      })),
      created_at: now,
      updated_at: now,
    }
    await saveCastPreset(preset)
    setCastPresets((prev) => [preset, ...prev])
  }

  // プリセットを別シーンに適用(既存のキャストは置き換える)
  async function handleApplyCastPreset(sceneId: string, presetId: string) {
    const preset = castPresets.find((p) => p.id === presetId)
    if (!preset) return
    if (
      !window.confirm(
        `プリセット「${preset.name}」を適用します。現在の登場キャラは上書きされます。よろしいですか?`,
      )
    )
      return
    const existing = cast.filter((c) => c.scene_id === sceneId)
    await Promise.all(existing.map((c) => deleteSceneCastMember(c.id)))
    const now = new Date().toISOString()
    const newMembers: SceneCastMember[] = preset.members.map((m) => ({
      id: crypto.randomUUID(),
      scene_id: sceneId,
      character_id: m.character_id,
      x: m.x,
      scale: m.scale,
      idle_expression_id: m.idle_expression_id,
      order_index: m.order_index,
      flipped: m.flipped ?? false,
      created_at: now,
    }))
    await Promise.all(newMembers.map((m) => saveSceneCastMember(m)))
    setCast((prev) => [...prev.filter((c) => c.scene_id !== sceneId), ...newMembers])
  }

  async function handleDeleteCastPreset(presetId: string) {
    const p = castPresets.find((x) => x.id === presetId)
    if (!p) return
    if (!window.confirm(`プリセット「${p.name}」を削除しますか?`)) return
    await deleteCastPreset(presetId)
    setCastPresets((prev) => prev.filter((x) => x.id !== presetId))
  }

  // ナレーション(character_id=null の Dialogue)を新規作成してシーンに追加する
  async function handleAddNarration(sceneId: string) {
    const text = narrationText.trim()
    if (!text) return
    const now = new Date().toISOString()
    const audioId = narrationAudioId || null
    const newDialogue: Dialogue = {
      id: crypto.randomUUID(),
      text,
      character_id: null,
      audio_id: audioId,
      expression_id: null,
      emotion: null,
      notes: 'narration',
      duration_ms: audioId ? null : Math.max(500, narrationDurationSec * 1000),
      created_at: now,
      updated_at: now,
    }
    await saveDialogue(newDialogue)

    const targetScene = scenes.find((s) => s.id === sceneId)
    const maxOrder =
      targetScene?.dialogues.reduce((m, sd) => Math.max(m, sd.order_index), -1) ?? -1
    const newSd: SceneDialogue = {
      id: crypto.randomUUID(),
      scene_id: sceneId,
      dialogue_id: newDialogue.id,
      order_index: maxOrder + 1,
      se_id: null,
      se_volume: 1,
      character_x: 0.5,
      character_scale: 1.0,
      pause_after_ms: 0,
      created_at: now,
    }
    await saveSceneDialogue(newSd)

    setDialogues((prev) => [newDialogue, ...prev])
    setScenes((prev) =>
      prev.map((s) =>
        s.id === sceneId
          ? { ...s, dialogues: [...s.dialogues, { ...newSd, dialogue: newDialogue }] }
          : s,
      ),
    )
    setNarrationText('')
    setNarrationAudioId('')
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
        video_id: sceneFormData.video_id || null,
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
        // 新規シーンは「今見ている動画」に所属させる(フォームで変更可)
        video_id: sceneFormData.video_id || selectedVideoId,
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
      video_id: '',
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
      character_x: 0.5,
      character_scale: 1.0,
      pause_after_ms: 0,
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

  // SceneDialogue の SE / キャラ位置 / 反転 / 間合い を更新
  function updateSceneDialogueMeta(
    sceneId: string,
    sdId: string,
    patch: Partial<
      Pick<
        SceneDialogue,
        | 'se_id'
        | 'se_volume'
        | 'character_x'
        | 'character_scale'
        | 'character_flipped'
        | 'pause_after_ms'
      >
    >,
  ) {
    setScenes((prev) =>
      prev.map((s) => {
        if (s.id !== sceneId) return s
        return {
          ...s,
          dialogues: s.dialogues.map((sd) => {
            if (sd.id !== sdId) return sd
            const merged = { ...sd, ...patch }
            const { dialogue: _drop, ...rowPart } = merged
            void _drop
            const row: SceneDialogue = {
              id: rowPart.id,
              scene_id: rowPart.scene_id,
              dialogue_id: rowPart.dialogue_id,
              order_index: rowPart.order_index,
              se_id: rowPart.se_id ?? null,
              se_volume: typeof rowPart.se_volume === 'number' ? rowPart.se_volume : 1,
              character_x:
                typeof rowPart.character_x === 'number' ? rowPart.character_x : 0.5,
              character_scale:
                typeof rowPart.character_scale === 'number' ? rowPart.character_scale : 1.0,
              character_flipped: rowPart.character_flipped ?? false,
              pause_after_ms:
                typeof rowPart.pause_after_ms === 'number' ? rowPart.pause_after_ms : 0,
              created_at: rowPart.created_at,
            }
            saveSceneDialogue(row).catch((e) =>
              console.error('[anime-app] save scene dialogue failed', e),
            )
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

  // 動画内でのシーン並び替え(ドラッグ&ドロップ)。
  // 表示中のシーンだけを対象に、既存の order_index 値を使い回して並び替える。
  async function handleReorderSceneById(fromId: string, toId: string) {
    if (fromId === toId) return
    const videoId = selectedVideoId
    const filtered = scenes
      .filter((s) => (s.video_id ?? null) === videoId)
      .sort((a, b) => a.order_index - b.order_index)
    const fromIdx = filtered.findIndex((s) => s.id === fromId)
    const toIdx = filtered.findIndex((s) => s.id === toId)
    if (fromIdx === -1 || toIdx === -1) return
    const working = [...filtered]
    const [moved] = working.splice(fromIdx, 1)
    working.splice(toIdx, 0, moved)
    // 既存の order_index スロットを再利用して入れ替える
    const slots = filtered.map((s) => s.order_index).sort((a, b) => a - b)
    const renumbered = working.map((s, i) => ({ ...s, order_index: slots[i] }))
    await saveScenesBatch(
      renumbered.map((s) => {
        const { dialogues: _d, ...row } = s
        void _d
        return row as Scene
      }),
    )
    setScenes((prev) => {
      const orderMap = new Map(renumbered.map((r) => [r.id, r.order_index]))
      return prev.map((s) =>
        orderMap.has(s.id) ? { ...s, order_index: orderMap.get(s.id) as number } : s,
      )
    })
  }

  function handleEditScene(scene: Scene) {
    setSceneFormData({
      title: scene.title || '',
      description: scene.description || '',
      background_illustration_id: scene.background_illustration_id || '',
      bgm_track_id: scene.bgm_track_id || '',
      bgm_volume: typeof scene.bgm_volume === 'number' ? scene.bgm_volume : 0.25,
      video_id: scene.video_id ?? '',
    })
    setEditingSceneId(scene.id)
    setShowSceneForm(true)
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold text-foreground">ストーリーボード</h2>
              <p className="text-muted-foreground mt-1">シーンを構築してストーリーを作成</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => selectedVideoId && setExportingVideoId(selectedVideoId)}
                disabled={
                  !selectedVideoId ||
                  scenes.filter((s) => (s.video_id ?? null) === selectedVideoId).length === 0
                }
                className="gap-2"
                title="この動画の全シーンを繋げて 1 本の動画に書き出す"
              >
                <VideoIcon size={16} />
                動画を書き出す
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowTelopSettings(true)}
                className="gap-2"
                title="テロップ(字幕)の見た目を調整"
              >
                <Type size={16} />
                テロップ設定
              </Button>
              <Button
                onClick={() => {
                  setEditingSceneId(null)
                  setSceneFormData({ title: '', description: '', background_illustration_id: '', bgm_track_id: '', bgm_volume: 0.25, video_id: '' })
                  setShowSceneForm(!showSceneForm)
                }}
                className="gap-2"
              >
                <Plus size={18} />
                新規シーン
              </Button>
            </div>
          </div>

          {/* 動画タブ(シーンをまとめる入れ物) */}
          <div className="mb-6 flex items-center gap-1 flex-wrap p-1.5 bg-card border border-border rounded-md">
            <Folder size={14} className="text-muted-foreground ml-1" />
            {videos.map((v) => {
              const isActive = v.id === selectedVideoId
              const isEditing = editingVideoId === v.id
              const sceneCount = scenes.filter((s) => (s.video_id ?? null) === v.id).length
              if (isEditing) {
                return (
                  <div key={v.id} className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={editingVideoName}
                      onChange={(e) => setEditingVideoName(e.target.value)}
                      onBlur={async () => {
                        if (editingVideoName.trim()) await handleRenameVideo(v.id, editingVideoName)
                        setEditingVideoId(null)
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          if (editingVideoName.trim()) await handleRenameVideo(v.id, editingVideoName)
                          setEditingVideoId(null)
                        } else if (e.key === 'Escape') {
                          setEditingVideoId(null)
                        }
                      }}
                      className="px-2 py-1 bg-background border border-primary rounded text-sm text-foreground focus:outline-none"
                    />
                  </div>
                )
              }
              return (
                <div
                  key={v.id}
                  className={`flex items-center gap-1 rounded border transition ${
                    isActive
                      ? 'bg-primary/20 border-primary/40'
                      : 'bg-background border-input hover:bg-primary/10'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedVideoId(v.id)}
                    className={`pl-3 pr-1 py-1 text-sm ${
                      isActive ? 'text-primary font-medium' : 'text-foreground'
                    }`}
                    title={`この動画のシーンを表示(${sceneCount} 個)`}
                  >
                    {v.name}
                    <span className="text-xs text-muted-foreground ml-1.5">
                      {sceneCount}
                    </span>
                  </button>
                  {isActive && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVideoId(v.id)
                          setEditingVideoName(v.name)
                        }}
                        className="p-1 hover:bg-primary/20 rounded transition"
                        title="名前変更"
                      >
                        <Pencil size={11} className="text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVideo(v.id)}
                        className="p-1 hover:bg-destructive/20 rounded transition mr-0.5"
                        title="動画を削除(シーンは未分類へ)"
                      >
                        <Trash2 size={11} className="text-destructive" />
                      </button>
                    </>
                  )}
                </div>
              )
            })}
            {/* 未分類(null のシーンが1つ以上あるときだけ表示) */}
            {scenes.some((s) => (s.video_id ?? null) === null) && (
              <button
                type="button"
                onClick={() => setSelectedVideoId(null)}
                className={`px-3 py-1 text-sm rounded border transition ${
                  selectedVideoId === null
                    ? 'bg-primary/20 border-primary/40 text-primary font-medium'
                    : 'bg-background border-input text-muted-foreground hover:bg-primary/10'
                }`}
                title="どの動画にも所属していないシーン"
              >
                未分類
                <span className="text-xs ml-1.5">
                  {scenes.filter((s) => (s.video_id ?? null) === null).length}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCreateVideo}
              className="px-2 py-1 text-sm rounded border border-dashed border-input text-muted-foreground hover:bg-primary/10 hover:text-primary transition gap-1 inline-flex items-center"
              title="新規動画"
            >
              <FolderPlus size={12} />
              新規
            </button>
          </div>

          {showSceneForm && (
            <Card className="bg-card border-border p-6 mb-8">
              <h3 className="text-xl font-semibold text-foreground mb-4">
                {editingSceneId ? 'シーンを編集' : '新規シーンを作成'}
              </h3>
              <form onSubmit={handleAddScene} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">所属動画</label>
                  <select
                    value={sceneFormData.video_id}
                    onChange={(e) => setSceneFormData({ ...sceneFormData, video_id: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">未分類</option>
                    {videos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    シーンが所属する動画。後から変更するとタブ間で移動します。
                  </p>
                </div>
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
                      setSceneFormData({ title: '', description: '', background_illustration_id: '', bgm_track_id: '', bgm_volume: 0.25, video_id: '' })
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
              ) : (() => {
                const filteredScenes = scenes
                  .filter((s) => (s.video_id ?? null) === selectedVideoId)
                  .sort((a, b) => a.order_index - b.order_index)
                if (filteredScenes.length === 0) {
                  return (
                    <Card className="bg-card border-border p-12 text-center">
                      <Film size={48} className="mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        この動画にはまだシーンがありません
                      </h3>
                      <p className="text-muted-foreground">
                        「新規シーン」ボタンで最初のシーンを作成してください
                      </p>
                    </Card>
                  )
                }
                return (
                <div className="space-y-3">
                  {filteredScenes.map((scene, index) => (
                    <Card
                      key={scene.id}
                      draggable
                      onDragStart={() => setDraggedSceneId(scene.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedSceneId && draggedSceneId !== scene.id) {
                          handleReorderSceneById(draggedSceneId, scene.id)
                        }
                      }}
                      className="bg-card border-border p-4 hover:border-primary/50 transition cursor-move"
                    >
                      <div className="flex items-start gap-4">
                        <GripVertical size={20} className="text-muted-foreground mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          {/* クリックで展開/縮小するのはヘッダー部分だけ。展開内容は通常のdivなのでクリックが誤って反映されない */}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedSceneId(selectedSceneId === scene.id ? null : scene.id)
                            }
                            className="w-full text-left cursor-pointer block"
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
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-3 flex-wrap">
                              <span>セリフ数: {scene.dialogues?.length || 0}</span>
                              {(() => {
                                const totalSec = buildTimelineClips(scene).reduce(
                                  (sum, c) => sum + c.durationSec,
                                  0,
                                )
                                return totalSec > 0 ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock size={10} />
                                    {totalSec.toFixed(1)}秒
                                  </span>
                                ) : null
                              })()}
                              {scene.bgm_track_id &&
                                bgmTracks.find((b) => b.id === scene.bgm_track_id) && (
                                  <span>
                                    BGM: {bgmTracks.find((b) => b.id === scene.bgm_track_id)?.name}
                                  </span>
                                )}
                            </p>
                          </button>

                          {selectedSceneId === scene.id && (
                            <div
                              className="mt-4 pt-4 border-t border-border space-y-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* 縮めるボタン(展開中の編集UIがクリックで誤って閉じないように、明示ボタンで閉じる) */}
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedSceneId(null)}
                                  className="gap-1 h-7 px-2 text-xs"
                                >
                                  <Minimize2 size={12} />
                                  縮める
                                </Button>
                              </div>

                              {/* ===== タイムライン ===== */}
                              <SceneTimelineBar
                                clips={buildTimelineClips(scene)}
                                bgmName={bgmForScene(scene)?.name ?? null}
                                onReorder={(from, to) =>
                                  handleReorderDialogues(scene.id, from, to)
                                }
                              />

                              {/* ===== 登場キャラ(scene_cast) ===== */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <h5 className="font-medium text-foreground">登場キャラ</h5>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {castPresets.length > 0 && (
                                      <select
                                        value=""
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleApplyCastPreset(scene.id, e.target.value)
                                            e.target.value = ''
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="px-2 py-1 bg-card border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                        title="保存したプリセットを適用(現在のキャストは置き換え)"
                                      >
                                        <option value="">プリセット適用</option>
                                        {castPresets.map((p) => (
                                          <option key={p.id} value={p.id}>
                                            {p.name} ({p.members.length}人)
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleSaveCastPreset(scene.id)}
                                      disabled={castForScene(scene.id).length === 0}
                                      className="px-2 py-1 text-xs rounded border border-input text-foreground hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="現在のキャストをプリセットとして保存"
                                    >
                                      プリセット保存
                                    </button>
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleAddCastMember(scene.id, e.target.value)
                                          e.target.value = ''
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="px-2 py-1 bg-card border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                      <option value="">+ キャラ追加</option>
                                      {characters
                                        .filter(
                                          (c) =>
                                            !castForScene(scene.id).some((m) => m.character_id === c.id),
                                        )
                                        .map((c) => (
                                          <option key={c.id} value={c.id}>
                                            {c.name}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                </div>
                                {castForScene(scene.id).length === 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    登場キャラがありません。キャストを追加すると、その配置が全セリフに適用されます
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {castForScene(scene.id).map((member) => {
                                      const char = characters.find((c) => c.id === member.character_id)
                                      const charExprs = expressions.filter(
                                        (e) => e.character_id === member.character_id,
                                      )
                                      const mx = member.x
                                      const ms = member.scale
                                      const mPos: 'left' | 'center' | 'right' =
                                        mx < 0.35 ? 'left' : mx > 0.65 ? 'right' : 'center'
                                      const mSize: 'small' | 'medium' | 'large' =
                                        ms < 0.7 ? 'small' : ms < 0.95 ? 'medium' : 'large'
                                      const btn = (active: boolean) =>
                                        `px-2 py-0.5 text-xs rounded border transition ${
                                          active
                                            ? 'bg-primary/20 border-primary/40 text-primary'
                                            : 'bg-card border-input text-muted-foreground hover:bg-primary/10'
                                        }`
                                      return (
                                        <div
                                          key={member.id}
                                          className="p-2 bg-background rounded border border-border space-y-2"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium text-foreground truncate">
                                              {char?.name ?? '(削除済み)'}
                                            </p>
                                            <button
                                              onClick={() => handleDeleteCastMember(member.id)}
                                              className="p-1 hover:bg-destructive/20 rounded transition flex-shrink-0"
                                              title="キャストから外す"
                                            >
                                              <Trash2 size={14} className="text-destructive" />
                                            </button>
                                          </div>
                                          <div className="flex items-center gap-2 flex-wrap text-xs">
                                            <span className="text-muted-foreground">位置</span>
                                            <button
                                              type="button"
                                              onClick={() => updateCastMember(member.id, { x: 0.25 })}
                                              className={btn(mPos === 'left')}
                                            >
                                              左
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => updateCastMember(member.id, { x: 0.5 })}
                                              className={btn(mPos === 'center')}
                                            >
                                              中
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => updateCastMember(member.id, { x: 0.75 })}
                                              className={btn(mPos === 'right')}
                                            >
                                              右
                                            </button>
                                            <span className="text-muted-foreground">|</span>
                                            <span className="text-muted-foreground">サイズ</span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateCastMember(member.id, { scale: 0.55 })
                                              }
                                              className={btn(mSize === 'small')}
                                            >
                                              小
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateCastMember(member.id, { scale: 0.8 })
                                              }
                                              className={btn(mSize === 'medium')}
                                            >
                                              中
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateCastMember(member.id, { scale: 1.0 })
                                              }
                                              className={btn(mSize === 'large')}
                                            >
                                              大
                                            </button>
                                            <span className="text-muted-foreground">|</span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateCastMember(member.id, { flipped: !member.flipped })
                                              }
                                              className={`${btn(!!member.flipped)} gap-1 inline-flex items-center`}
                                              title="左右反転"
                                            >
                                              <FlipHorizontal size={12} />
                                              反転
                                            </button>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground flex-shrink-0">
                                              アイドル表情
                                            </span>
                                            <select
                                              value={member.idle_expression_id ?? ''}
                                              onChange={(e) =>
                                                updateCastMember(member.id, {
                                                  idle_expression_id: e.target.value || null,
                                                })
                                              }
                                              className="flex-1 min-w-0 px-2 py-1 bg-card border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                            >
                                              <option value="">自動(口閉じ優先)</option>
                                              {charExprs.map((e) => (
                                                <option key={e.id} value={e.id}>
                                                  {e.name}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* ===== セリフ ===== */}
                              <h5 className="font-medium text-foreground">シーン内のセリフ</h5>
                              {scene.dialogues && scene.dialogues.length > 0 ? (
                                <div className="space-y-2">
                                  {scene.dialogues.map((sd) => {
                                    const isNarration = !sd.dialogue?.character_id
                                    const seVol = typeof sd.se_volume === 'number' ? sd.se_volume : 1
                                    const cx = typeof sd.character_x === 'number' ? sd.character_x : 0.5
                                    const cs = typeof sd.character_scale === 'number' ? sd.character_scale : 1.0
                                    const posPreset: 'left' | 'center' | 'right' =
                                      cx < 0.35 ? 'left' : cx > 0.65 ? 'right' : 'center'
                                    const sizePreset: 'small' | 'medium' | 'large' =
                                      cs < 0.7 ? 'small' : cs < 0.95 ? 'medium' : 'large'
                                    const presetBtn = (active: boolean) =>
                                      `px-2 py-0.5 text-xs rounded border transition ${
                                        active
                                          ? 'bg-primary/20 border-primary/40 text-primary'
                                          : 'bg-card border-input text-muted-foreground hover:bg-primary/10'
                                      }`
                                    return (
                                      <div
                                        key={sd.id}
                                        className="p-2 bg-background rounded text-sm space-y-2"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                            {isNarration && (
                                              <span className="inline-block text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded mr-2 align-middle">
                                                ナレーション
                                              </span>
                                            )}
                                            <span className="text-foreground break-words">
                                              {sd.dialogue?.text}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                              onClick={() => setPreviewingSdId(sd.id)}
                                              className="p-1 hover:bg-primary/20 rounded transition"
                                              title="このセリフだけ再生"
                                            >
                                              <Play size={12} className="text-primary" />
                                            </button>
                                            <button
                                              onClick={() => handleDuplicateDialogue(scene.id, sd.id)}
                                              className="p-1 hover:bg-primary/20 rounded transition"
                                              title="このセリフを複製"
                                            >
                                              <Copy size={12} className="text-primary" />
                                            </button>
                                            <button
                                              onClick={() => handleRemoveDialogue(sd.id)}
                                              className="p-1 hover:bg-destructive/20 rounded transition"
                                              title="シーンから外す"
                                            >
                                              <Trash2 size={14} className="text-destructive" />
                                            </button>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground flex-shrink-0">SE</span>
                                          <select
                                            value={sd.se_id ?? ''}
                                            onChange={(e) =>
                                              updateSceneDialogueMeta(scene.id, sd.id, {
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
                                                  updateSceneDialogueMeta(scene.id, sd.id, {
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
                                        {!isNarration && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs text-muted-foreground flex-shrink-0">立ち位置</span>
                                          <div className="flex gap-1">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateSceneDialogueMeta(scene.id, sd.id, { character_x: 0.25 })
                                              }
                                              className={presetBtn(posPreset === 'left')}
                                              title="左"
                                            >
                                              左
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateSceneDialogueMeta(scene.id, sd.id, { character_x: 0.5 })
                                              }
                                              className={presetBtn(posPreset === 'center')}
                                              title="中央"
                                            >
                                              中
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateSceneDialogueMeta(scene.id, sd.id, { character_x: 0.75 })
                                              }
                                              className={presetBtn(posPreset === 'right')}
                                              title="右"
                                            >
                                              右
                                            </button>
                                          </div>
                                          <span className="text-muted-foreground text-xs flex-shrink-0">|</span>
                                          <span className="text-xs text-muted-foreground flex-shrink-0">サイズ</span>
                                          <div className="flex gap-1">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateSceneDialogueMeta(scene.id, sd.id, { character_scale: 0.55 })
                                              }
                                              className={presetBtn(sizePreset === 'small')}
                                              title="小さめ"
                                            >
                                              小
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateSceneDialogueMeta(scene.id, sd.id, { character_scale: 0.8 })
                                              }
                                              className={presetBtn(sizePreset === 'medium')}
                                              title="普通"
                                            >
                                              中
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateSceneDialogueMeta(scene.id, sd.id, { character_scale: 1.0 })
                                              }
                                              className={presetBtn(sizePreset === 'large')}
                                              title="大きめ(画面いっぱい)"
                                            >
                                              大
                                            </button>
                                          </div>
                                          <span className="text-muted-foreground text-xs flex-shrink-0">|</span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateSceneDialogueMeta(scene.id, sd.id, {
                                                character_flipped: !sd.character_flipped,
                                              })
                                            }
                                            className={`${presetBtn(!!sd.character_flipped)} gap-1 inline-flex items-center`}
                                            title="左右反転(斜め前向きの立ち絵を逆向きに)"
                                          >
                                            <FlipHorizontal size={12} />
                                            反転
                                          </button>
                                        </div>
                                        )}
                                        {/* 間合い(このセリフを終えてから次へ進むまでの無音) */}
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground flex-shrink-0">
                                            間合い
                                          </span>
                                          <input
                                            type="range"
                                            min={0}
                                            max={3000}
                                            step={100}
                                            value={sd.pause_after_ms ?? 0}
                                            onChange={(e) =>
                                              updateSceneDialogueMeta(scene.id, sd.id, {
                                                pause_after_ms: Number(e.target.value),
                                              })
                                            }
                                            className="flex-1 accent-primary"
                                          />
                                          <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                                            {((sd.pause_after_ms ?? 0) / 1000).toFixed(1)}秒
                                          </span>
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
                                  {dialogues
                                    .filter((d) => d.character_id)
                                    .map((d) => (
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
                              {/* ナレーション追加(キャラなし字幕) */}
                              <div className="space-y-2 p-2 bg-background rounded border border-dashed border-border">
                                <p className="text-xs text-muted-foreground">
                                  ナレーション(キャラなし字幕)を追加
                                </p>
                                <textarea
                                  placeholder="ナレーションのテキスト..."
                                  value={narrationText}
                                  onChange={(e) => setNarrationText(e.target.value)}
                                  rows={2}
                                  className="w-full px-2 py-1 bg-card border border-input rounded text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-muted-foreground flex-shrink-0">
                                    音声
                                  </span>
                                  <select
                                    value={narrationAudioId}
                                    onChange={(e) => setNarrationAudioId(e.target.value)}
                                    className="flex-1 min-w-[120px] px-2 py-1 bg-card border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                  >
                                    <option value="">なし(無音)</option>
                                    {audioFiles.map((a) => (
                                      <option key={a.id} value={a.id}>
                                        {a.name}
                                      </option>
                                    ))}
                                  </select>
                                  {!narrationAudioId && (
                                    <>
                                      <span className="text-xs text-muted-foreground flex-shrink-0">
                                        表示秒
                                      </span>
                                      <input
                                        type="number"
                                        min={0.5}
                                        max={30}
                                        step={0.5}
                                        value={narrationDurationSec}
                                        onChange={(e) =>
                                          setNarrationDurationSec(Number(e.target.value) || 3)
                                        }
                                        className="w-16 px-2 py-1 bg-card border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                      />
                                    </>
                                  )}
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddNarration(scene.id)}
                                    disabled={!narrationText.trim()}
                                    className="ml-auto"
                                  >
                                    追加
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedSceneId(
                                selectedSceneId === scene.id ? null : scene.id,
                              )
                            }}
                            className="p-2 hover:bg-primary/20 rounded-lg transition"
                            title={selectedSceneId === scene.id ? '縮める' : '展開'}
                          >
                            {selectedSceneId === scene.id ? (
                              <ChevronUp size={16} className="text-primary" />
                            ) : (
                              <ChevronDown size={16} className="text-primary" />
                            )}
                          </button>
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
                            <VideoIcon size={16} className="text-primary" />
                          </button>
                          <button
                            onClick={() => handleDuplicateScene(scene.id)}
                            className="p-2 hover:bg-primary/20 rounded-lg transition"
                            title="シーンを複製(キャスト・セリフ構成ごと)"
                          >
                            <Copy size={16} className="text-primary" />
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
                )
              })()}
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
              telopStyle={telopStyle}
              sceneCast={playScene ? castForScene(playScene.id) : []}
              onClose={() => setPlayingSceneId(null)}
            />
            {/* セリフ単体プレビュー: previewingSdId を含むシーンを対象に1セリフだけ再生 */}
            {(() => {
              const previewScene = previewingSdId
                ? scenes.find((s) => s.dialogues.some((d) => d.id === previewingSdId)) ?? null
                : null
              return (
                <ScenePlayerDialog
                  scene={previewScene}
                  characters={characters}
                  audioFiles={audioFiles}
                  expressions={expressions}
                  backgroundLayers={
                    previewScene ? backgroundLayersForScene(previewScene) : []
                  }
                  bgmTrack={previewScene ? bgmForScene(previewScene) : null}
                  bgmVolume={
                    previewScene && typeof previewScene.bgm_volume === 'number'
                      ? previewScene.bgm_volume
                      : 0.25
                  }
                  sounds={sounds}
                  telopStyle={telopStyle}
                  sceneCast={previewScene ? castForScene(previewScene.id) : []}
                  startAtSdId={previewingSdId}
                  singleMode
                  onClose={() => setPreviewingSdId(null)}
                />
              )
            })()}
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
              telopStyle={telopStyle}
              sceneCast={exportScene ? castForScene(exportScene.id) : []}
              open={!!exportingSceneId}
              onClose={() => setExportingSceneId(null)}
            />
            <TelopSettingsDialog
              open={showTelopSettings}
              initialStyle={telopStyle}
              onSave={async (next) => {
                await saveTelopStyle(next)
                setTelopStyle(next)
              }}
              onClose={() => setShowTelopSettings(false)}
            />
            <VideoExportDialog
              videoName={videos.find((v) => v.id === exportingVideoId)?.name ?? '動画'}
              scenes={scenes
                .filter((s) => (s.video_id ?? null) === exportingVideoId)
                .sort((a, b) => a.order_index - b.order_index)}
              characters={characters}
              audioFiles={audioFiles}
              expressions={expressions}
              bgmTracks={bgmTracks}
              sounds={sounds}
              illustrations={illustrations}
              sceneCast={cast}
              telopStyle={telopStyle}
              open={!!exportingVideoId}
              onClose={() => setExportingVideoId(null)}
            />
          </>
        )
      })()}
    </div>
  )
}

// ==================== シーン再生ダイアログ ====================

interface SceneDialogueResolved {
  sdId: string
  text: string
  character: Character | null
  audio: AudioFile | null
  expressionId: string | null
  charExpressions: CharacterExpression[]
  se: SoundEffect | null
  seVolume: number
  characterX: number
  characterScale: number
  characterFlipped: boolean
  extras: StageExtraResolved[]
  // ナレーション(無音)用の表示時間 ms。audio がある場合は無視される
  silentDurationMs: number
  // 次のセリフに進む前の間合い(ms)
  pauseAfterMs: number
}

interface StageExtraResolved {
  character: Character
  expressions: CharacterExpression[]
  x: number
  scale: number
  idleExpressionId: string | null
  flipped: boolean
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
  telopStyle,
  sceneCast,
  startAtSdId,
  singleMode,
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
  telopStyle: TelopStyle
  sceneCast: SceneCastMember[]
  startAtSdId?: string | null // この SceneDialogue から再生を開始
  singleMode?: boolean // true のとき 1 セリフだけ再生して停止(プレビュー用)
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const bgmRef = useRef<HTMLAudioElement | null>(null)
  const seRef = useRef<HTMLAudioElement | null>(null)
  const pauseTimerRef = useRef<number | null>(null)

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

  // キャラ+音声が揃っているセリフ、またはナレーション(キャラなし、テキストあり)を再生対象にする
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
      // キャストに発話者がいればその座標を優先、無ければ A2 のセリフ設定
      const speakerCast = sceneCast.find((m) => m.character_id === d.character_id)
      const characterX =
        speakerCast?.x ??
        (typeof sd.character_x === 'number' ? sd.character_x : 0.5)
      const characterScale =
        speakerCast?.scale ??
        (typeof sd.character_scale === 'number' ? sd.character_scale : 1.0)
      const characterFlipped =
        typeof speakerCast?.flipped === 'boolean'
          ? !!speakerCast.flipped
          : !!sd.character_flipped
      // 共演者(キャスト - 発話者)
      const extras: StageExtraResolved[] = sceneCast
        .filter((m) => m.character_id !== d.character_id)
        .map((m) => {
          const c = characters.find((ch) => ch.id === m.character_id)
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
        .filter((x): x is StageExtraResolved => x !== null)
      const silentDurationMs =
        typeof d.duration_ms === 'number' && d.duration_ms > 0 ? d.duration_ms : 3000
      const pauseAfterMs =
        typeof sd.pause_after_ms === 'number' && sd.pause_after_ms > 0 ? sd.pause_after_ms : 0
      return {
        sdId: sd.id,
        text: d.text,
        character,
        audio,
        expressionId: d.expression_id,
        charExpressions,
        se,
        seVolume,
        characterX,
        characterScale,
        characterFlipped,
        extras,
        silentDurationMs,
        pauseAfterMs,
      } satisfies SceneDialogueResolved
    })
    // 採用ルール: (キャラ+音声) or (テキストあり= ナレーション)
    .filter((x): x is SceneDialogueResolved => {
      if (x === null) return false
      if (x.character && x.audio) return true
      if (x.text.trim().length > 0) return true // ナレーション(音声有無どちらでもOK)
      return false
    })

  const current = queue[index] ?? null
  const hasNext = index + 1 < queue.length

  function handleEnded() {
    const gap = current?.pauseAfterMs ?? 0
    if (singleMode || !hasNext) {
      // 最後 or 1セリフモードは停止
      if (gap > 0 && !singleMode) {
        pauseTimerRef.current = window.setTimeout(() => setPlaying(false), gap)
      } else {
        setPlaying(false)
      }
      return
    }
    if (gap > 0) {
      pauseTimerRef.current = window.setTimeout(() => setIndex((i) => i + 1), gap)
    } else {
      setIndex((i) => i + 1)
    }
  }

  // 再生停止時/アンマウント時に pauseTimer を掃除
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current !== null) {
        window.clearTimeout(pauseTimerRef.current)
        pauseTimerRef.current = null
      }
    }
  }, [])
  useEffect(() => {
    if (!playing && pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current)
      pauseTimerRef.current = null
    }
  }, [playing])

  // startAtSdId が指定されたら該当 index に合わせて自動再生開始
  useEffect(() => {
    if (!startAtSdId || queue.length === 0) return
    const idx = queue.findIndex((q) => q.sdId === startAtSdId)
    if (idx >= 0) {
      setIndex(idx)
      setPlaying(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAtSdId, scene?.id])

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
                telopStyle={telopStyle}
                backgroundLayers={backgroundLayers}
                characterX={current?.characterX ?? 0.5}
                characterScale={current?.characterScale ?? 1.0}
                characterFlipped={current?.characterFlipped ?? false}
                extraCharacters={current?.extras ?? []}
                silentDurationMs={current?.silentDurationMs ?? 3000}
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
