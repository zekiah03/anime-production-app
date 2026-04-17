// IndexedDB based persistence layer.
// Audio Blobs と 画像 Blob を含めて全てのエンティティをブラウザ内に保存する。
// 将来クラウド同期に切り替えるときは、各関数のシグネチャを維持してバックエンドを差し替えればよい。

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  Character,
  CharacterExpression,
  AudioFile,
  BgmTrack,
  CastPreset,
  Dialogue,
  Scene,
  SceneDialogue,
  SceneCastMember,
  SoundEffect,
  Illustration,
  Layer,
  TelopStyle,
  Video,
} from '@/types/db'
import { DEFAULT_TELOP_STYLE } from '@/types/db'

const DB_NAME = 'anime-production'
const DB_VERSION = 8

// 永続化形式 (file_url / image_url は実行時に Blob から生成するので保存しない)
type StoredCharacter = Omit<Character, 'image_url'> & { image_blob?: Blob }
type StoredAudioFile = Omit<AudioFile, 'file_url'> & { file_blob: Blob }
type StoredLayer = Omit<Layer, 'image_url'> & { image_blob: Blob }
type StoredExpression = Omit<CharacterExpression, 'image_url'> & { image_blob: Blob }
type StoredBgmTrack = Omit<BgmTrack, 'file_url'> & { file_blob: Blob }
type StoredSoundEffect = Omit<SoundEffect, 'file_url'> & { file_blob: Blob }

interface AnimeDB extends DBSchema {
  characters: { key: string; value: StoredCharacter }
  character_expressions: {
    key: string
    value: StoredExpression
    indexes: { by_character: string }
  }
  audio_files: {
    key: string
    value: StoredAudioFile
    indexes: { by_character: string }
  }
  dialogues: {
    key: string
    value: Dialogue
    indexes: { by_character: string }
  }
  scenes: { key: string; value: Scene }
  scene_dialogues: {
    key: string
    value: SceneDialogue
    indexes: { by_scene: string; by_dialogue: string }
  }
  illustrations: { key: string; value: Illustration }
  layers: {
    key: string
    value: StoredLayer
    indexes: { by_illustration: string }
  }
  bgm_tracks: { key: string; value: StoredBgmTrack }
  sound_effects: { key: string; value: StoredSoundEffect }
  // settings: id をキーにした singleton。今は 'telop' のみ
  settings: { key: string; value: { id: string; telop_style?: TelopStyle } }
  // シーンの登場キャラ(複数キャラを同時配置)
  scene_cast: {
    key: string
    value: SceneCastMember
    indexes: { by_scene: string; by_character: string }
  }
  // 動画(シーンの入れ物)
  videos: { key: string; value: Video }
  // キャスト配置プリセット(シーンの登場キャラ構成を使い回す)
  cast_presets: { key: string; value: CastPreset }
}

let dbPromise: Promise<IDBPDatabase<AnimeDB>> | null = null

