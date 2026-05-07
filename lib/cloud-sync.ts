'use client'

import { supabase, STORAGE_BUCKET } from './supabase'
import {
  getAllAudioFiles,
  getAllCharacters,
  getAllDialogues,
  getAllExpressions,
  getAllIllustrations,
  getAllSceneDialogues,
  getAllScenes,
  getLayersByIllustration,
  saveAudioFile,
  saveCharacter,
  saveDialogue,
  saveExpression,
  saveIllustration,
  saveLayer,
  saveScene,
  saveSceneDialogue,
} from './db'
import type {
  AudioFile,
  Character,
  CharacterExpression,
  Dialogue,
  Illustration,
  Layer,
  Scene,
  SceneDialogue,
} from '@/types/db'

// クラウドに保存する形式。実行時にしか作れない blob URL は除外して、
// Storage に上げた public URL だけを残す。
interface ProjectSnapshot {
  version: 1
  characters: Character[]
  expressions: CharacterExpression[]
  audioFiles: AudioFile[]
  dialogues: Dialogue[]
  scenes: Scene[]
  sceneDialogues: SceneDialogue[]
  illustrations: Illustration[]
  layers: Layer[]
}

export interface CloudProject {
  id: number
  name: string
  updated_at: string
}

async function uploadBlob(blob: Blob, path: string, contentType?: string): Promise<string> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, blob, { upsert: true, contentType })
  if (error) throw new Error(`Storage upload failed (${path}): ${error.message}`)
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

