'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Film, Plus, Trash2, Edit2, GripVertical, Play, Square, SkipForward, Video as VideoIcon, Type, FlipHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Minimize2, Pencil, Folder, FolderPlus, Copy, Clock, Search, X, Check, Maximize2, Moon, Sun, Volume2, VolumeX, AlertTriangle, ArrowRight } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { SceneExportDialog } from '@/components/scene-export-dialog'
import { TelopSettingsDialog } from '@/components/telop-settings-dialog'
import { SceneTimelineBar, type TimelineClip } from '@/components/scene-timeline'
import { VideoExportDialog } from '@/components/video-export-dialog'
import { SceneThumbnail, renderSceneFrame } from '@/components/scene-thumbnail'
import { useToast } from '@/components/toast'
import { useSaveStatus, SaveStatusBadge } from '@/components/save-status'
import { charColorHsl } from '@/lib/char-color'
import type { Scene, Dialogue, SceneWithDialogues, Character, AudioFile, CharacterExpression, IllustrationWithLayers, Layer, BgmTrack, SoundEffect, SceneDialogue, TelopStyle, TelopIntro, TelopShake, SceneCastMember, Video, CastPreset } from '@/types/db'
import { DEFAULT_TELOP_STYLE } from '@/types/db'
import {
  clearStore,
  STORE_NAMES,
  deleteBgmTrack,
  deleteCastPreset,
  deleteIllustration,
  deleteScene,
  deleteSceneCastMember,
  deleteSceneDialogue,
  deleteSoundEffect,
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
  const toast = useToast()
  const save = useSaveStatus()
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
  const [draggedVideoId, setDraggedVideoId] = useState<string | null>(null)
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
  const [searchQuery, setSearchQuery] = useState('')
  const [replaceMode, setReplaceMode] = useState(false)
  const [replaceQuery, setReplaceQuery] = useState('')
  // 複数シーンを選択して一括操作するためのセット(selectedSceneId は展開中の1シーン)
  const [checkedSceneIds, setCheckedSceneIds] = useState<Set<string>>(new Set())
  // 全シーン展開モード(全部の展開パネルを開く)
  const [allExpanded, setAllExpanded] = useState(false)
  // BGM一括変更ダイアログ
  const [showBulkBgm, setShowBulkBgm] = useState(false)
  const [bulkBgmId, setBulkBgmId] = useState('')
  const [bulkBgmVolume, setBulkBgmVolume] = useState(0.25)
  // 検索入力の ref(キーボードショートカット用)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [telopStyle, setTelopStyle] = useState<TelopStyle>(DEFAULT_TELOP_STYLE)
  const [showTelopSettings, setShowTelopSettings] = useState(false)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  // スクリプト一括貼り付け(テキスト → 複数セリフ)
  const [bulkScriptSceneId, setBulkScriptSceneId] = useState<string | null>(null)
  const [bulkScriptText, setBulkScriptText] = useState('')
  // キャラ一括置換ダイアログ
  const [showCharReplace, setShowCharReplace] = useState(false)
  const [charReplaceFrom, setCharReplaceFrom] = useState('')
  const [charReplaceTo, setCharReplaceTo] = useState('')
  const [charReplaceResetAudio, setCharReplaceResetAudio] = useState(true)
  // 動画連続再生
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)
  const [playingVideoSceneIdx, setPlayingVideoSceneIdx] = useState(0)
  // 未使用アセット掃除ダイアログ
  const [showCleanup, setShowCleanup] = useState(false)
  // キャラ別セリフ一覧ダイアログ
  const [charLinesViewId, setCharLinesViewId] = useState<string | null>(null)
  // 全データリセット確認
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetInput, setResetInput] = useState('')
  // 展開シーン内のセリフドラッグ中 id(D&D並び替え用)
  const [draggedSdId, setDraggedSdId] = useState<string | null>(null)
  // 複数セリフ選択(複数シーンをまたぐ)。scene_dialogue.id の集合
  const [checkedSdIds, setCheckedSdIds] = useState<Set<string>>(new Set())
  // セリフクリップボード(コピー元シーン id + 生スナップショット)
  const [dialogueClipboard, setDialogueClipboard] = useState<
    | {
        sourceSceneTitle: string
        items: {
          // Dialogue snapshot
          text: string
          character_id: string | null
          audio_id: string | null
          expression_id: string | null
          notes: string | null
          duration_ms: number | null
          // SD meta
          se_id: string | null
          se_volume: number
          character_x: number
          character_scale: number
          character_flipped: boolean
          pause_after_ms: number
          telop_intro?: TelopIntro | null
          telop_shake?: TelopShake | null
        }[]
      }
    | null
  >(null)
  // セリフフィルタ(キー = sceneId)
  const [dialogueFilter, setDialogueFilter] = useState<
    'all' | 'chars' | 'narration' | 'withSe'
  >('all')
  // ダークモード(localStorage に保存、初期化時は prefers-color-scheme)
  const [darkMode, setDarkMode] = useState<boolean | null>(null)
  // ナレーション追加フォーム(展開中のシーンに対して使う)
  const [narrationText, setNarrationText] = useState('')
  const [narrationAudioId, setNarrationAudioId] = useState('')
  const [narrationDurationSec, setNarrationDurationSec] = useState(3)

  useEffect(() => {
    loadAll()
  }, [])

  // ダークモード初期化: localStorage 優先、なければ prefers-color-scheme
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('anime-app-dark')
    if (stored === 'true') setDarkMode(true)
    else if (stored === 'false') setDarkMode(false)
    else setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
  }, [])

  // ダークモード反映 + 保存
  useEffect(() => {
    if (darkMode === null || typeof document === 'undefined') return
    const root = document.documentElement
    if (darkMode) root.classList.add('dark')
    else root.classList.remove('dark')
    try {
      localStorage.setItem('anime-app-dark', String(darkMode))
    } catch {}
  }, [darkMode])

  // 展開中のシーンへスクロール(allExpanded 中は無効: 全展開時にジャンプされると逆に迷子になる)
  useEffect(() => {
    if (!selectedSceneId || allExpanded) return
    const el = document.querySelector(
      `[data-scene-id="${selectedSceneId}"]`,
    ) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [selectedSceneId, allExpanded])

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

  // 動画タブのドラッグ並び替え
  async function handleReorderVideos(fromId: string, toId: string) {
    if (fromId === toId) return
    const sorted = [...videos].sort((a, b) => a.order_index - b.order_index)
    const from = sorted.findIndex((v) => v.id === fromId)
    const to = sorted.findIndex((v) => v.id === toId)
    if (from === -1 || to === -1) return
    const [moved] = sorted.splice(from, 1)
    sorted.splice(to, 0, moved)
    const now = new Date().toISOString()
    const renumbered = sorted.map((v, i) => ({ ...v, order_index: i, updated_at: now }))
    await Promise.all(renumbered.map((v) => saveVideo(v)))
    setVideos(renumbered)
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

  // 動画まるごと複製: 動画行 + 所属シーン全て(キャスト・セリフ構成つき)を新 id で複製
  async function handleDuplicateVideo(id: string) {
    const source = videos.find((v) => v.id === id)
    if (!source) return
    if (!window.confirm(`動画「${source.name}」を、全シーンごと複製しますか?`)) return
    const now = new Date().toISOString()
    const newVideo: Video = {
      id: crypto.randomUUID(),
      name: source.name + ' (コピー)',
      order_index: videos.length,
      created_at: now,
      updated_at: now,
    }
    await saveVideo(newVideo)

    const sceneList = scenes
      .filter((s) => (s.video_id ?? null) === id)
      .sort((a, b) => a.order_index - b.order_index)
    const newScenes: SceneWithDialogues[] = []
    const newCast: SceneCastMember[] = []

    for (const src of sceneList) {
      const newSceneId = crypto.randomUUID()
      const newScene: Scene = {
        id: newSceneId,
        title: src.title,
        description: src.description,
        background_illustration_id: src.background_illustration_id,
        bgm_track_id: src.bgm_track_id,
        bgm_volume: src.bgm_volume,
        video_id: newVideo.id,
        order_index: src.order_index,
        created_at: now,
        updated_at: now,
      }
      await saveScene(newScene)

      const srcCast = cast.filter((c) => c.scene_id === src.id)
      const copiedCast: SceneCastMember[] = srcCast.map((c) => ({
        ...c,
        id: crypto.randomUUID(),
        scene_id: newSceneId,
        created_at: now,
      }))
      await Promise.all(copiedCast.map((c) => saveSceneCastMember(c)))
      newCast.push(...copiedCast)

      const copiedSds = src.dialogues.map((sd) => ({
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
        copiedSds.map((sd) => {
          const { dialogue: _d, ...row } = sd
          void _d
          return saveSceneDialogue(row)
        }),
      )
      newScenes.push({ ...newScene, dialogues: copiedSds })
    }

    setVideos((prev) => [...prev, newVideo])
    setScenes((prev) => [...prev, ...newScenes])
    setCast((prev) => [...prev, ...newCast])
    setSelectedVideoId(newVideo.id)
  }

  // シーンを別動画へ移動
  async function handleMoveSceneToVideo(sceneId: string, targetVideoId: string | null) {
    const src = scenes.find((s) => s.id === sceneId)
    if (!src) return
    if ((src.video_id ?? null) === targetVideoId) return
    const now = new Date().toISOString()
    // 移動先の末尾に付ける
    const maxOrder = scenes
      .filter((s) => (s.video_id ?? null) === targetVideoId)
      .reduce((m, s) => Math.max(m, s.order_index), -1)
    const updated: Scene = {
      id: src.id,
      title: src.title,
      description: src.description,
      background_illustration_id: src.background_illustration_id,
      bgm_track_id: src.bgm_track_id,
      bgm_volume: src.bgm_volume,
      video_id: targetVideoId,
      order_index: maxOrder + 1,
      created_at: src.created_at,
      updated_at: now,
    }
    await saveScene(updated)
    setScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...updated, dialogues: s.dialogues } : s)),
    )
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

  // シーンを別動画にコピー(元シーンはそのまま、コピーを対象動画の末尾に追加)
  async function handleCopySceneToVideo(sceneId: string, targetVideoId: string) {
    const source = scenes.find((s) => s.id === sceneId)
    if (!source) return
    const now = new Date().toISOString()
    const targetScenes = scenes
      .filter((s) => (s.video_id ?? null) === targetVideoId)
      .sort((a, b) => a.order_index - b.order_index)
    const maxOrder =
      targetScenes.length > 0 ? targetScenes[targetScenes.length - 1].order_index : -1
    const newSceneId = crypto.randomUUID()
    const newScene: Scene = {
      id: newSceneId,
      title: (source.title ?? '') + ' (コピー)',
      description: source.description,
      background_illustration_id: source.background_illustration_id,
      bgm_track_id: source.bgm_track_id,
      bgm_volume: source.bgm_volume,
      video_id: targetVideoId,
      order_index: maxOrder + 1,
      created_at: now,
      updated_at: now,
    }
    await saveScene(newScene)

    const sourceCast = cast.filter((c) => c.scene_id === sceneId)
    const newCastMembers: SceneCastMember[] = sourceCast.map((c) => ({
      ...c,
      id: crypto.randomUUID(),
      scene_id: newSceneId,
      created_at: now,
    }))
    await Promise.all(newCastMembers.map((c) => saveSceneCastMember(c)))

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
      telop_intro: sd.telop_intro ?? null,
      telop_shake: sd.telop_shake ?? null,
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

    setScenes((prev) => [...prev, { ...newScene, dialogues: newSds }])
    setCast((prev) => [...prev, ...newCastMembers])
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
        colorHsl: d?.character_id ? charColorHsl(d.character_id) : undefined,
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

  // キャストを横一列に等間隔で自動配置(order_index 順。1人=0.5、2人=0.3/0.7、3人=0.2/0.5/0.8 ...)
  async function handleAutoArrangeCast(sceneId: string) {
    const members = castForScene(sceneId)
    const n = members.length
    if (n === 0) return
    const margin = 0.18
    const positions =
      n === 1
        ? [0.5]
        : Array.from({ length: n }, (_, i) => margin + (i * (1 - 2 * margin)) / (n - 1))
    const updates: SceneCastMember[] = members.map((m, i) => ({
      ...m,
      x: positions[i],
      // 2人以上なら中央より左は右向き、右は左向きにして向き合わせる
      flipped: n >= 2 ? positions[i] > 0.5 : !!m.flipped,
    }))
    await Promise.all(updates.map((u) => saveSceneCastMember(u)))
    setCast((prev) => {
      const map = new Map(updates.map((u) => [u.id, u]))
      return prev.map((c) => map.get(c.id) ?? c)
    })
  }

  // シーン内の全セリフの再生時間(duration_ms)に倍率を掛ける。
  // 倍率 < 1 = 早口、> 1 = ゆっくり。音声があるセリフは duration_ms を持たないため対象外(無音ナレーションのみ)。
  async function handleScaleSceneDurations(sceneId: string, factor: number) {
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene || !Number.isFinite(factor) || factor <= 0) return
    const now = new Date().toISOString()
    const updated: Dialogue[] = []
    for (const sd of scene.dialogues) {
      const d = sd.dialogue
      if (!d || typeof d.duration_ms !== 'number') continue
      const next = Math.max(300, Math.round(d.duration_ms * factor))
      if (next === d.duration_ms) continue
      const u: Dialogue = { ...d, duration_ms: next, updated_at: now }
      await saveDialogue(u)
      updated.push(u)
    }
    if (updated.length === 0) {
      toast.warning('このシーンには倍率調整できる(音声なしの)セリフがありません')
      return
    }
    const map = new Map(updated.map((d) => [d.id, d]))
    setDialogues((prev) => prev.map((d) => map.get(d.id) ?? d))
    setScenes((prev) =>
      prev.map((s) =>
        s.id === sceneId
          ? {
              ...s,
              dialogues: s.dialogues.map((sd) =>
                sd.dialogue && map.has(sd.dialogue.id)
                  ? { ...sd, dialogue: map.get(sd.dialogue.id)! }
                  : sd,
              ),
            }
          : s,
      ),
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
      toast.warning('保存できる登場キャラがいません')
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

  // ==================== 複数シーン一括操作 ====================

  function toggleChecked(sceneId: string) {
    setCheckedSceneIds((prev) => {
      const next = new Set(prev)
      if (next.has(sceneId)) next.delete(sceneId)
      else next.add(sceneId)
      return next
    })
  }

  function clearChecked() {
    setCheckedSceneIds(new Set())
  }

  // 選択中の複数シーンを1つに統合。先頭(order_index 最小)を残し、残りのセリフを末尾に追加、
  // キャストをマージ。後続シーンは削除。
  async function handleBulkMerge() {
    const ids = Array.from(checkedSceneIds)
    if (ids.length < 2) {
      toast.warning('2シーン以上を選択してください')
      return
    }
    const targets = scenes
      .filter((s) => ids.includes(s.id))
      .sort((a, b) => a.order_index - b.order_index)
    if (targets.length < 2) return
    if (
      !window.confirm(
        `選択中の ${targets.length} シーンを1つに統合しますか?\n先頭「${targets[0].title ?? ''}」に残りのセリフ・キャストが結合され、他のシーンは削除されます。`,
      )
    )
      return
    const base = targets[0]
    const others = targets.slice(1)
    const now = new Date().toISOString()

    let order = base.dialogues.reduce((m, sd) => Math.max(m, sd.order_index), -1)
    const newDialoguesForBase: typeof base.dialogues = []
    for (const other of others) {
      const sortedSds = [...other.dialogues].sort((a, b) => a.order_index - b.order_index)
      for (const sd of sortedSds) {
        order += 1
        const moved = {
          ...sd,
          scene_id: base.id,
          order_index: order,
        }
        const { dialogue: _d, ...row } = moved
        void _d
        await saveSceneDialogue(row)
        newDialoguesForBase.push(moved)
      }
    }

    // キャスト統合(character_id ダブり防止)
    const baseCast = cast.filter((c) => c.scene_id === base.id)
    const existingCharIds = new Set(baseCast.map((c) => c.character_id))
    const addedCast: SceneCastMember[] = []
    for (const other of others) {
      const otherCast = cast.filter((c) => c.scene_id === other.id)
      for (const c of otherCast) {
        if (existingCharIds.has(c.character_id)) continue
        existingCharIds.add(c.character_id)
        const moved: SceneCastMember = {
          ...c,
          id: crypto.randomUUID(),
          scene_id: base.id,
          created_at: now,
        }
        await saveSceneCastMember(moved)
        addedCast.push(moved)
      }
    }

    // 後続シーン削除(カスケードで scene_dialogues も消えるが、既に base に付け替え済みなので影響なし)
    for (const other of others) {
      await deleteScene(other.id)
    }

    setScenes((prev) =>
      prev
        .filter((s) => !others.some((o) => o.id === s.id))
        .map((s) =>
          s.id === base.id
            ? { ...s, dialogues: [...s.dialogues, ...newDialoguesForBase], updated_at: now }
            : s,
        ),
    )
    setCast((prev) => [
      ...prev.filter((c) => !others.some((o) => o.id === c.scene_id)),
      ...addedCast,
    ])
    clearChecked()
    setSelectedSceneId(base.id)
  }

  async function handleBulkDelete() {
    const ids = Array.from(checkedSceneIds)
    if (ids.length === 0) return
    if (!window.confirm(`選択中の ${ids.length} シーンを削除しますか?`)) return
    const snapshots = snapshotScenes(ids)
    for (const id of ids) await save.track(deleteScene(id))
    setScenes((prev) => prev.filter((s) => !checkedSceneIds.has(s.id)))
    setCast((prev) => prev.filter((c) => !checkedSceneIds.has(c.scene_id)))
    if (selectedSceneId && checkedSceneIds.has(selectedSceneId)) setSelectedSceneId(null)
    clearChecked()
    toast.push({
      kind: 'info',
      text: `${snapshots.length} シーンを削除しました`,
      durationMs: 8000,
      action: {
        label: '元に戻す',
        onClick: async () => {
          for (const snap of snapshots) {
            await save.track(saveScene(snap.scene))
            for (const sd of snap.sceneDialogues) {
              await save.track(saveSceneDialogue(sd))
            }
            for (const c of snap.castMembers) {
              await save.track(saveSceneCastMember(c))
            }
          }
          const restored: SceneWithDialogues[] = snapshots.map((snap) => ({
            ...snap.scene,
            dialogues: snap.sceneDialogues.map((sd) => ({
              ...sd,
              dialogue: dialogues.find((d) => d.id === sd.dialogue_id) ?? null,
            })),
          }))
          setScenes((prev) => [...prev, ...restored])
          setCast((prev) => [...prev, ...snapshots.flatMap((s) => s.castMembers)])
          toast.success('削除を取り消しました')
        },
      },
    })
  }

  async function handleBulkMove(targetVideoId: string) {
    const ids = Array.from(checkedSceneIds)
    if (ids.length === 0) return
    for (const id of ids) {
      await handleMoveSceneToVideo(id, targetVideoId)
    }
    clearChecked()
  }

  async function handleBulkCopy(targetVideoId: string) {
    const ids = Array.from(checkedSceneIds)
    if (ids.length === 0) return
    for (const id of ids) {
      await handleCopySceneToVideo(id, targetVideoId)
    }
    clearChecked()
  }

  // 現在の動画のセリフに対して文字列置換を実行
  async function handleReplaceAll() {
    const q = searchQuery.trim()
    if (!q) {
      toast.warning('検索文字列を入力してください')
      return
    }
    if (!window.confirm(`この動画内のセリフに含まれる「${q}」を「${replaceQuery}」に置き換えます。続けますか?`)) return
    const now = new Date().toISOString()
    const scenesInVideo = scenes.filter((s) => (s.video_id ?? null) === selectedVideoId)
    const affectedDialogueIds = new Set<string>()
    for (const s of scenesInVideo) {
      for (const sd of s.dialogues) {
        if (sd.dialogue?.text.includes(q)) affectedDialogueIds.add(sd.dialogue.id)
      }
    }
    if (affectedDialogueIds.size === 0) {
      toast.info('該当するセリフが見つかりませんでした')
      return
    }
    const updatedDialogues = new Map<string, Dialogue>()
    for (const id of affectedDialogueIds) {
      const d = dialogues.find((x) => x.id === id)
      if (!d) continue
      const newText = d.text.split(q).join(replaceQuery)
      if (newText === d.text) continue
      const updated: Dialogue = { ...d, text: newText, updated_at: now }
      await saveDialogue(updated)
      updatedDialogues.set(id, updated)
    }
    setDialogues((prev) =>
      prev.map((d) => updatedDialogues.get(d.id) ?? d),
    )
    setScenes((prev) =>
      prev.map((s) => ({
        ...s,
        dialogues: s.dialogues.map((sd) => ({
          ...sd,
          dialogue: sd.dialogue_id && updatedDialogues.has(sd.dialogue_id)
            ? updatedDialogues.get(sd.dialogue_id) ?? sd.dialogue
            : sd.dialogue,
        })),
      })),
    )
    toast.success(`${updatedDialogues.size}件のセリフを置換しました`)
  }

  // 現在の動画の全シーンに対して BGM を一括適用
  async function handleApplyBulkBgm() {
    const targetScenes = scenes.filter((s) => (s.video_id ?? null) === selectedVideoId)
    if (targetScenes.length === 0) {
      setShowBulkBgm(false)
      return
    }
    const newBgmId = bulkBgmId || null
    const now = new Date().toISOString()
    for (const scene of targetScenes) {
      const updated: Scene = {
        id: scene.id,
        title: scene.title,
        description: scene.description,
        background_illustration_id: scene.background_illustration_id,
        bgm_track_id: newBgmId,
        bgm_volume: bulkBgmVolume,
        video_id: scene.video_id ?? null,
        order_index: scene.order_index,
        created_at: scene.created_at,
        updated_at: now,
      }
      await saveScene(updated)
    }
    setScenes((prev) =>
      prev.map((s) =>
        (s.video_id ?? null) === selectedVideoId
          ? { ...s, bgm_track_id: newBgmId, bgm_volume: bulkBgmVolume, updated_at: now }
          : s,
      ),
    )
    setShowBulkBgm(false)
  }

  // キーボードショートカット: Esc / / / Delete / Ctrl+D / Ctrl+A
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      if (e.key === 'Escape') {
        if (checkedSceneIds.size > 0) {
          e.preventDefault()
          clearChecked()
          return
        }
        if (allExpanded) {
          e.preventDefault()
          setAllExpanded(false)
          return
        }
        if (selectedSceneId) {
          e.preventDefault()
          setSelectedSceneId(null)
          return
        }
      }
      if (isTyping) return
      // Ctrl/Cmd + A: 現在の動画内のシーンを全選択
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        const ids = scenes
          .filter((s) => (s.video_id ?? null) === selectedVideoId)
          .map((s) => s.id)
        setCheckedSceneIds(new Set(ids))
        return
      }
      // Ctrl/Cmd + D: 選択中(チェック)のシーンを複製、なければ展開中のシーンを複製
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        if (checkedSceneIds.size > 0) {
          for (const id of Array.from(checkedSceneIds)) {
            handleDuplicateScene(id)
          }
          clearChecked()
        } else if (selectedSceneId) {
          handleDuplicateScene(selectedSceneId)
        }
        return
      }
      if (e.key === '?') {
        e.preventDefault()
        setShowShortcutsHelp((v) => !v)
        return
      }
      // Alt+1〜9 で動画切替(0 は未分類)
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^[0-9]$/.test(e.key)) {
        const n = Number(e.key)
        if (n === 0) {
          e.preventDefault()
          setSelectedVideoId(null)
        } else {
          const sorted = [...videos].sort((a, b) => a.order_index - b.order_index)
          const target = sorted[n - 1]
          if (target) {
            e.preventDefault()
            setSelectedVideoId(target.id)
          }
        }
        return
      }
      if (e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (checkedSceneIds.size > 0) {
          e.preventDefault()
          handleBulkDelete()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedSceneIds, allExpanded, selectedSceneId, scenes, selectedVideoId, videos])

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

  // スクリプト一括貼り付けを適用: 各行 = 1セリフ。
  //   「キャラ名: セリフ」「キャラ名:セリフ」「キャラ名「セリフ」」 → そのキャラのセリフ
  //   それ以外の行 → ナレーション(キャラなし)
  // 対応する Character が無い行はナレーション扱い。
  async function handleApplyBulkScript() {
    if (!bulkScriptSceneId) return
    const text = bulkScriptText
    const scene = scenes.find((s) => s.id === bulkScriptSceneId)
    if (!scene) return
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    if (lines.length === 0) {
      setBulkScriptSceneId(null)
      setBulkScriptText('')
      return
    }
    const now = new Date().toISOString()
    let order = scene.dialogues.reduce((m, sd) => Math.max(m, sd.order_index), -1)
    const newDialogues: Dialogue[] = []
    const newSds: (SceneDialogue & { dialogue: Dialogue })[] = []

    // キャラ名解決: 完全一致優先、無ければ前方一致
    const findCharByName = (name: string): Character | null => {
      const trimmed = name.trim()
      if (!trimmed) return null
      const exact = characters.find((c) => c.name === trimmed)
      if (exact) return exact
      const prefix = characters.find((c) => trimmed.startsWith(c.name))
      return prefix ?? null
    }

    for (const raw of lines) {
      // 「キャラ「セリフ」」形式
      let charName: string | null = null
      let body = raw
      const kagiMatch = raw.match(/^([^「：:]+)[「](.+?)[」]$/)
      const colonMatch = raw.match(/^([^：:]+)[：:]\s*(.+)$/)
      if (kagiMatch) {
        charName = kagiMatch[1]
        body = kagiMatch[2]
      } else if (colonMatch) {
        charName = colonMatch[1]
        body = colonMatch[2]
      }
      const character = charName ? findCharByName(charName) : null
      const isNarration = !character

      const dialogue: Dialogue = {
        id: crypto.randomUUID(),
        text: body,
        character_id: character?.id ?? null,
        audio_id: null,
        expression_id: null,
        emotion: null,
        notes: isNarration ? 'narration' : null,
        // 音声なしの場合は概算(1文字あたり 120ms、最小 1.5s、最大 8s)
        duration_ms: Math.min(8000, Math.max(1500, body.length * 120)),
        created_at: now,
        updated_at: now,
      }
      await saveDialogue(dialogue)
      newDialogues.push(dialogue)

      order += 1
      const sd: SceneDialogue = {
        id: crypto.randomUUID(),
        scene_id: bulkScriptSceneId,
        dialogue_id: dialogue.id,
        order_index: order,
        se_id: null,
        se_volume: 1,
        character_x: 0.5,
        character_scale: 1.0,
        character_flipped: false,
        pause_after_ms: 0,
        created_at: now,
      }
      await saveSceneDialogue(sd)
      newSds.push({ ...sd, dialogue })
    }

    setDialogues((prev) => [...newDialogues, ...prev])
    setScenes((prev) =>
      prev.map((s) =>
        s.id === bulkScriptSceneId
          ? { ...s, dialogues: [...s.dialogues, ...newSds] }
          : s,
      ),
    )
    setBulkScriptSceneId(null)
    setBulkScriptText('')
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

  // シーン削除前にスナップショット(復元用)を作る
  function snapshotScenes(
    ids: string[],
  ): { scene: Scene; sceneDialogues: SceneDialogue[]; castMembers: SceneCastMember[] }[] {
    return ids
      .map((id) => {
        const s = scenes.find((x) => x.id === id)
        if (!s) return null
        const { dialogues: _d, ...sceneRow } = s
        void _d
        const sceneDialogues: SceneDialogue[] = s.dialogues.map((sd) => {
          const { dialogue: _dd, ...row } = sd
          void _dd
          return row
        })
        const castMembers = cast.filter((c) => c.scene_id === id)
        return { scene: sceneRow as Scene, sceneDialogues, castMembers }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }

  async function handleDeleteScene(id: string) {
    if (!confirm('このシーンを削除してよろしいですか？')) return
    const snapshots = snapshotScenes([id])
    await save.track(deleteScene(id))
    setScenes((prev) => prev.filter((s) => s.id !== id))
    setCast((prev) => prev.filter((c) => c.scene_id !== id))
    if (selectedSceneId === id) setSelectedSceneId(null)
    const title = snapshots[0]?.scene.title ?? ''
    toast.push({
      kind: 'info',
      text: `シーン「${title}」を削除しました`,
      durationMs: 8000,
      action: {
        label: '元に戻す',
        onClick: async () => {
          for (const snap of snapshots) {
            await save.track(saveScene(snap.scene))
            for (const sd of snap.sceneDialogues) {
              await save.track(saveSceneDialogue(sd))
            }
            for (const c of snap.castMembers) {
              await save.track(saveSceneCastMember(c))
            }
          }
          const restored: SceneWithDialogues[] = snapshots.map((snap) => ({
            ...snap.scene,
            dialogues: snap.sceneDialogues.map((sd) => ({
              ...sd,
              dialogue: dialogues.find((d) => d.id === sd.dialogue_id) ?? null,
            })),
          }))
          setScenes((prev) => [...prev, ...restored])
          setCast((prev) => [...prev, ...snapshots.flatMap((s) => s.castMembers)])
          toast.success('削除を取り消しました')
        },
      },
    })
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

  // SceneDialogue の SE / キャラ位置 / 反転 / 間合い / テロップ上書き を更新
  // シーン内のセリフを 1 つずつ上/下に移動
  async function handleMoveSceneDialogue(sceneId: string, sdId: string, step: -1 | 1) {
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene) return
    const sorted = [...scene.dialogues].sort((a, b) => a.order_index - b.order_index)
    const idx = sorted.findIndex((sd) => sd.id === sdId)
    const swapWith = idx + step
    if (idx === -1 || swapWith < 0 || swapWith >= sorted.length) return
    const a = sorted[idx]
    const b = sorted[swapWith]
    // order_index を入れ替え
    const now = new Date().toISOString()
    const updA = { ...a, order_index: b.order_index }
    const updB = { ...b, order_index: a.order_index }
    const stripDialogue = (sd: typeof updA) => {
      const { dialogue: _d, ...row } = sd
      void _d
      return row as SceneDialogue
    }
    await saveSceneDialogue(stripDialogue(updA))
    await saveSceneDialogue(stripDialogue(updB))
    setScenes((prev) =>
      prev.map((s) => {
        if (s.id !== sceneId) return s
        return {
          ...s,
          dialogues: s.dialogues.map((sd) => {
            if (sd.id === updA.id) return updA
            if (sd.id === updB.id) return updB
            return sd
          }),
          updated_at: now,
        }
      }),
    )
  }

  function updateSceneDialogueMeta(
    sceneId: string,
    sdId: string,
    patch: Partial<
      Pick<
        SceneDialogue,
        | 'se_id'
        | 'se_volume'
        | 'voice_volume'
        | 'character_x'
        | 'character_scale'
        | 'character_flipped'
        | 'pause_after_ms'
        | 'telop_intro'
        | 'telop_shake'
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
              voice_volume:
                typeof rowPart.voice_volume === 'number' ? rowPart.voice_volume : 1,
              character_x:
                typeof rowPart.character_x === 'number' ? rowPart.character_x : 0.5,
              character_scale:
                typeof rowPart.character_scale === 'number' ? rowPart.character_scale : 1.0,
              character_flipped: rowPart.character_flipped ?? false,
              pause_after_ms:
                typeof rowPart.pause_after_ms === 'number' ? rowPart.pause_after_ms : 0,
              telop_intro: rowPart.telop_intro ?? null,
              telop_shake: rowPart.telop_shake ?? null,
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

  // 選択中セリフを一括削除(SceneDialogue のみ削除、Dialogue 本体は残す)
  async function handleBulkDeleteDialogues() {
    const ids = Array.from(checkedSdIds)
    if (ids.length === 0) return
    if (!window.confirm(`選択中の ${ids.length} セリフをシーンから外しますか?`)) return
    for (const id of ids) {
      await deleteSceneDialogue(id)
    }
    setScenes((prev) =>
      prev.map((s) => ({
        ...s,
        dialogues: s.dialogues.filter((sd) => !checkedSdIds.has(sd.id)),
      })),
    )
    setCheckedSdIds(new Set())
  }

  // 選択中セリフを別シーンの末尾に移動
  async function handleBulkMoveDialogues(targetSceneId: string) {
    const ids = Array.from(checkedSdIds)
    if (ids.length === 0) return
    const target = scenes.find((s) => s.id === targetSceneId)
    if (!target) return
    const now = new Date().toISOString()
    let order = target.dialogues.reduce((m, sd) => Math.max(m, sd.order_index), -1)
    const moved: { oldSceneId: string; sd: SceneDialogue & { dialogue: Dialogue | null } }[] = []
    for (const id of ids) {
      // 元シーンから検索
      let oldSceneId = ''
      let source: (SceneDialogue & { dialogue: Dialogue | null }) | null = null
      for (const s of scenes) {
        const found = s.dialogues.find((x) => x.id === id)
        if (found) {
          oldSceneId = s.id
          source = found
          break
        }
      }
      if (!source) continue
      order += 1
      const updated = { ...source, scene_id: targetSceneId, order_index: order }
      const { dialogue: _d, ...row } = updated
      void _d
      await saveSceneDialogue(row as SceneDialogue)
      moved.push({ oldSceneId, sd: updated })
    }
    setScenes((prev) =>
      prev.map((s) => {
        // 元シーンから除去
        if (moved.some((m) => m.oldSceneId === s.id)) {
          return {
            ...s,
            dialogues: s.dialogues.filter(
              (sd) => !moved.some((m) => m.sd.id === sd.id),
            ),
            updated_at: now,
          }
        }
        // 移動先に追加
        if (s.id === targetSceneId) {
          return {
            ...s,
            dialogues: [...s.dialogues, ...moved.map((m) => m.sd)],
            updated_at: now,
          }
        }
        return s
      }),
    )
    setCheckedSdIds(new Set())
  }

  // シーン内の全セリフをクリップボードにコピー(Dialogue は複製するので元データは不変)
  function handleCopySceneDialoguesToClipboard(sceneId: string) {
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene || scene.dialogues.length === 0) {
      toast.warning('コピーするセリフがありません')
      return
    }
    const sorted = [...scene.dialogues].sort((a, b) => a.order_index - b.order_index)
    const items = sorted.map((sd) => ({
      text: sd.dialogue?.text ?? '',
      character_id: sd.dialogue?.character_id ?? null,
      audio_id: sd.dialogue?.audio_id ?? null,
      expression_id: sd.dialogue?.expression_id ?? null,
      notes: sd.dialogue?.notes ?? null,
      duration_ms: sd.dialogue?.duration_ms ?? null,
      se_id: sd.se_id ?? null,
      se_volume: typeof sd.se_volume === 'number' ? sd.se_volume : 1,
      character_x: typeof sd.character_x === 'number' ? sd.character_x : 0.5,
      character_scale: typeof sd.character_scale === 'number' ? sd.character_scale : 1.0,
      character_flipped: !!sd.character_flipped,
      pause_after_ms: typeof sd.pause_after_ms === 'number' ? sd.pause_after_ms : 0,
      telop_intro: sd.telop_intro ?? null,
      telop_shake: sd.telop_shake ?? null,
    }))
    setDialogueClipboard({ sourceSceneTitle: scene.title ?? '(無題)', items })
  }

  // クリップボードのセリフを対象シーンの末尾に貼付(Dialogue も新しい id で複製)
  async function handlePasteDialoguesToScene(sceneId: string) {
    if (!dialogueClipboard) return
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene) return
    const now = new Date().toISOString()
    let order = scene.dialogues.reduce((m, sd) => Math.max(m, sd.order_index), -1)
    const newDialogues: Dialogue[] = []
    const newSds: (SceneDialogue & { dialogue: Dialogue })[] = []
    for (const item of dialogueClipboard.items) {
      const dialogue: Dialogue = {
        id: crypto.randomUUID(),
        text: item.text,
        character_id: item.character_id,
        audio_id: item.audio_id,
        expression_id: item.expression_id,
        notes: item.notes,
        emotion: null,
        duration_ms: item.duration_ms,
        created_at: now,
        updated_at: now,
      }
      await saveDialogue(dialogue)
      newDialogues.push(dialogue)
      order += 1
      const sd: SceneDialogue = {
        id: crypto.randomUUID(),
        scene_id: sceneId,
        dialogue_id: dialogue.id,
        order_index: order,
        se_id: item.se_id,
        se_volume: item.se_volume,
        character_x: item.character_x,
        character_scale: item.character_scale,
        character_flipped: item.character_flipped,
        pause_after_ms: item.pause_after_ms,
        telop_intro: item.telop_intro ?? null,
        telop_shake: item.telop_shake ?? null,
        created_at: now,
      }
      await saveSceneDialogue(sd)
      newSds.push({ ...sd, dialogue })
    }
    setDialogues((prev) => [...newDialogues, ...prev])
    setScenes((prev) =>
      prev.map((s) =>
        s.id === sceneId ? { ...s, dialogues: [...s.dialogues, ...newSds] } : s,
      ),
    )
  }

  // 全データリセット: 全ストアを空にしてメモリ state もクリア
  async function handleFullReset() {
    if (resetInput !== 'reset') return
    for (const name of STORE_NAMES) {
      try {
        await clearStore(name)
      } catch (e) {
        console.error('[anime-app] clear store failed', name, e)
      }
    }
    setScenes([])
    setDialogues([])
    setCharacters([])
    setAudioFiles([])
    setExpressions([])
    setIllustrations([])
    setBgmTracks([])
    setSounds([])
    setCast([])
    setVideos([])
    setCastPresets([])
    setSelectedVideoId(null)
    setSelectedSceneId(null)
    setCheckedSceneIds(new Set())
    setTelopStyle(DEFAULT_TELOP_STYLE)
    setShowResetConfirm(false)
    setResetInput('')
    toast.success('すべてのデータを初期化しました')
  }

  // 使われていないアセットを算出(他エンティティからの参照がないもの)
  function computeUnusedAssets() {
    const usedBg = new Set<string>()
    const usedBgm = new Set<string>()
    const usedSe = new Set<string>()
    for (const s of scenes) {
      if (s.background_illustration_id) usedBg.add(s.background_illustration_id)
      if (s.bgm_track_id) usedBgm.add(s.bgm_track_id)
      for (const sd of s.dialogues) {
        if (sd.se_id) usedSe.add(sd.se_id)
      }
    }
    const unusedBg = illustrations.filter((i) => !usedBg.has(i.id))
    const unusedBgm = bgmTracks.filter((b) => !usedBgm.has(b.id))
    const unusedSe = sounds.filter((s) => !usedSe.has(s.id))
    return { unusedBg, unusedBgm, unusedSe }
  }

  async function handleCleanupUnused() {
    const { unusedBg, unusedBgm, unusedSe } = computeUnusedAssets()
    const total = unusedBg.length + unusedBgm.length + unusedSe.length
    if (total === 0) {
      toast.info('削除できる未使用アセットはありません')
      return
    }
    if (
      !window.confirm(
        `未使用アセット ${total} 件(背景 ${unusedBg.length} / BGM ${unusedBgm.length} / SE ${unusedSe.length})を削除します。よろしいですか?`,
      )
    )
      return
    for (const i of unusedBg) await deleteIllustration(i.id)
    for (const b of unusedBgm) await deleteBgmTrack(b.id)
    for (const s of unusedSe) await deleteSoundEffect(s.id)
    setIllustrations((prev) => prev.filter((i) => !unusedBg.some((u) => u.id === i.id)))
    setBgmTracks((prev) => prev.filter((b) => !unusedBgm.some((u) => u.id === b.id)))
    setSounds((prev) => prev.filter((s) => !unusedSe.some((u) => u.id === s.id)))
    setShowCleanup(false)
    toast.success(`${total} 件のアセットを削除しました`)
  }

  // キャラ一括置換: Dialogue.character_id が src のものを全て tgt に書き換える。
  // tgt が空の場合はナレーション化(character_id=null)。
  // resetAudio=true なら audio_id と expression_id も null に戻す(別キャラの声のまま残ると不整合)。
  async function handleApplyCharReplace() {
    const src = charReplaceFrom
    const tgt = charReplaceTo // '' = ナレーション化
    if (!src) {
      toast.warning('置換元キャラを選んでください')
      return
    }
    if (src === tgt) {
      toast.warning('置換元と置換先が同じです')
      return
    }
    const targetDialogues = dialogues.filter((d) => d.character_id === src)
    if (targetDialogues.length === 0) {
      toast.info('このキャラのセリフはありません')
      return
    }
    const tgtName = tgt
      ? characters.find((c) => c.id === tgt)?.name ?? '不明'
      : 'ナレーション'
    if (
      !window.confirm(
        `${targetDialogues.length} 件のセリフを「${tgtName}」に置換します。${charReplaceResetAudio ? '音声と表情はリセットされます。' : ''}よろしいですか?`,
      )
    )
      return
    const now = new Date().toISOString()
    const updated = new Map<string, Dialogue>()
    for (const d of targetDialogues) {
      const u: Dialogue = {
        ...d,
        character_id: tgt || null,
        audio_id: charReplaceResetAudio ? null : d.audio_id,
        expression_id: charReplaceResetAudio ? null : d.expression_id,
        notes: !tgt ? 'narration' : d.notes === 'narration' ? null : d.notes,
        updated_at: now,
      }
      await saveDialogue(u)
      updated.set(u.id, u)
    }
    setDialogues((prev) => prev.map((d) => updated.get(d.id) ?? d))
    setScenes((prev) =>
      prev.map((s) => ({
        ...s,
        dialogues: s.dialogues.map((sd) =>
          sd.dialogue && updated.has(sd.dialogue.id)
            ? { ...sd, dialogue: updated.get(sd.dialogue.id)! }
            : sd,
        ),
      })),
    )
    setShowCharReplace(false)
    setCharReplaceFrom('')
    setCharReplaceTo('')
    toast.success(`${updated.size} 件のセリフを置換しました`)
  }

  // シーンの title / description をその場で更新
  async function handleUpdateSceneFields(
    sceneId: string,
    patch: Partial<Pick<Scene, 'title' | 'description'>>,
  ) {
    const existing = scenes.find((s) => s.id === sceneId)
    if (!existing) return
    const now = new Date().toISOString()
    const updated: Scene = {
      id: existing.id,
      title: patch.title !== undefined ? patch.title : existing.title,
      description:
        patch.description !== undefined ? patch.description : existing.description,
      background_illustration_id: existing.background_illustration_id,
      bgm_track_id: existing.bgm_track_id,
      bgm_volume: existing.bgm_volume,
      video_id: existing.video_id ?? null,
      order_index: existing.order_index,
      created_at: existing.created_at,
      updated_at: now,
    }
    await save.track(saveScene(updated))
    setScenes((prev) =>
      prev.map((s) =>
        s.id === sceneId ? { ...updated, dialogues: s.dialogues } : s,
      ),
    )
  }

  // シーンを同動画内で1つ上/下に移動(ドラッグ不要)
  async function handleMoveSceneByStep(sceneId: string, step: -1 | 1) {
    const src = scenes.find((s) => s.id === sceneId)
    if (!src) return
    const siblings = scenes
      .filter((s) => (s.video_id ?? null) === (src.video_id ?? null))
      .sort((a, b) => a.order_index - b.order_index)
    const idx = siblings.findIndex((s) => s.id === sceneId)
    const nextIdx = idx + step
    if (idx === -1 || nextIdx < 0 || nextIdx >= siblings.length) return
    await handleReorderSceneById(sceneId, siblings[nextIdx].id)
  }

  // 展開中シーンから前/次のシーンへ「展開を移す」(同動画内)
  function jumpToAdjacentScene(currentSceneId: string, step: -1 | 1) {
    const src = scenes.find((s) => s.id === currentSceneId)
    if (!src) return
    const siblings = scenes
      .filter((s) => (s.video_id ?? null) === (src.video_id ?? null))
      .sort((a, b) => a.order_index - b.order_index)
    const idx = siblings.findIndex((s) => s.id === currentSceneId)
    const target = siblings[idx + step]
    if (target) setSelectedSceneId(target.id)
  }

  // セリフのキャラを直接切替(null=ナレーション化)。音声と表情はキャラ依存なのでリセット。
  async function handleChangeDialogueCharacter(
    dialogueId: string,
    newCharId: string | null,
  ) {
    const existing = dialogues.find((d) => d.id === dialogueId)
    if (!existing) return
    if ((existing.character_id ?? null) === newCharId) return
    const now = new Date().toISOString()
    const updated: Dialogue = {
      ...existing,
      character_id: newCharId,
      audio_id: null,
      expression_id: null,
      notes: newCharId === null ? 'narration' : existing.notes === 'narration' ? null : existing.notes,
      updated_at: now,
    }
    await saveDialogue(updated)
    setDialogues((prev) => prev.map((d) => (d.id === dialogueId ? updated : d)))
    setScenes((prev) =>
      prev.map((s) => ({
        ...s,
        dialogues: s.dialogues.map((sd) =>
          sd.dialogue?.id === dialogueId ? { ...sd, dialogue: updated } : sd,
        ),
      })),
    )
  }

  // セリフのテキストをインライン編集(Dialogue.text を直接更新)
  async function handleEditDialogueText(dialogueId: string, text: string) {
    const existing = dialogues.find((d) => d.id === dialogueId)
    if (!existing) return
    const now = new Date().toISOString()
    const updated: Dialogue = { ...existing, text, updated_at: now }
    await save.track(saveDialogue(updated))
    setDialogues((prev) => prev.map((d) => (d.id === dialogueId ? updated : d)))
    setScenes((prev) =>
      prev.map((s) => ({
        ...s,
        dialogues: s.dialogues.map((sd) =>
          sd.dialogue?.id === dialogueId ? { ...sd, dialogue: updated } : sd,
        ),
      })),
    )
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
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-3xl font-bold text-foreground">ストーリーボード</h2>
                <SaveStatusBadge state={save.state} lastSavedAt={save.lastSavedAt} />
              </div>
              <p className="text-muted-foreground mt-1">シーンを構築してストーリーを作成</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => {
                  if (!selectedVideoId) return
                  setPlayingVideoSceneIdx(0)
                  setPlayingVideoId(selectedVideoId)
                }}
                disabled={
                  !selectedVideoId ||
                  scenes.filter((s) => (s.video_id ?? null) === selectedVideoId).length === 0
                }
                className="gap-2"
                title="この動画の全シーンを冒頭から通し再生"
              >
                <Play size={16} />
                通し再生
              </Button>
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
                variant="outline"
                onClick={() => {
                  setCharReplaceFrom('')
                  setCharReplaceTo('')
                  setShowCharReplace(true)
                }}
                className="gap-2"
                title="特定キャラのセリフを別キャラ or ナレーションに一括で置き換え"
                disabled={characters.length === 0}
              >
                キャラ置換
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCleanup(true)}
                className="gap-2"
                title="どのシーンからも参照されていない背景/BGM/SE を見つけて一括削除"
              >
                未使用掃除
              </Button>
              <Button
                variant="outline"
                onClick={() => setCharLinesViewId(characters[0]?.id ?? null)}
                className="gap-2"
                title="選んだキャラの全セリフをシーン横断で一覧表示"
                disabled={characters.length === 0}
              >
                セリフ一覧
              </Button>
              <Button
                variant="outline"
                onClick={() => setDarkMode((v) => !v)}
                className="gap-2"
                title={darkMode ? 'ライトモードに切替' : 'ダークモードに切替'}
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setResetInput('')
                  setShowResetConfirm(true)
                }}
                className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                title="全データを削除して初期状態に戻す(危険)"
              >
                全リセット
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowShortcutsHelp(true)}
                className="gap-2"
                title="キーボードショートカット一覧 (?キー)"
              >
                ?
              </Button>
              <Button
                onClick={() => {
                  setEditingSceneId(null)
                  // スマートデフォルト: 現動画内の末尾シーンから BGM/背景/音量を継承
                  const lastInVideo = scenes
                    .filter((s) => (s.video_id ?? null) === selectedVideoId)
                    .sort((a, b) => a.order_index - b.order_index)
                    .slice(-1)[0]
                  setSceneFormData({
                    title: '',
                    description: '',
                    background_illustration_id:
                      lastInVideo?.background_illustration_id ?? '',
                    bgm_track_id: lastInVideo?.bgm_track_id ?? '',
                    bgm_volume:
                      typeof lastInVideo?.bgm_volume === 'number'
                        ? lastInVideo.bgm_volume
                        : 0.25,
                    video_id: selectedVideoId ?? '',
                  })
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
                  draggable
                  onDragStart={() => setDraggedVideoId(v.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedVideoId && draggedVideoId !== v.id) {
                      handleReorderVideos(draggedVideoId, v.id)
                    }
                    setDraggedVideoId(null)
                  }}
                  onDragEnd={() => setDraggedVideoId(null)}
                  className={`flex items-center gap-1 rounded border transition cursor-move ${
                    isActive
                      ? 'bg-primary/20 border-primary/40'
                      : 'bg-background border-input hover:bg-primary/10'
                  } ${draggedVideoId === v.id ? 'opacity-50' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedVideoId(v.id)}
                    className={`pl-3 pr-1 py-1 text-sm ${
                      isActive ? 'text-primary font-medium' : 'text-foreground'
                    }`}
                    title={`この動画のシーンを表示(${sceneCount} 個)。ドラッグで並び替え`}
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
                        onClick={() => handleDuplicateVideo(v.id)}
                        className="p-1 hover:bg-primary/20 rounded transition"
                        title="動画ごと複製(シーン・キャスト・セリフ構成つき)"
                      >
                        <Copy size={11} className="text-muted-foreground" />
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
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="例:オープニング"
                      value={sceneFormData.title}
                      onChange={(e) => setSceneFormData({ ...sceneFormData, title: e.target.value })}
                      className="bg-background border-input flex-1"
                    />
                    {editingSceneId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const scene = scenes.find((s) => s.id === editingSceneId)
                          const firstText = scene?.dialogues[0]?.dialogue?.text?.trim()
                          if (!firstText) {
                            toast.warning('このシーンにはセリフがないためタイトルを生成できません')
                            return
                          }
                          const short =
                            firstText.length > 20 ? firstText.slice(0, 18) + '…' : firstText
                          setSceneFormData({ ...sceneFormData, title: short })
                        }}
                        className="gap-1 flex-shrink-0"
                        title="最初のセリフからタイトルを自動生成"
                      >
                        <Type size={14} />
                        自動
                      </Button>
                    )}
                  </div>
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
              <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
                <h3 className="text-xl font-semibold text-foreground">シーン</h3>
                <div className="flex items-center gap-1 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // 既定値を現在の先頭シーンから拾う
                      const firstScene = scenes.find(
                        (s) => (s.video_id ?? null) === selectedVideoId,
                      )
                      setBulkBgmId(firstScene?.bgm_track_id ?? '')
                      setBulkBgmVolume(
                        typeof firstScene?.bgm_volume === 'number'
                          ? firstScene.bgm_volume
                          : 0.25,
                      )
                      setShowBulkBgm(true)
                    }}
                    disabled={
                      scenes.filter((s) => (s.video_id ?? null) === selectedVideoId).length === 0
                    }
                    className="gap-1 h-7 px-2 text-xs"
                    title="この動画の全シーンのBGMを一括変更"
                  >
                    BGM一括
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAllExpanded(true)}
                    className="gap-1 h-7 px-2 text-xs"
                    title="この動画の全シーンを展開"
                  >
                    <Maximize2 size={12} />
                    全展開
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAllExpanded(false)
                      setSelectedSceneId(null)
                    }}
                    className="gap-1 h-7 px-2 text-xs"
                    title="全シーンを縮める"
                  >
                    <Minimize2 size={12} />
                    全縮小
                  </Button>
                </div>
              </div>

              {/* セリフ/タイトル検索 + 一括置換 */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                    />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="セリフ・シーンタイトルを検索(/で即フォーカス)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-9 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-primary/20 rounded transition"
                        title="クリア"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  {(() => {
                    const q = searchQuery.trim().toLowerCase()
                    if (!q) return null
                    // 現動画内で、タイトル or セリフが q を含むシーン
                    const hits = scenes
                      .filter((s) => (s.video_id ?? null) === selectedVideoId)
                      .sort((a, b) => a.order_index - b.order_index)
                      .filter(
                        (s) =>
                          (s.title ?? '').toLowerCase().includes(q) ||
                          s.dialogues.some((sd) =>
                            (sd.dialogue?.text ?? '').toLowerCase().includes(q),
                          ),
                      )
                    const curIdx = hits.findIndex((s) => s.id === selectedSceneId)
                    const jumpTo = (step: -1 | 1) => {
                      if (hits.length === 0) return
                      const nextIdx =
                        curIdx === -1 ? (step === 1 ? 0 : hits.length - 1) : (curIdx + step + hits.length) % hits.length
                      setSelectedSceneId(hits[nextIdx].id)
                    }
                    return (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {hits.length === 0
                            ? '0件'
                            : `${curIdx === -1 ? '?' : curIdx + 1}/${hits.length}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => jumpTo(-1)}
                          disabled={hits.length === 0}
                          className="h-9 w-8 rounded border border-input hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                          title="前のヒットへ"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => jumpTo(1)}
                          disabled={hits.length === 0}
                          className="h-9 w-8 rounded border border-input hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                          title="次のヒットへ"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    )
                  })()}
                  <Button
                    size="sm"
                    variant={replaceMode ? 'default' : 'outline'}
                    onClick={() => setReplaceMode((v) => !v)}
                    className="h-9 px-3 text-xs"
                    title="セリフ一括置換"
                  >
                    置換
                  </Button>
                </div>
                {replaceMode && (
                  <div className="flex items-center gap-2 p-2 bg-background border border-dashed border-input rounded-md">
                    <ArrowRight size={14} className="text-muted-foreground flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="置換後の文字列(空欄にすると削除)"
                      value={replaceQuery}
                      onChange={(e) => setReplaceQuery(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-card border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Button
                      size="sm"
                      onClick={handleReplaceAll}
                      disabled={!searchQuery.trim()}
                      className="h-8 px-3 text-xs flex-shrink-0"
                      title="現在の動画内の全セリフで置換"
                    >
                      全置換
                    </Button>
                  </div>
                )}
              </div>

              {/* 一括操作バー(チェック中シーンがあるときだけ表示) */}
              {checkedSceneIds.size > 0 && (
                <Card className="bg-primary/10 border-primary/40 p-3 mb-3 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-primary" />
                    <span className="text-sm text-foreground">
                      {checkedSceneIds.size} シーン選択中
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {videos.length > 0 && (
                      <>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) handleBulkMove(e.target.value)
                            e.target.value = ''
                          }}
                          className="px-2 py-1 bg-card border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">別動画へ移動…</option>
                          {videos
                            .filter((v) => v.id !== selectedVideoId)
                            .map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                        </select>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) handleBulkCopy(e.target.value)
                            e.target.value = ''
                          }}
                          className="px-2 py-1 bg-card border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">別動画へコピー…</option>
                          {videos
                            .filter((v) => v.id !== selectedVideoId)
                            .map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                        </select>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkMerge}
                      disabled={checkedSceneIds.size < 2}
                      className="gap-1 h-8 px-2 text-xs"
                      title="選択中シーンを1つに結合(先頭のシーンに残りのセリフ・キャストが追加される)"
                    >
                      統合
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkDelete}
                      className="gap-1 h-8 px-2 text-xs text-destructive border-destructive/40 hover:bg-destructive/20"
                    >
                      <Trash2 size={12} />
                      削除
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearChecked}
                      className="h-8 px-2 text-xs"
                    >
                      選択解除
                    </Button>
                  </div>
                </Card>
              )}

              {loading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">読み込み中...</p>
                </div>
              ) : (() => {
                const q = searchQuery.trim().toLowerCase()
                const filteredScenes = scenes
                  .filter((s) => (s.video_id ?? null) === selectedVideoId)
                  .filter((s) => {
                    if (!q) return true
                    if ((s.title ?? '').toLowerCase().includes(q)) return true
                    if ((s.description ?? '').toLowerCase().includes(q)) return true
                    return s.dialogues.some((sd) =>
                      (sd.dialogue?.text ?? '').toLowerCase().includes(q),
                    )
                  })
                  .sort((a, b) => a.order_index - b.order_index)
                if (filteredScenes.length === 0) {
                  return (
                    <Card className="bg-card border-border p-12 text-center">
                      <Film size={48} className="mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        {q ? '該当するシーンがありません' : 'この動画にはまだシーンがありません'}
                      </h3>
                      <p className="text-muted-foreground">
                        {q
                          ? '検索条件を変更するか、クリアしてください'
                          : '「新規シーン」ボタンで最初のシーンを作成してください'}
                      </p>
                    </Card>
                  )
                }
                return (
                <div className="space-y-3">
                  {filteredScenes.map((scene, index) => (
                    <Card
                      key={scene.id}
                      data-scene-id={scene.id}
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
                        <label
                          className="flex items-center h-7 cursor-pointer flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          title="一括操作用の選択"
                        >
                          <input
                            type="checkbox"
                            checked={checkedSceneIds.has(scene.id)}
                            onChange={() => toggleChecked(scene.id)}
                            className="w-4 h-4 accent-primary"
                          />
                        </label>
                        <GripVertical size={20} className="text-muted-foreground mt-1 flex-shrink-0" />
                        <SceneThumbnail
                          scene={scene}
                          characters={characters}
                          audioFiles={audioFiles}
                          expressions={expressions}
                          illustrations={illustrations}
                          sceneCast={cast}
                          className="w-24 h-14 flex-shrink-0 hidden sm:block"
                        />
                        <div className="flex-1 min-w-0">
                          {/* クリックで展開/縮小するのはヘッダー部分だけ。展開内容は通常のdivなのでクリックが誤って反映されない */}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedSceneId(selectedSceneId === scene.id ? null : scene.id)
                            }
                            className="w-full text-left cursor-pointer block"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-muted-foreground bg-primary/20 px-2 py-1 rounded">
                                #{index + 1}
                              </span>
                              <h4 className="font-semibold text-foreground">{scene.title}</h4>
                              {(() => {
                                const totalSec = buildTimelineClips(scene).reduce(
                                  (sum, c) => sum + c.durationSec,
                                  0,
                                )
                                if (totalSec <= 0) return null
                                return (
                                  <span className="text-xs text-muted-foreground tabular-nums bg-background border border-border rounded px-1.5 py-0.5">
                                    {totalSec.toFixed(1)}秒
                                  </span>
                                )
                              })()}
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

                          {(selectedSceneId === scene.id || allExpanded) && (
                            <div
                              className="mt-4 pt-4 border-t border-border space-y-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* 前/次シーンナビ(allExpanded 中は並びをそのまま見られるので出さない) */}
                              {!allExpanded && (
                                <div className="flex items-center justify-between text-xs">
                                  <button
                                    type="button"
                                    onClick={() => jumpToAdjacentScene(scene.id, -1)}
                                    disabled={index === 0}
                                    className="px-3 py-1 rounded border border-input text-foreground hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                    title="前のシーンに展開を移す"
                                  >
                                    <ChevronLeft size={14} />
                                    前のシーン
                                  </button>
                                  <span className="text-muted-foreground tabular-nums">
                                    {index + 1} / {filteredScenes.length}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => jumpToAdjacentScene(scene.id, 1)}
                                    disabled={index === filteredScenes.length - 1}
                                    className="px-3 py-1 rounded border border-input text-foreground hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                    title="次のシーンに展開を移す"
                                  >
                                    次のシーン
                                    <ChevronRight size={14} />
                                  </button>
                                </div>
                              )}
                              {/* タイトル / 説明をその場で編集 */}
                              <div className="space-y-2">
                                <div>
                                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                                    タイトル
                                  </label>
                                  <Input
                                    type="text"
                                    value={scene.title ?? ''}
                                    onChange={(e) =>
                                      handleUpdateSceneFields(scene.id, { title: e.target.value })
                                    }
                                    className="bg-background border-input h-8 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                                    説明(任意)
                                  </label>
                                  <textarea
                                    value={scene.description ?? ''}
                                    onChange={(e) =>
                                      handleUpdateSceneFields(scene.id, {
                                        description: e.target.value || null,
                                      })
                                    }
                                    rows={2}
                                    placeholder="このシーンの意図やメモ…"
                                    className="w-full px-2 py-1 bg-background border border-input rounded text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                                  />
                                </div>
                              </div>
                              {/* 縮めるボタン + 別動画への移動/コピー */}
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1 flex-wrap">
                                  {videos.filter((v) => v.id !== (scene.video_id ?? null)).length >
                                    0 && (
                                    <>
                                      <select
                                        value=""
                                        onChange={(e) => {
                                          if (e.target.value)
                                            handleMoveSceneToVideo(scene.id, e.target.value)
                                          e.target.value = ''
                                        }}
                                        className="px-2 py-1 bg-card border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                        title="このシーンを別動画に移動"
                                      >
                                        <option value="">別動画へ移動…</option>
                                        {videos
                                          .filter((v) => v.id !== (scene.video_id ?? null))
                                          .map((v) => (
                                            <option key={v.id} value={v.id}>
                                              {v.name}
                                            </option>
                                          ))}
                                      </select>
                                      <select
                                        value=""
                                        onChange={(e) => {
                                          if (e.target.value)
                                            handleCopySceneToVideo(scene.id, e.target.value)
                                          e.target.value = ''
                                        }}
                                        className="px-2 py-1 bg-card border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                        title="このシーンを別動画にコピー"
                                      >
                                        <option value="">別動画へコピー…</option>
                                        {videos
                                          .filter((v) => v.id !== (scene.video_id ?? null))
                                          .map((v) => (
                                            <option key={v.id} value={v.id}>
                                              {v.name}
                                            </option>
                                          ))}
                                      </select>
                                    </>
                                  )}
                                </div>
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
                                onClipClick={(sdId) => setPreviewingSdId(sdId)}
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
                                    <button
                                      type="button"
                                      onClick={() => handleAutoArrangeCast(scene.id)}
                                      disabled={castForScene(scene.id).length === 0}
                                      className="px-2 py-1 text-xs rounded border border-input text-foreground hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="キャストを横一列に等間隔で自動配置(2人以上なら向かい合う)"
                                    >
                                      自動配置
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
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                              <span
                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                style={{
                                                  backgroundColor: charColorHsl(member.character_id),
                                                }}
                                              />
                                              <p className="text-sm font-medium text-foreground truncate">
                                                {char?.name ?? '(削除済み)'}
                                              </p>
                                            </div>
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
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <h5 className="font-medium text-foreground">シーン内のセリフ</h5>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {/* フィルタ */}
                                  <div className="flex gap-1 mr-2">
                                    {[
                                      { v: 'all' as const, label: '全部' },
                                      { v: 'chars' as const, label: 'キャラのみ' },
                                      { v: 'narration' as const, label: 'ナレのみ' },
                                      { v: 'withSe' as const, label: 'SE付き' },
                                    ].map((f) => (
                                      <button
                                        key={f.v}
                                        type="button"
                                        onClick={() => setDialogueFilter(f.v)}
                                        className={`px-2 py-0.5 text-[10px] rounded border transition ${
                                          dialogueFilter === f.v
                                            ? 'bg-primary/20 border-primary/40 text-primary font-medium'
                                            : 'bg-card border-input text-muted-foreground hover:bg-primary/10'
                                        }`}
                                      >
                                        {f.label}
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopySceneDialoguesToClipboard(scene.id)}
                                    disabled={scene.dialogues.length === 0}
                                    className="px-2 py-1 text-xs rounded border border-input text-foreground hover:bg-primary/10 disabled:opacity-50"
                                    title="このシーンの全セリフをクリップボードにコピー"
                                  >
                                    コピー
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handlePasteDialoguesToScene(scene.id)}
                                    disabled={!dialogueClipboard}
                                    className="px-2 py-1 text-xs rounded border border-input text-foreground hover:bg-primary/10 disabled:opacity-50"
                                    title={
                                      dialogueClipboard
                                        ? `「${dialogueClipboard.sourceSceneTitle}」の ${dialogueClipboard.items.length} セリフを貼付`
                                        : 'コピーされたセリフがありません'
                                    }
                                  >
                                    貼付{dialogueClipboard ? `(${dialogueClipboard.items.length})` : ''}
                                  </button>
                                </div>
                              </div>
                              {scene.dialogues && scene.dialogues.length > 0 ? (
                                <div className="space-y-2">
                                  {scene.dialogues
                                    .filter((sd) => {
                                      if (dialogueFilter === 'all') return true
                                      if (dialogueFilter === 'chars') return !!sd.dialogue?.character_id
                                      if (dialogueFilter === 'narration') return !sd.dialogue?.character_id
                                      if (dialogueFilter === 'withSe') return !!sd.se_id
                                      return true
                                    })
                                    .map((sd) => {
                                    const isNarration = !sd.dialogue?.character_id
                                    const seVol = typeof sd.se_volume === 'number' ? sd.se_volume : 1
                                    const voiceVol =
                                      typeof sd.voice_volume === 'number' ? sd.voice_volume : 1
                                    const hasVoice = !!sd.dialogue?.audio_id
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
                                    const q = searchQuery.trim().toLowerCase()
                                    const matchedBySearch =
                                      q.length > 0 &&
                                      (sd.dialogue?.text ?? '').toLowerCase().includes(q)
                                    const isDragging = draggedSdId === sd.id
                                    const isChecked = checkedSdIds.has(sd.id)
                                    return (
                                      <div
                                        key={sd.id}
                                        draggable
                                        onDragStart={(e) => {
                                          e.stopPropagation()
                                          setDraggedSdId(sd.id)
                                          try {
                                            e.dataTransfer.effectAllowed = 'move'
                                            e.dataTransfer.setData('text/plain', sd.id)
                                          } catch {}
                                        }}
                                        onDragOver={(e) => {
                                          if (draggedSdId && draggedSdId !== sd.id) {
                                            e.preventDefault()
                                            e.stopPropagation()
                                          }
                                        }}
                                        onDrop={(e) => {
                                          e.stopPropagation()
                                          if (draggedSdId && draggedSdId !== sd.id) {
                                            const sorted = [...scene.dialogues].sort(
                                              (a, b) => a.order_index - b.order_index,
                                            )
                                            const fromIdx = sorted.findIndex(
                                              (x) => x.id === draggedSdId,
                                            )
                                            const toIdx = sorted.findIndex(
                                              (x) => x.id === sd.id,
                                            )
                                            if (fromIdx !== -1 && toIdx !== -1) {
                                              handleReorderDialogues(scene.id, fromIdx, toIdx)
                                            }
                                          }
                                          setDraggedSdId(null)
                                        }}
                                        onDragEnd={() => setDraggedSdId(null)}
                                        className={`p-2 rounded text-sm space-y-2 cursor-move transition ${
                                          isDragging ? 'opacity-40' : ''
                                        } ${
                                          isChecked
                                            ? 'bg-primary/15 ring-1 ring-primary/40'
                                            : matchedBySearch
                                              ? 'bg-primary/15 border border-primary/30'
                                              : 'bg-background'
                                        }`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="flex items-center gap-2 -mt-1">
                                          <label
                                            className="flex items-center gap-1 cursor-pointer"
                                            onClick={(e) => e.stopPropagation()}
                                            title="一括操作用の選択"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => {
                                                setCheckedSdIds((prev) => {
                                                  const next = new Set(prev)
                                                  if (next.has(sd.id)) next.delete(sd.id)
                                                  else next.add(sd.id)
                                                  return next
                                                })
                                              }}
                                              className="w-3 h-3 accent-primary"
                                            />
                                          </label>
                                          <GripVertical
                                            size={12}
                                            className="text-muted-foreground flex-shrink-0"
                                          />
                                        </div>
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {sd.dialogue && (
                                                <select
                                                  value={sd.dialogue.character_id ?? ''}
                                                  onChange={(e) =>
                                                    handleChangeDialogueCharacter(
                                                      sd.dialogue!.id,
                                                      e.target.value || null,
                                                    )
                                                  }
                                                  className="px-1.5 py-0.5 text-[11px] bg-card border border-input rounded text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                                  title="このセリフの発話キャラを切替(音声と表情はリセット)"
                                                >
                                                  <option value="">ナレーション</option>
                                                  {characters.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                      {c.name}
                                                    </option>
                                                  ))}
                                                </select>
                                              )}
                                              {isNarration && (
                                                <span className="inline-block text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded align-middle">
                                                  ナレーション
                                                </span>
                                              )}
                                            </div>
                                            {sd.dialogue ? (
                                              <textarea
                                                value={sd.dialogue.text}
                                                onChange={(e) =>
                                                  handleEditDialogueText(
                                                    sd.dialogue!.id,
                                                    e.target.value,
                                                  )
                                                }
                                                rows={1}
                                                className="w-full px-2 py-1 bg-card border border-input rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y min-h-[32px]"
                                                title="セリフテキストを直接編集"
                                              />
                                            ) : (
                                              <span className="text-muted-foreground">
                                                (セリフ未解決)
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1 flex-shrink-0">
                                            {(() => {
                                              const sorted = [...scene.dialogues].sort(
                                                (a, b) => a.order_index - b.order_index,
                                              )
                                              const idx = sorted.findIndex((x) => x.id === sd.id)
                                              return (
                                                <>
                                                  <button
                                                    onClick={() =>
                                                      handleMoveSceneDialogue(scene.id, sd.id, -1)
                                                    }
                                                    disabled={idx === 0}
                                                    className="p-1 hover:bg-primary/20 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title="上へ"
                                                  >
                                                    <ChevronUp size={12} className="text-muted-foreground" />
                                                  </button>
                                                  <button
                                                    onClick={() =>
                                                      handleMoveSceneDialogue(scene.id, sd.id, 1)
                                                    }
                                                    disabled={idx === sorted.length - 1}
                                                    className="p-1 hover:bg-primary/20 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title="下へ"
                                                  >
                                                    <ChevronDown size={12} className="text-muted-foreground" />
                                                  </button>
                                                </>
                                              )
                                            })()}
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
                                        {hasVoice && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground flex-shrink-0 w-14">
                                              声の音量
                                            </span>
                                            <input
                                              type="range"
                                              min={0}
                                              max={1}
                                              step={0.05}
                                              value={voiceVol}
                                              onChange={(e) =>
                                                updateSceneDialogueMeta(scene.id, sd.id, {
                                                  voice_volume: Number(e.target.value),
                                                })
                                              }
                                              className="flex-1 accent-primary"
                                              title="このセリフのキャラ音声の音量"
                                            />
                                            <span className="text-xs text-muted-foreground w-10 tabular-nums text-right flex-shrink-0">
                                              {Math.round(voiceVol * 100)}%
                                            </span>
                                          </div>
                                        )}
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
                                        <div className="flex items-center gap-2 flex-wrap">
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
                                          <div className="flex gap-1">
                                            {[0, 500, 1000, 2000].map((ms) => {
                                              const active = (sd.pause_after_ms ?? 0) === ms
                                              return (
                                                <button
                                                  key={ms}
                                                  type="button"
                                                  onClick={() =>
                                                    updateSceneDialogueMeta(scene.id, sd.id, {
                                                      pause_after_ms: ms,
                                                    })
                                                  }
                                                  className={`px-1.5 py-0.5 text-[10px] rounded border transition tabular-nums ${
                                                    active
                                                      ? 'bg-primary/20 border-primary/40 text-primary font-medium'
                                                      : 'bg-card border-input text-muted-foreground hover:bg-primary/10'
                                                  }`}
                                                  title={`間合い ${(ms / 1000).toFixed(1)}秒`}
                                                >
                                                  {(ms / 1000).toFixed(1)}s
                                                </button>
                                              )
                                            })}
                                          </div>
                                        </div>
                                        {/* 個別字幕スタイル上書き(このセリフだけ演出を変える) */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs text-muted-foreground flex-shrink-0">
                                            字幕
                                          </span>
                                          <select
                                            value={sd.telop_intro ?? ''}
                                            onChange={(e) =>
                                              updateSceneDialogueMeta(scene.id, sd.id, {
                                                telop_intro:
                                                  (e.target.value as TelopIntro) || null,
                                              })
                                            }
                                            className="px-2 py-0.5 bg-card border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                            title="登場アニメ(空欄=全体設定を使う)"
                                          >
                                            <option value="">(全体)</option>
                                            <option value="none">なし</option>
                                            <option value="pop">ポップ</option>
                                            <option value="typewriter">タイプ</option>
                                            <option value="fade">フェード</option>
                                          </select>
                                          <span className="text-muted-foreground text-xs">|</span>
                                          <span className="text-xs text-muted-foreground flex-shrink-0">
                                            振動
                                          </span>
                                          <select
                                            value={sd.telop_shake ?? ''}
                                            onChange={(e) =>
                                              updateSceneDialogueMeta(scene.id, sd.id, {
                                                telop_shake:
                                                  (e.target.value as TelopShake) || null,
                                              })
                                            }
                                            className="px-2 py-0.5 bg-card border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                            title="振動(空欄=全体設定を使う)"
                                          >
                                            <option value="">(全体)</option>
                                            <option value="none">なし</option>
                                            <option value="subtle">微</option>
                                            <option value="heavy">強</option>
                                          </select>
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
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setBulkScriptSceneId(scene.id)
                                    setBulkScriptText('')
                                  }}
                                  title="複数行のテキストを貼り付けて一括でセリフ化(「キャラ名: セリフ」の形式を認識)"
                                >
                                  スクリプト貼付
                                </Button>
                              </div>
                              {/* セリフ再生時間の一括倍率(音声なしセリフが対象) */}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>このシーンの尺:</span>
                                {[
                                  { f: 0.75, label: '×0.75(速)' },
                                  { f: 1.25, label: '×1.25(遅)' },
                                  { f: 1.5, label: '×1.5' },
                                ].map((b) => (
                                  <button
                                    key={b.f}
                                    type="button"
                                    onClick={() => handleScaleSceneDurations(scene.id, b.f)}
                                    className="px-2 py-0.5 rounded border border-input hover:bg-primary/10 text-foreground"
                                    title={`音声なしセリフの duration_ms を ${b.f}倍`}
                                  >
                                    {b.label}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const v = window.prompt('倍率を入力(例: 0.5 / 2.0)', '1.0')
                                    const f = Number(v)
                                    if (v != null && Number.isFinite(f) && f > 0) {
                                      handleScaleSceneDurations(scene.id, f)
                                    }
                                  }}
                                  className="px-2 py-0.5 rounded border border-input hover:bg-primary/10 text-foreground"
                                  title="任意の倍率"
                                >
                                  任意…
                                </button>
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
                              handleMoveSceneByStep(scene.id, -1)
                            }}
                            disabled={index === 0}
                            className="p-2 hover:bg-primary/20 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title="上へ移動"
                          >
                            <ChevronUp size={14} className="text-muted-foreground" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMoveSceneByStep(scene.id, 1)
                            }}
                            disabled={index === filteredScenes.length - 1}
                            className="p-2 hover:bg-primary/20 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title="下へ移動"
                          >
                            <ChevronDown size={14} className="text-muted-foreground" />
                          </button>
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
                          <select
                            value={scene.video_id ?? ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation()
                              const next = e.target.value || null
                              handleMoveSceneToVideo(scene.id, next)
                            }}
                            className="text-xs bg-background border border-input rounded px-1 py-1 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="別の動画へ移動"
                          >
                            <option value="">未分類</option>
                            {videos.map((v) => (
                              <option key={v.id} value={v.id}>
                                移動: {v.name}
                              </option>
                            ))}
                          </select>
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

            {/* 動画サマリー */}
            <div>
              {(() => {
                const currentVideo = videos.find((v) => v.id === selectedVideoId) ?? null
                const videoScenes = scenes.filter(
                  (s) => (s.video_id ?? null) === selectedVideoId,
                )
                const totalDialogues = videoScenes.reduce(
                  (sum, s) => sum + s.dialogues.length,
                  0,
                )
                const totalSec = videoScenes.reduce(
                  (sum, s) => sum + buildTimelineClips(s).reduce((a, c) => a + c.durationSec, 0),
                  0,
                )
                // キャラ別出番: 発話者(speaker)+キャスト出演
                const charStats = new Map<
                  string,
                  { name: string; imageUrl: string | null; lines: number; seconds: number }
                >()
                for (const s of videoScenes) {
                  const clips = buildTimelineClips(s)
                  for (let i = 0; i < s.dialogues.length; i++) {
                    const sd = s.dialogues[i]
                    const d = sd.dialogue
                    if (!d) continue
                    const charId = d.character_id
                    if (!charId) continue
                    const char = characters.find((c) => c.id === charId)
                    if (!char) continue
                    const stat = charStats.get(charId) ?? {
                      name: char.name,
                      imageUrl: char.image_url,
                      lines: 0,
                      seconds: 0,
                    }
                    stat.lines++
                    stat.seconds += clips[i]?.durationSec ?? 0
                    charStats.set(charId, stat)
                  }
                }
                const sortedChars = Array.from(charStats.entries())
                  .map(([id, v]) => ({ id, ...v }))
                  .sort((a, b) => b.lines - a.lines)
                // BGM 使用
                const bgmUsage = new Map<string, number>()
                for (const s of videoScenes) {
                  if (s.bgm_track_id) {
                    bgmUsage.set(s.bgm_track_id, (bgmUsage.get(s.bgm_track_id) ?? 0) + 1)
                  }
                }
                // 背景使用
                const bgUsage = new Map<string, number>()
                for (const s of videoScenes) {
                  if (s.background_illustration_id) {
                    bgUsage.set(
                      s.background_illustration_id,
                      (bgUsage.get(s.background_illustration_id) ?? 0) + 1,
                    )
                  }
                }
                // 警告
                const warnings: string[] = []
                let missingAudio = 0
                for (const s of videoScenes) {
                  for (const sd of s.dialogues) {
                    const d = sd.dialogue
                    if (!d) continue
                    if (d.character_id && !d.audio_id) missingAudio++
                  }
                }
                if (missingAudio > 0) warnings.push(`音声未設定のセリフ: ${missingAudio}件`)
                const emptyScenes = videoScenes.filter((s) => s.dialogues.length === 0).length
                if (emptyScenes > 0) warnings.push(`セリフなしのシーン: ${emptyScenes}件`)

                return (
                  <Card className="bg-card border-border p-6 sticky top-8 max-h-[calc(100vh-4rem)] overflow-auto">
                    <h3 className="text-xl font-semibold text-foreground mb-1">
                      {currentVideo?.name ?? '動画サマリー'}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      この動画の内容を集計して表示
                    </p>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="p-2 bg-background rounded">
                        <p className="text-[10px] text-muted-foreground">シーン</p>
                        <p className="text-lg font-bold text-primary tabular-nums">
                          {videoScenes.length}
                        </p>
                      </div>
                      <div className="p-2 bg-background rounded">
                        <p className="text-[10px] text-muted-foreground">セリフ</p>
                        <p className="text-lg font-bold text-accent tabular-nums">
                          {totalDialogues}
                        </p>
                      </div>
                      <div className="p-2 bg-background rounded">
                        <p className="text-[10px] text-muted-foreground">総尺</p>
                        <p className="text-lg font-bold text-primary tabular-nums">
                          {totalSec.toFixed(1)}s
                        </p>
                      </div>
                    </div>

                    {sortedChars.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          キャラ別出番
                        </p>
                        <div className="space-y-1.5">
                          {sortedChars.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center gap-2 p-1.5 bg-background rounded"
                            >
                              {c.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={c.imageUrl}
                                  alt=""
                                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded bg-muted flex-shrink-0" />
                              )}
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: charColorHsl(c.id) }}
                              />
                              <p className="text-xs text-foreground truncate flex-1 min-w-0">
                                {c.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
                                {c.lines}台詞・{c.seconds.toFixed(1)}s
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {bgmUsage.size > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">使用BGM</p>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(bgmUsage.entries()).map(([id, count]) => {
                            const t = bgmTracks.find((x) => x.id === id)
                            if (!t) return null
                            return (
                              <span
                                key={id}
                                className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded"
                              >
                                {t.name} ×{count}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {bgUsage.size > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">使用背景</p>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(bgUsage.entries()).map(([id, count]) => {
                            const i = illustrations.find((x) => x.id === id)
                            if (!i) return null
                            return (
                              <span
                                key={id}
                                className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded"
                              >
                                {i.name} ×{count}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {warnings.length > 0 && (
                      <div className="pt-3 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-2">チェック</p>
                        <ul className="space-y-1">
                          {warnings.map((w, i) => (
                            <li
                              key={i}
                              className="text-[11px] text-destructive flex items-start gap-1"
                            >
                              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                )
              })()}

              {/* プロジェクト全体統計(全動画合算 + 動画別ブレイクダウン) */}
              {videos.length > 0 && (() => {
                const rows = videos.map((v) => {
                  const vs = scenes.filter((s) => (s.video_id ?? null) === v.id)
                  const totalSec = vs.reduce(
                    (sum, s) =>
                      sum + buildTimelineClips(s).reduce((a, c) => a + c.durationSec, 0),
                    0,
                  )
                  const totalDlg = vs.reduce((sum, s) => sum + s.dialogues.length, 0)
                  return { id: v.id, name: v.name, scenes: vs.length, dialogues: totalDlg, seconds: totalSec }
                })
                const nullRowScenes = scenes.filter((s) => (s.video_id ?? null) === null)
                if (nullRowScenes.length > 0) {
                  rows.push({
                    id: '__null__',
                    name: '未分類',
                    scenes: nullRowScenes.length,
                    dialogues: nullRowScenes.reduce((sum, s) => sum + s.dialogues.length, 0),
                    seconds: nullRowScenes.reduce(
                      (sum, s) =>
                        sum + buildTimelineClips(s).reduce((a, c) => a + c.durationSec, 0),
                      0,
                    ),
                  })
                }
                const gTotal = rows.reduce(
                  (acc, r) => ({
                    scenes: acc.scenes + r.scenes,
                    dialogues: acc.dialogues + r.dialogues,
                    seconds: acc.seconds + r.seconds,
                  }),
                  { scenes: 0, dialogues: 0, seconds: 0 },
                )
                const fmtMs = (s: number) => {
                  const m = Math.floor(s / 60)
                  const sec = Math.round(s % 60)
                  return m > 0 ? `${m}分${sec}秒` : `${sec}秒`
                }
                return (
                  <Card className="bg-card border-border p-4 mt-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      プロジェクト全体
                    </h3>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="p-2 bg-background rounded">
                        <p className="text-[10px] text-muted-foreground">動画</p>
                        <p className="text-base font-bold text-primary tabular-nums">
                          {videos.length}
                        </p>
                      </div>
                      <div className="p-2 bg-background rounded">
                        <p className="text-[10px] text-muted-foreground">シーン合計</p>
                        <p className="text-base font-bold text-accent tabular-nums">
                          {gTotal.scenes}
                        </p>
                      </div>
                      <div className="p-2 bg-background rounded">
                        <p className="text-[10px] text-muted-foreground">総尺合計</p>
                        <p className="text-base font-bold text-primary tabular-nums">
                          {fmtMs(gTotal.seconds)}
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-1">
                      {rows.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between gap-2 text-xs px-2 py-1 bg-background rounded"
                        >
                          <span className="truncate flex-1 text-foreground">{r.name}</span>
                          <span className="text-muted-foreground tabular-nums flex-shrink-0">
                            {r.scenes}S / {r.dialogues}セリフ / {fmtMs(r.seconds)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )
              })()}
            </div>
          </div>
        </div>
      </main>

      {/* 複数セリフ選択中のフローティング操作バー */}
      {checkedSdIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border border-primary/40 rounded-lg shadow-xl p-3 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {checkedSdIds.size} セリフ選択中
          </span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                handleBulkMoveDialogues(e.target.value)
                e.target.value = ''
              }
            }}
            className="px-2 py-1 bg-background border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">別シーンへ移動…</option>
            {scenes
              .filter((s) => (s.video_id ?? null) === selectedVideoId)
              .sort((a, b) => a.order_index - b.order_index)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title ?? '(無題)'}
                </option>
              ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkDeleteDialogues}
            className="h-8 px-2 text-xs text-destructive border-destructive/40 hover:bg-destructive/20"
          >
            <Trash2 size={12} />
            削除
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCheckedSdIds(new Set())}
            className="h-8 px-2 text-xs"
          >
            選択解除
          </Button>
        </div>
      )}

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
              illustrations={illustrations}
              onClose={() => setPlayingSceneId(null)}
            />
            {/* 動画連続再生: playingVideoId が立ってる間、対象シーンを順に再生 */}
            {(() => {
              if (!playingVideoId) return null
              const orderedScenes = scenes
                .filter((s) => (s.video_id ?? null) === playingVideoId)
                .sort((a, b) => a.order_index - b.order_index)
              const videoName = videos.find((v) => v.id === playingVideoId)?.name ?? '動画'
              const currentScene = orderedScenes[playingVideoSceneIdx] ?? null
              if (!currentScene) {
                // 範囲外なら停止
                return null
              }
              return (
                <ScenePlayerDialog
                  // key を切り替えると再マウントされて state がリセット→ autoPlay が効く
                  key={`continuous-${playingVideoId}-${playingVideoSceneIdx}`}
                  scene={currentScene}
                  characters={characters}
                  audioFiles={audioFiles}
                  expressions={expressions}
                  backgroundLayers={backgroundLayersForScene(currentScene)}
                  bgmTrack={bgmForScene(currentScene)}
                  bgmVolume={
                    typeof currentScene.bgm_volume === 'number'
                      ? currentScene.bgm_volume
                      : 0.25
                  }
                  sounds={sounds}
                  telopStyle={telopStyle}
                  sceneCast={castForScene(currentScene.id)}
                  illustrations={illustrations}
                  autoPlay
                  title={`${videoName}(通し再生)— ${playingVideoSceneIdx + 1}/${orderedScenes.length} ${currentScene.title}`}
                  onQueueEnd={() => {
                    if (playingVideoSceneIdx + 1 < orderedScenes.length) {
                      setPlayingVideoSceneIdx((i) => i + 1)
                    } else {
                      setPlayingVideoId(null)
                      setPlayingVideoSceneIdx(0)
                    }
                  }}
                  onClose={() => {
                    setPlayingVideoId(null)
                    setPlayingVideoSceneIdx(0)
                  }}
                />
              )
            })()}
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
                  illustrations={illustrations}
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
            {/* スクリプト一括貼り付け */}
            <Dialog
              open={!!bulkScriptSceneId}
              onOpenChange={(o) => {
                if (!o) {
                  setBulkScriptSceneId(null)
                  setBulkScriptText('')
                }
              }}
            >
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>スクリプト一括貼り付け</DialogTitle>
                  <DialogDescription>
                    1行=1セリフで一括追加します。「キャラ名: セリフ」か「キャラ名「セリフ」」の形式だと、そのキャラのセリフとして登録。それ以外はナレーション扱い。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <textarea
                    value={bulkScriptText}
                    onChange={(e) => setBulkScriptText(e.target.value)}
                    placeholder={'例:\nアリス: おはよう!\nボブ: やあ。今日もいい天気だね。\nそして二人は歩き出した。'}
                    rows={10}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  />
                  <div className="text-xs text-muted-foreground">
                    {(() => {
                      const lines = bulkScriptText
                        .split(/\r?\n/)
                        .map((l) => l.trim())
                        .filter((l) => l.length > 0)
                      return `${lines.length} 行を追加します`
                    })()}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBulkScriptSceneId(null)
                        setBulkScriptText('')
                      }}
                    >
                      キャンセル
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApplyBulkScript}
                      disabled={bulkScriptText.trim().length === 0}
                    >
                      追加する
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {/* 未使用アセット掃除 */}
            <Dialog open={showCleanup} onOpenChange={(o) => setShowCleanup(o)}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>未使用アセットの掃除</DialogTitle>
                  <DialogDescription>
                    シーン・セリフのどこからも参照されていない素材を削除します。復元はできません。
                  </DialogDescription>
                </DialogHeader>
                {(() => {
                  const { unusedBg, unusedBgm, unusedSe } = computeUnusedAssets()
                  const total = unusedBg.length + unusedBgm.length + unusedSe.length
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 bg-background rounded text-center">
                          <p className="text-[10px] text-muted-foreground">背景</p>
                          <p className="text-lg font-bold text-primary tabular-nums">
                            {unusedBg.length}
                          </p>
                        </div>
                        <div className="p-2 bg-background rounded text-center">
                          <p className="text-[10px] text-muted-foreground">BGM</p>
                          <p className="text-lg font-bold text-primary tabular-nums">
                            {unusedBgm.length}
                          </p>
                        </div>
                        <div className="p-2 bg-background rounded text-center">
                          <p className="text-[10px] text-muted-foreground">SE</p>
                          <p className="text-lg font-bold text-primary tabular-nums">
                            {unusedSe.length}
                          </p>
                        </div>
                      </div>
                      {total > 0 && (
                        <div className="max-h-60 overflow-y-auto space-y-1 border border-border rounded p-2">
                          {unusedBg.map((i) => (
                            <div
                              key={`bg-${i.id}`}
                              className="text-xs text-muted-foreground flex items-center gap-2"
                            >
                              <span className="text-[10px] px-1 bg-accent/20 rounded">背景</span>
                              <span className="truncate">{i.name}</span>
                            </div>
                          ))}
                          {unusedBgm.map((b) => (
                            <div
                              key={`bgm-${b.id}`}
                              className="text-xs text-muted-foreground flex items-center gap-2"
                            >
                              <span className="text-[10px] px-1 bg-accent/20 rounded">BGM</span>
                              <span className="truncate">{b.name}</span>
                            </div>
                          ))}
                          {unusedSe.map((s) => (
                            <div
                              key={`se-${s.id}`}
                              className="text-xs text-muted-foreground flex items-center gap-2"
                            >
                              <span className="text-[10px] px-1 bg-accent/20 rounded">SE</span>
                              <span className="truncate">{s.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setShowCleanup(false)}>
                          キャンセル
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleCleanupUnused}
                          disabled={total === 0}
                          className="text-destructive"
                        >
                          {total} 件を削除
                        </Button>
                      </div>
                    </div>
                  )
                })()}
              </DialogContent>
            </Dialog>
            {/* キャラ別セリフ一覧 */}
            <Dialog
              open={!!charLinesViewId}
              onOpenChange={(o) => !o && setCharLinesViewId(null)}
            >
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>キャラ別セリフ一覧</DialogTitle>
                  <DialogDescription>
                    シーンを横断して、選んだキャラのセリフをすべて確認できます。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {characters.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCharLinesViewId(c.id)}
                        className={`px-2 py-1 text-xs rounded border transition ${
                          charLinesViewId === c.id
                            ? 'bg-primary/20 border-primary/40 text-primary font-medium'
                            : 'bg-card border-input text-foreground hover:bg-primary/10'
                        }`}
                        style={{
                          borderLeft: `4px solid ${charColorHsl(c.id)}`,
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                  {(() => {
                    if (!charLinesViewId) return null
                    const char = characters.find((c) => c.id === charLinesViewId)
                    if (!char) return null
                    type Row = {
                      sdId: string
                      sceneTitle: string
                      sceneIdx: number
                      videoName: string
                      text: string
                      sceneId: string
                    }
                    const rows: Row[] = []
                    const orderedVideos = [...videos].sort(
                      (a, b) => a.order_index - b.order_index,
                    )
                    for (const v of orderedVideos) {
                      const vs = scenes
                        .filter((s) => (s.video_id ?? null) === v.id)
                        .sort((a, b) => a.order_index - b.order_index)
                      vs.forEach((s, sidx) => {
                        for (const sd of s.dialogues) {
                          if (sd.dialogue?.character_id === char.id) {
                            rows.push({
                              sdId: sd.id,
                              sceneTitle: s.title ?? '(無題)',
                              sceneIdx: sidx,
                              videoName: v.name,
                              text: sd.dialogue.text,
                              sceneId: s.id,
                            })
                          }
                        }
                      })
                    }
                    const uncatScenes = scenes
                      .filter((s) => (s.video_id ?? null) === null)
                      .sort((a, b) => a.order_index - b.order_index)
                    uncatScenes.forEach((s, sidx) => {
                      for (const sd of s.dialogues) {
                        if (sd.dialogue?.character_id === char.id) {
                          rows.push({
                            sdId: sd.id,
                            sceneTitle: s.title ?? '(無題)',
                            sceneIdx: sidx,
                            videoName: '未分類',
                            text: sd.dialogue.text,
                            sceneId: s.id,
                          })
                        }
                      }
                    })
                    return (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {char.name} のセリフ: {rows.length} 件
                        </p>
                        <div className="max-h-96 overflow-y-auto space-y-1 border border-border rounded p-2">
                          {rows.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              セリフがありません
                            </p>
                          ) : (
                            rows.map((r) => (
                              <button
                                key={r.sdId}
                                type="button"
                                onClick={() => {
                                  setSelectedSceneId(r.sceneId)
                                  setCharLinesViewId(null)
                                }}
                                className="w-full text-left p-2 bg-background rounded hover:bg-primary/10 transition"
                                title="このセリフのシーンを展開"
                              >
                                <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                                  <span className="tabular-nums">
                                    {r.videoName} #{r.sceneIdx + 1}
                                  </span>
                                  <span className="truncate">{r.sceneTitle}</span>
                                </div>
                                <div className="text-sm text-foreground mt-1 break-words whitespace-pre-wrap">
                                  {r.text}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </DialogContent>
            </Dialog>
            {/* 全データリセット */}
            <Dialog
              open={showResetConfirm}
              onOpenChange={(o) => {
                setShowResetConfirm(o)
                if (!o) setResetInput('')
              }}
            >
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-destructive">
                    すべてのデータを削除
                  </DialogTitle>
                  <DialogDescription>
                    動画・シーン・セリフ・キャラ・音声・画像・BGM・SE、そしてテロップ設定を含む
                    IndexedDB 内の全データを削除します。この操作は取り消せません。
                    続行するには下に「reset」と入力してください。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    type="text"
                    value={resetInput}
                    onChange={(e) => setResetInput(e.target.value)}
                    placeholder="reset"
                    className="bg-background border-destructive/40"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowResetConfirm(false)}
                    >
                      キャンセル
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleFullReset}
                      disabled={resetInput !== 'reset'}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                    >
                      完全に削除
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {/* キャラ一括置換 */}
            <Dialog open={showCharReplace} onOpenChange={(o) => setShowCharReplace(o)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>キャラ一括置換</DialogTitle>
                  <DialogDescription>
                    指定キャラのセリフをまとめて別キャラ or ナレーションに置き換えます。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      置換元キャラ
                    </label>
                    <select
                      value={charReplaceFrom}
                      onChange={(e) => setCharReplaceFrom(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">-- キャラを選択 --</option>
                      {characters.map((c) => {
                        const count = dialogues.filter((d) => d.character_id === c.id).length
                        return (
                          <option key={c.id} value={c.id}>
                            {c.name}({count} 件)
                          </option>
                        )
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      置換先
                    </label>
                    <select
                      value={charReplaceTo}
                      onChange={(e) => setCharReplaceTo(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">(ナレーション化)</option>
                      {characters
                        .filter((c) => c.id !== charReplaceFrom)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={charReplaceResetAudio}
                      onChange={(e) => setCharReplaceResetAudio(e.target.checked)}
                      className="accent-primary"
                    />
                    <span>音声と表情もリセット(推奨)</span>
                  </label>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCharReplace(false)}
                    >
                      キャンセル
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApplyCharReplace}
                      disabled={!charReplaceFrom}
                    >
                      置換実行
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {/* ショートカットヘルプ(? キーで開閉) */}
            <Dialog open={showShortcutsHelp} onOpenChange={(o) => setShowShortcutsHelp(o)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>キーボードショートカット</DialogTitle>
                  <DialogDescription>
                    入力欄にフォーカスがないときだけ有効です
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 text-sm">
                  {[
                    { k: '?', d: 'このヘルプを開閉' },
                    { k: '/', d: 'セリフ検索ボックスにフォーカス' },
                    { k: 'Esc', d: '選択解除 / 全展開解除 / 展開シーンを閉じる' },
                    { k: 'Ctrl / ⌘ + A', d: '現在の動画内のシーンを全選択' },
                    { k: 'Ctrl / ⌘ + D', d: '選択 or 展開中のシーンを複製' },
                    { k: 'Alt + 1〜9', d: 'その順番の動画タブへ切替' },
                    { k: 'Alt + 0', d: '未分類タブへ切替' },
                    { k: 'Delete / Backspace', d: '選択中のシーンを一括削除' },
                  ].map((row) => (
                    <div
                      key={row.k}
                      className="flex items-center justify-between gap-3 px-3 py-2 bg-background border border-border rounded"
                    >
                      <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono text-foreground tabular-nums">
                        {row.k}
                      </kbd>
                      <span className="text-muted-foreground text-right flex-1">
                        {row.d}
                      </span>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            {/* BGM 一括変更ダイアログ */}
            <Dialog open={showBulkBgm} onOpenChange={(o) => !o && setShowBulkBgm(false)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    BGM 一括変更(
                    {videos.find((v) => v.id === selectedVideoId)?.name ?? ''})
                  </DialogTitle>
                  <DialogDescription>
                    この動画内の全シーン(
                    {
                      scenes.filter((s) => (s.video_id ?? null) === selectedVideoId).length
                    }
                    シーン)の BGM を一括で置き換えます。シーンの他の設定は変わりません。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      BGM
                    </label>
                    <select
                      value={bulkBgmId}
                      onChange={(e) => setBulkBgmId(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">なし(BGM を外す)</option>
                      {bgmTracks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {bulkBgmId && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        音量: {Math.round(bulkBgmVolume * 100)}%
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={bulkBgmVolume}
                        onChange={(e) => setBulkBgmVolume(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowBulkBgm(false)}>
                    キャンセル
                  </Button>
                  <Button onClick={handleApplyBulkBgm}>適用</Button>
                </div>
              </DialogContent>
            </Dialog>
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
  voiceVolume: number
  characterX: number
  characterScale: number
  characterFlipped: boolean
  extras: StageExtraResolved[]
  // ナレーション(無音)用の表示時間 ms。audio がある場合は無視される
  silentDurationMs: number
  // 次のセリフに進む前の間合い(ms)
  pauseAfterMs: number
  // テロップの個別上書き(null ならグローバル設定)
  telopStyleForThis: TelopStyle
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
  illustrations,
  startAtSdId,
  singleMode,
  autoPlay,
  title,
  onQueueEnd,
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
  illustrations: IllustrationWithLayers[] // PNG スナップショット用
  startAtSdId?: string | null // この SceneDialogue から再生を開始
  singleMode?: boolean // true のとき 1 セリフだけ再生して停止(プレビュー用)
  autoPlay?: boolean // ダイアログ表示と同時に再生開始(連続再生用)
  title?: string // タイトル上書き(連続再生時に「動画名 - シーンN」などを表示)
  onQueueEnd?: () => void // キューを最後まで再生し終わったときに呼ばれる(連続再生ハンドオフ用)
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [bgmMuted, setBgmMuted] = useState(false)
  const bgmRef = useRef<HTMLAudioElement | null>(null)
  const seRef = useRef<HTMLAudioElement | null>(null)
  const pauseTimerRef = useRef<number | null>(null)
  const queueListRef = useRef<HTMLOListElement | null>(null)

  // scene が変わったらリセット(autoPlay なら自動再生開始)
  useEffect(() => {
    setIndex(0)
    setPlaying(!!autoPlay && !!scene)
  }, [scene?.id, autoPlay])

  // BGM: playing=true の間だけループ再生(ミュート時は音量 0)
  useEffect(() => {
    const el = bgmRef.current
    if (!el) return
    el.volume = bgmMuted ? 0 : bgmVolume
    el.playbackRate = playbackRate
    if (playing && bgmTrack) {
      el.currentTime = 0
      el.play().catch((e) => console.warn('[anime-app] bgm play blocked', e))
    } else {
      el.pause()
    }
  }, [playing, bgmTrack?.id, bgmVolume, playbackRate, bgmMuted])

  // SE: 現在のセリフが切り替わるたびに冒頭で oneshot 再生
  useEffect(() => {
    if (!playing) return
    const current = queue[index]
    if (!current?.se) return
    const el = seRef.current
    if (!el) return
    el.src = current.se.file_url
    el.volume = current.seVolume
    el.playbackRate = playbackRate
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
      const voiceVolume = typeof sd.voice_volume === 'number' ? sd.voice_volume : 1
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
      const telopStyleForThis: TelopStyle = {
        ...telopStyle,
        intro: sd.telop_intro ?? telopStyle.intro,
        shake: sd.telop_shake ?? telopStyle.shake,
      }
      return {
        sdId: sd.id,
        text: d.text,
        character,
        audio,
        expressionId: d.expression_id,
        charExpressions,
        se,
        seVolume,
        voiceVolume,
        characterX,
        characterScale,
        characterFlipped,
        extras,
        silentDurationMs,
        pauseAfterMs,
        telopStyleForThis,
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
    const gap = Math.round((current?.pauseAfterMs ?? 0) / playbackRate)
    if (singleMode || !hasNext) {
      // 最後 or 1セリフモードは停止
      const finalize = () => {
        setPlaying(false)
        // 連続再生ハンドオフ: 1セリフモードでなく、親が次のシーンに渡したい場合に呼ぶ
        if (!singleMode && onQueueEnd) onQueueEnd()
      }
      if (gap > 0 && !singleMode) {
        pauseTimerRef.current = window.setTimeout(finalize, gap)
      } else {
        finalize()
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

  // 現在再生中のセリフへキューリストを自動スクロール
  useEffect(() => {
    const ol = queueListRef.current
    if (!ol) return
    const target = ol.querySelector(
      `[data-queue-idx="${index}"]`,
    ) as HTMLElement | null
    if (target) {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [index])

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
          <DialogTitle>{title ?? `${scene.title} を再生`}</DialogTitle>
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
                telopStyle={current?.telopStyleForThis ?? telopStyle}
                backgroundLayers={backgroundLayers}
                characterX={current?.characterX ?? 0.5}
                characterScale={current?.characterScale ?? 1.0}
                characterFlipped={current?.characterFlipped ?? false}
                extraCharacters={current?.extras ?? []}
                silentDurationMs={current?.silentDurationMs ?? 3000}
                playbackRate={playbackRate}
                audioVolume={current?.voiceVolume ?? 1}
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
              <button
                type="button"
                onClick={async () => {
                  if (!scene || !current) return
                  const url = await renderSceneFrame(
                    scene,
                    { characters, audioFiles, expressions, illustrations, sceneCast },
                    {
                      width: 1920,
                      height: 1080,
                      targetSdId: current.sdId,
                      format: 'image/png',
                      overlay: false,
                    },
                  )
                  if (!url) return
                  const a = document.createElement('a')
                  a.href = url
                  const safeTitle = (scene.title ?? 'scene').replace(/[^\w一-龠ぁ-んァ-ヶ]+/g, '_')
                  a.download = `${safeTitle}_${index + 1}.png`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                }}
                className="ml-2 px-2 py-1 text-xs rounded border border-input text-foreground hover:bg-primary/10 transition"
                title="現在のフレームを 1920x1080 の PNG で保存"
              >
                PNG保存
              </button>
              {bgmTrack && (
                <button
                  type="button"
                  onClick={() => setBgmMuted((v) => !v)}
                  className={`ml-2 px-2 py-1 text-xs rounded border transition inline-flex items-center gap-1 ${
                    bgmMuted
                      ? 'bg-destructive/20 border-destructive/40 text-destructive'
                      : 'bg-background border-input text-muted-foreground hover:bg-primary/10'
                  }`}
                  title={bgmMuted ? 'BGM ミュート中(クリックで解除)' : 'BGM をミュート'}
                >
                  {bgmMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  <span>BGM</span>
                </button>
              )}
              <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                <span>速度</span>
                {[0.5, 1, 1.5, 2].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPlaybackRate(r)}
                    className={`px-2 py-1 rounded border tabular-nums transition ${
                      playbackRate === r
                        ? 'bg-primary/20 border-primary/40 text-primary font-medium'
                        : 'bg-background border-input hover:bg-primary/10'
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>

            {/* セリフ一覧(プレビュー) */}
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-2">再生キュー</p>
              <ol ref={queueListRef} className="space-y-1 text-sm max-h-48 overflow-y-auto">
                {queue.map((q, i) => (
                  <li
                    key={i}
                    data-queue-idx={i}
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
