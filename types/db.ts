// 共通型定義(将来DBを再構築するときにここを拡張する)

export interface Character {
  id: string
  name: string
  description: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface AudioFile {
  id: string
  name: string
  file_url: string // blob URL (derived from file_blob at runtime)
  file_blob?: Blob // the actual audio data (persisted to IndexedDB)
  duration: number | null
  character_id: string | null
  created_at: string
}

export interface Dialogue {
  id: string
  text: string
  character_id: string | null
  audio_id: string | null
  emotion: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Scene {
  id: string
  title: string | null
  description: string | null
  order_index: number
  created_at: string
  updated_at: string
}

export interface SceneDialogue {
  id: string
  scene_id: string
  dialogue_id: string
  order_index: number
  created_at: string
}

export interface SceneWithDialogues extends Scene {
  dialogues: Array<
    SceneDialogue & {
      dialogue: Dialogue | null
    }
  >
}

// イラスト(複数レイヤーを持つ1枚の絵)
export interface Illustration {
  id: string
  name: string
  created_at: string
  updated_at: string
}

// レイヤー(1枚の画像・透明度・表示/非表示・重ね順)
export interface Layer {
  id: string
  illustration_id: string
  name: string
  image_url: string // blob URL (derived from image_blob at runtime)
  image_blob?: Blob // the actual image data (persisted to IndexedDB)
  visible: boolean
  opacity: number // 0..1
  order_index: number // 大きいほど上に表示される
  created_at: string
}

export interface IllustrationWithLayers extends Illustration {
  layers: Layer[]
}