function getDB() {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in the browser')
  }
  if (!dbPromise) {
    dbPromise = openDB<AnimeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('characters')) {
          db.createObjectStore('characters', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('audio_files')) {
          const store = db.createObjectStore('audio_files', { keyPath: 'id' })
          store.createIndex('by_character', 'character_id')
        }
        if (!db.objectStoreNames.contains('dialogues')) {
          const store = db.createObjectStore('dialogues', { keyPath: 'id' })
          store.createIndex('by_character', 'character_id')
        }
        if (!db.objectStoreNames.contains('scenes')) {
          db.createObjectStore('scenes', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('scene_dialogues')) {
          const store = db.createObjectStore('scene_dialogues', { keyPath: 'id' })
          store.createIndex('by_scene', 'scene_id')
          store.createIndex('by_dialogue', 'dialogue_id')
        }
        if (!db.objectStoreNames.contains('illustrations')) {
          db.createObjectStore('illustrations', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('layers')) {
          const store = db.createObjectStore('layers', { keyPath: 'id' })
          store.createIndex('by_illustration', 'illustration_id')
        }
        if (!db.objectStoreNames.contains('character_expressions')) {
          const store = db.createObjectStore('character_expressions', { keyPath: 'id' })
          store.createIndex('by_character', 'character_id')
        }
        if (!db.objectStoreNames.contains('bgm_tracks')) {
          db.createObjectStore('bgm_tracks', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('sound_effects')) {
          db.createObjectStore('sound_effects', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('scene_cast')) {
          const store = db.createObjectStore('scene_cast', { keyPath: 'id' })
          store.createIndex('by_scene', 'scene_id')
          store.createIndex('by_character', 'character_id')
        }
        if (!db.objectStoreNames.contains('videos')) {
          db.createObjectStore('videos', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('cast_presets')) {
          db.createObjectStore('cast_presets', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

// ==================== Characters ====================

function hydrateCharacter(stored: StoredCharacter): Character {
  return {
    ...stored,
    image_url: stored.image_blob ? URL.createObjectURL(stored.image_blob) : null,
  }
}

export async function getAllCharacters(): Promise<Character[]> {
  const db = await getDB()
  const all = await db.getAll('characters')
  return all
    .map(hydrateCharacter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function saveCharacter(character: Character): Promise<void> {
  const db = await getDB()
  const { image_url: _image_url, ...rest } = character
  void _image_url
  await db.put('characters', rest as StoredCharacter)
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await getDB()
  // 関連する audio_files / dialogues の character_id を null / expressions と scene_cast は削除
  const tx = db.transaction(
    ['characters', 'audio_files', 'dialogues', 'character_expressions', 'scene_cast'],
    'readwrite',
  )
  await tx.objectStore('characters').delete(id)

  const audioIndex = tx.objectStore('audio_files').index('by_character')
  for await (const cursor of audioIndex.iterate(id)) {
    await cursor.update({ ...cursor.value, character_id: null })
  }
  const dialogueIndex = tx.objectStore('dialogues').index('by_character')
  for await (const cursor of dialogueIndex.iterate(id)) {
    await cursor.update({ ...cursor.value, character_id: null })
  }
  const exprIndex = tx.objectStore('character_expressions').index('by_character')
  for await (const cursor of exprIndex.iterate(id)) {
    await cursor.delete()
  }
  const castIndex = tx.objectStore('scene_cast').index('by_character')
  for await (const cursor of castIndex.iterate(id)) {
    await cursor.delete()
  }
  await tx.done
}

// ==================== Character Expressions ====================

function hydrateExpression(stored: StoredExpression): CharacterExpression {
  return {
    ...stored,
    image_url: URL.createObjectURL(stored.image_blob),
  }
}

export async function getExpressionsByCharacter(
  characterId: string,
): Promise<CharacterExpression[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('character_expressions', 'by_character', characterId)
  return all
    .map(hydrateExpression)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function getAllExpressions(): Promise<CharacterExpression[]> {
  const db = await getDB()
  const all = await db.getAll('character_expressions')
  return all
    .map(hydrateExpression)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function saveExpression(expr: CharacterExpression): Promise<void> {
  if (!expr.image_blob) throw new Error('image_blob is required')
  const db = await getDB()
  const { image_url: _image_url, ...rest } = expr
  void _image_url
  await db.put('character_expressions', { ...rest, image_blob: expr.image_blob })
}

export async function deleteExpression(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('character_expressions', id)
}

// ==================== Audio ====================

function hydrateAudio(stored: StoredAudioFile): AudioFile {
  return {
    ...stored,
    file_url: URL.createObjectURL(stored.file_blob),
  }
}

export async function getAllAudioFiles(): Promise<AudioFile[]> {
  const db = await getDB()
  const all = await db.getAll('audio_files')
  return all
    .map(hydrateAudio)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function saveAudioFile(audio: AudioFile): Promise<void> {
  if (!audio.file_blob) throw new Error('file_blob is required')
  const db = await getDB()
  const { file_url: _file_url, ...rest } = audio
  void _file_url
  await db.put('audio_files', { ...rest, file_blob: audio.file_blob })
}

export async function deleteAudioFile(id: string): Promise<void> {
  const db = await getDB()
  // 関連する dialogues の audio_id を null にする
  const tx = db.transaction(['audio_files', 'dialogues'], 'readwrite')
  await tx.objectStore('audio_files').delete(id)

  const allDialogues = await tx.objectStore('dialogues').getAll()
  for (const d of allDialogues) {
    if (d.audio_id === id) {
      await tx.objectStore('dialogues').put({ ...d, audio_id: null })
    }
  }
  await tx.done
}

// ==================== Dialogues ====================

export async function getAllDialogues(): Promise<Dialogue[]> {
  const db = await getDB()
  const all = await db.getAll('dialogues')
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function saveDialogue(dialogue: Dialogue): Promise<void> {
  const db = await getDB()
  await db.put('dialogues', dialogue)
}

export async function deleteDialogue(id: string): Promise<void> {
  const db = await getDB()
  // 関連する scene_dialogues も削除
  const tx = db.transaction(['dialogues', 'scene_dialogues'], 'readwrite')
  await tx.objectStore('dialogues').delete(id)

  const sdIndex = tx.objectStore('scene_dialogues').index('by_dialogue')
  for await (const cursor of sdIndex.iterate(id)) {
    await cursor.delete()
  }
  await tx.done
}

// ==================== Scenes ====================

export async function getAllScenes(): Promise<Scene[]> {
  const db = await getDB()
  const all = await db.getAll('scenes')
  return all.sort((a, b) => a.order_index - b.order_index)
}

export async function saveScene(scene: Scene): Promise<void> {
  const db = await getDB()
  await db.put('scenes', scene)
}

export async function saveScenesBatch(scenes: Scene[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('scenes', 'readwrite')
  await Promise.all(scenes.map((s) => tx.store.put(s)))
  await tx.done
}

export async function deleteScene(id: string): Promise<void> {
  const db = await getDB()
  // 関連する scene_dialogues / scene_cast も削除
  const tx = db.transaction(['scenes', 'scene_dialogues', 'scene_cast'], 'readwrite')
  await tx.objectStore('scenes').delete(id)

  const sdIndex = tx.objectStore('scene_dialogues').index('by_scene')
  for await (const cursor of sdIndex.iterate(id)) {
    await cursor.delete()
  }
  const castIndex = tx.objectStore('scene_cast').index('by_scene')
  for await (const cursor of castIndex.iterate(id)) {
    await cursor.delete()
  }
  await tx.done
}

// ==================== Scene Dialogues ====================

export async function getAllSceneDialogues(): Promise<SceneDialogue[]> {
  const db = await getDB()
  return db.getAll('scene_dialogues')
}

export async function saveSceneDialogue(sd: SceneDialogue): Promise<void> {
  const db = await getDB()
  await db.put('scene_dialogues', sd)
}

export async function deleteSceneDialogue(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('scene_dialogues', id)
}

// ==================== Illustrations ====================

export async function getAllIllustrations(): Promise<Illustration[]> {
  const db = await getDB()
  const all = await db.getAll('illustrations')
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function saveIllustration(illust: Illustration): Promise<void> {
  const db = await getDB()
  await db.put('illustrations', illust)
}

export async function deleteIllustration(id: string): Promise<void> {
  const db = await getDB()
  // 関連する layers も削除
  const tx = db.transaction(['illustrations', 'layers'], 'readwrite')
  await tx.objectStore('illustrations').delete(id)

  const layerIndex = tx.objectStore('layers').index('by_illustration')
  for await (const cursor of layerIndex.iterate(id)) {
    await cursor.delete()
  }
  await tx.done
}

// ==================== Layers ====================

function hydrateLayer(stored: StoredLayer): Layer {
  return {
    ...stored,
    image_url: URL.createObjectURL(stored.image_blob),
  }
}

export async function getLayersByIllustration(illustrationId: string): Promise<Layer[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('layers', 'by_illustration', illustrationId)
  return all.map(hydrateLayer)
}

export async function saveLayer(layer: Layer): Promise<void> {
  if (!layer.image_blob) throw new Error('image_blob is required')
  const db = await getDB()
  const { image_url: _image_url, ...rest } = layer
  void _image_url
  await db.put('layers', { ...rest, image_blob: layer.image_blob })
}

export async function saveLayersBatch(layers: Layer[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('layers', 'readwrite')
  await Promise.all(
    layers
      .filter((l) => l.image_blob)
      .map((l) => {
        const { image_url: _image_url, ...rest } = l
        void _image_url
        return tx.store.put({ ...rest, image_blob: l.image_blob! })
      }),
  )
  await tx.done
}

export async function deleteLayer(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('layers', id)
}

// ==================== BGM Tracks ====================

function hydrateBgm(stored: StoredBgmTrack): BgmTrack {
  return {
    ...stored,
    file_url: URL.createObjectURL(stored.file_blob),
  }
}

export async function getAllBgmTracks(): Promise<BgmTrack[]> {
  const db = await getDB()
  const all = await db.getAll('bgm_tracks')
  return all
    .map(hydrateBgm)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function saveBgmTrack(track: BgmTrack): Promise<void> {
  if (!track.file_blob) throw new Error('file_blob is required')
  const db = await getDB()
  const { file_url: _file_url, ...rest } = track
  void _file_url
  await db.put('bgm_tracks', { ...rest, file_blob: track.file_blob })
}

export async function deleteBgmTrack(id: string): Promise<void> {
  const db = await getDB()
  // 関連する scenes の bgm_track_id を null にする
  const tx = db.transaction(['bgm_tracks', 'scenes'], 'readwrite')
  await tx.objectStore('bgm_tracks').delete(id)

  for await (const cursor of tx.objectStore('scenes').iterate()) {
    if (cursor.value.bgm_track_id === id) {
      await cursor.update({ ...cursor.value, bgm_track_id: null })
    }
  }
  await tx.done
}

// ==================== Sound Effects ====================

function hydrateSe(stored: StoredSoundEffect): SoundEffect {
  return {
    ...stored,
    file_url: URL.createObjectURL(stored.file_blob),
  }
}

export async function getAllSoundEffects(): Promise<SoundEffect[]> {
  const db = await getDB()
  const all = await db.getAll('sound_effects')
  return all
    .map(hydrateSe)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function saveSoundEffect(se: SoundEffect): Promise<void> {
  if (!se.file_blob) throw new Error('file_blob is required')
  const db = await getDB()
  const { file_url: _file_url, ...rest } = se
  void _file_url
  await db.put('sound_effects', { ...rest, file_blob: se.file_blob })
}

export async function deleteSoundEffect(id: string): Promise<void> {
  const db = await getDB()
  // 関連する scene_dialogues の se_id を null にする
  const tx = db.transaction(['sound_effects', 'scene_dialogues'], 'readwrite')
  await tx.objectStore('sound_effects').delete(id)

  for await (const cursor of tx.objectStore('scene_dialogues').iterate()) {
    if (cursor.value.se_id === id) {
      await cursor.update({ ...cursor.value, se_id: null })
    }
  }
  await tx.done
}

// ==================== Cast Presets ====================

export async function getAllCastPresets(): Promise<CastPreset[]> {
  const db = await getDB()
  const all = await db.getAll('cast_presets')
  return all.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export async function saveCastPreset(preset: CastPreset): Promise<void> {
  const db = await getDB()
  await db.put('cast_presets', preset)
}

export async function deleteCastPreset(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('cast_presets', id)
}

// ==================== Videos(シーンの入れ物) ====================

export async function getAllVideos(): Promise<Video[]> {
  const db = await getDB()
  const all = await db.getAll('videos')
  return all.sort((a, b) => a.order_index - b.order_index)
}

export async function saveVideo(video: Video): Promise<void> {
  const db = await getDB()
  await db.put('videos', video)
}

export async function deleteVideo(id: string): Promise<void> {
  const db = await getDB()
  // その動画に属していたシーンは未分類(video_id=null)に外す
  const tx = db.transaction(['videos', 'scenes'], 'readwrite')
  await tx.objectStore('videos').delete(id)
  for await (const cursor of tx.objectStore('scenes').iterate()) {
    if (cursor.value.video_id === id) {
      await cursor.update({ ...cursor.value, video_id: null })
    }
  }
  await tx.done
}

// ==================== Scene Cast ====================

export async function getAllSceneCast(): Promise<SceneCastMember[]> {
  const db = await getDB()
  return db.getAll('scene_cast')
}

export async function getSceneCast(sceneId: string): Promise<SceneCastMember[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('scene_cast', 'by_scene', sceneId)
  return all.sort((a, b) => a.order_index - b.order_index)
}

export async function saveSceneCastMember(member: SceneCastMember): Promise<void> {
  const db = await getDB()
  await db.put('scene_cast', member)
}

export async function deleteSceneCastMember(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('scene_cast', id)
}

// ==================== Settings (singleton) ====================

export async function getTelopStyle(): Promise<TelopStyle> {
  const db = await getDB()
  const row = await db.get('settings', 'telop')
  return row?.telop_style ?? DEFAULT_TELOP_STYLE
}

export async function saveTelopStyle(style: TelopStyle): Promise<void> {
  const db = await getDB()
  await db.put('settings', { id: 'telop', telop_style: style })
}

// ==================== Raw access (for export/import) ====================

// プロジェクト書き出し/読み込みのために生データにアクセスするヘルパー。
// 通常の getAll*() は URL を hydrate するため、エクスポートには不向き(URL は実行時にしか意味がない)。

export const STORE_NAMES = [
  'characters',
  'character_expressions',
  'audio_files',
  'dialogues',
  'scenes',
  'scene_dialogues',
  'illustrations',
  'layers',
  'bgm_tracks',
  'sound_effects',
  'scene_cast',
  'settings',
] as const

export type StoreName = (typeof STORE_NAMES)[number]

export async function getAllRaw(storeName: StoreName): Promise<unknown[]> {
  const db = await getDB()
  // idb の厳密な型付けはストアごとに異なる value を要求するが、
  // 汎用アクセスなので as never で bypass する。
  return db.getAll(storeName as never)
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await getDB()
  await db.clear(storeName as never)
}

export async function putRaw(storeName: StoreName, item: unknown): Promise<void> {
  const db = await getDB()
  await db.put(storeName as never, item as never)
}

// ==================== Counts (for dashboard) ====================

export async function getCounts(): Promise<{
  characters: number
  audio_files: number
  dialogues: number
  scenes: number
  illustrations: number
}> {
  const db = await getDB()
  const [characters, audio_files, dialogues, scenes, illustrations] = await Promise.all([
    db.count('characters'),
    db.count('audio_files'),
    db.count('dialogues'),
    db.count('scenes'),
    db.count('illustrations'),
  ])
  return { characters, audio_files, dialogues, scenes, illustrations }
}
