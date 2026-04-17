// 共通型定義(将来DBを再構築するときにここを拡張する)

export interface Character {
  id: string
  name: string
  description: string | null
  image_url: string | null // blob URL (derived from image_blob at runtime)
  image_blob?: Blob // メイン画像(口閉じ/通常)
  created_at: string
  updated_at: string
}

// キャラ表情(口パク用の口開閉・表情バリエーション)
export type ExpressionKind = 'mouth_closed' | 'mouth_open' | 'expression' | 'blink'

export interface CharacterExpression {
  id: string
  character_id: string
  name: string
  kind: ExpressionKind
  image_url: string // blob URL (derived)
  image_blob?: Blob
  created_at: string
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
  expression_id: string | null // プレビュー時の表情指定
  emotion: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Scene {
  id: string
  title: string | null
  description: string | null
  background_illustration_id: string | null // 背景に使う環境素材
  bgm_track_id: string | null // シーン全体に流す BGM
  bgm_volume: number // 0..1(未指定なら再生側で 0.25 を既定にする)
  order_index: number
  created_at: string
  updated_at: string
}

// シーンに貼り付けるBGM(音声ファイル)
export interface BgmTrack {
  id: string
  name: string
  file_url: string // blob URL (derived)
  file_blob?: Blob // the actual audio data (persisted to IndexedDB)
  duration: number | null
  created_at: string
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
