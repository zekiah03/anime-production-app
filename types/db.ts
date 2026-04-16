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
  file_url: string
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