async function downloadBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`)
  return res.blob()
}

// ==================== Save ====================

async function buildSnapshot(): Promise<ProjectSnapshot> {
  const [characters, expressions, audioFiles, dialogues, scenes, sceneDialogues, illustrations] =
    await Promise.all([
      getAllCharacters(),
      getAllExpressions(),
      getAllAudioFiles(),
      getAllDialogues(),
      getAllScenes(),
      getAllSceneDialogues(),
      getAllIllustrations(),
    ])

  const layers: Layer[] = (
    await Promise.all(illustrations.map((i) => getLayersByIllustration(i.id)))
  ).flat()

  // Storage に上げて public URL に書き換える(upsert なので ID が同じなら上書き)
  const charactersOut: Character[] = []
  for (const c of characters) {
    let url: string | null = c.image_url
    if (c.image_blob) {
      url = await uploadBlob(c.image_blob, `characters/${c.id}.bin`, c.image_blob.type)
    }
    charactersOut.push({
      id: c.id,
      name: c.name,
      description: c.description,
      image_url: url,
      knowledge: c.knowledge ?? null,
      created_at: c.created_at,
      updated_at: c.updated_at,
    })
  }

  const expressionsOut: CharacterExpression[] = []
  for (const e of expressions) {
    let url = e.image_url
    if (e.image_blob) {
      url = await uploadBlob(e.image_blob, `expressions/${e.id}.bin`, e.image_blob.type)
    }
    expressionsOut.push({
      id: e.id,
      character_id: e.character_id,
      name: e.name,
      kind: e.kind,
      image_url: url,
      created_at: e.created_at,
    })
  }

  const audioOut: AudioFile[] = []
  for (const a of audioFiles) {
    let url = a.file_url
    if (a.file_blob) {
      url = await uploadBlob(a.file_blob, `audio/${a.id}.bin`, a.file_blob.type)
    }
    audioOut.push({
      id: a.id,
      name: a.name,
      file_url: url,
      duration: a.duration,
      character_id: a.character_id,
      created_at: a.created_at,
    })
  }

  const layersOut: Layer[] = []
  for (const l of layers) {
    let url = l.image_url
    if (l.image_blob) {
      url = await uploadBlob(l.image_blob, `layers/${l.id}.bin`, l.image_blob.type)
    }
    layersOut.push({
      id: l.id,
      illustration_id: l.illustration_id,
      name: l.name,
      image_url: url,
      visible: l.visible,
      opacity: l.opacity,
      order_index: l.order_index,
      created_at: l.created_at,
    })
  }

  return {
    version: 1,
    characters: charactersOut,
    expressions: expressionsOut,
    audioFiles: audioOut,
    dialogues,
    scenes,
    sceneDialogues,
    illustrations,
    layers: layersOut,
  }
}

export async function saveProjectToCloud(name: string): Promise<CloudProject> {
  const snapshot = await buildSnapshot()
  const { data, error } = await supabase
    .from('anime')
    .insert({ name, data: snapshot, updated_at: new Date().toISOString() })
    .select('id, name, updated_at')
    .single()
  if (error) throw new Error(`anime insert failed: ${error.message}`)
  return data as CloudProject
}

// 既存の anime 行を更新する。自動同期で使う。
export async function updateProjectInCloud(id: number): Promise<CloudProject> {
  const snapshot = await buildSnapshot()
  const { data, error } = await supabase
    .from('anime')
    .update({ data: snapshot, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name, updated_at')
    .single()
  if (error) throw new Error(`anime update failed: ${error.message}`)
  return data as CloudProject
}

// ==================== List ====================

export async function listCloudProjects(): Promise<CloudProject[]> {
  const { data, error } = await supabase
    .from('anime')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(`anime list failed: ${error.message}`)
  return (data ?? []) as CloudProject[]
}

// ==================== Load ====================

export async function loadProjectFromCloud(id: number): Promise<void> {
  const { data, error } = await supabase.from('anime').select('data').eq('id', id).single()
  if (error) throw new Error(`anime fetch failed: ${error.message}`)
  const snapshot = data?.data as ProjectSnapshot | undefined
  if (!snapshot || snapshot.version !== 1) throw new Error('プロジェクトデータが不正です')

  // Blob を順次ダウンロードして IndexedDB に書き込む
  for (const c of snapshot.characters) {
    let blob: Blob | undefined
    if (c.image_url) {
      try {
        blob = await downloadBlob(c.image_url)
      } catch (e) {
        console.warn('[anime-app] character image download failed', c.id, e)
      }
    }
    await saveCharacter({ ...c, image_blob: blob })
  }
  for (const e of snapshot.expressions) {
    let blob: Blob | undefined
    if (e.image_url) {
      try {
        blob = await downloadBlob(e.image_url)
      } catch (err) {
        console.warn('[anime-app] expression image download failed', e.id, err)
      }
    }
    if (blob) {
      await saveExpression({ ...e, image_blob: blob })
    }
  }
  for (const a of snapshot.audioFiles) {
    let blob: Blob | undefined
    if (a.file_url) {
      try {
        blob = await downloadBlob(a.file_url)
      } catch (err) {
        console.warn('[anime-app] audio download failed', a.id, err)
      }
    }
    if (blob) {
      await saveAudioFile({ ...a, file_blob: blob })
    }
  }
  for (const d of snapshot.dialogues) {
    await saveDialogue(d)
  }
  for (const s of snapshot.scenes) {
    await saveScene(s)
  }
  for (const sd of snapshot.sceneDialogues) {
    await saveSceneDialogue(sd)
  }
  for (const i of snapshot.illustrations) {
    await saveIllustration(i as Illustration)
  }
  for (const l of snapshot.layers) {
    let blob: Blob | undefined
    if (l.image_url) {
      try {
        blob = await downloadBlob(l.image_url)
      } catch (err) {
        console.warn('[anime-app] layer image download failed', l.id, err)
      }
    }
    if (blob) {
      await saveLayer({ ...l, image_blob: blob })
    }
  }
}

// ==================== Delete ====================

export async function deleteCloudProject(id: number): Promise<void> {
  // ストレージファイルの掃除はとりあえず保留(個人利用で枯渇しにくいため)。
  const { error } = await supabase.from('anime').delete().eq('id', id)
  if (error) throw new Error(`anime delete failed: ${error.message}`)
}
