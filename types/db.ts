// 共通型定義(将来DBを再構築するときにここを拡張する)

// ==================== テロップ(字幕)スタイル ====================
// 全シーン共通の見た目設定。singleton として settings ストアに保存する。

export type TelopFont = 'gothic' | 'mincho' | 'rounded'
export type TelopPosition = 'top' | 'center' | 'bottom'
export type TelopIntro = 'none' | 'pop' | 'typewriter' | 'fade'
export type TelopShake = 'none' | 'subtle' | 'heavy'

export interface TelopStyle {
  font: TelopFont
  size: number // px
  color: string // '#ffffff'
  stroke_color: string // '#000000'
  stroke_width: number // px (0..12)
  band_color: string // '#000000'
  band_opacity: number // 0..1
  position: TelopPosition
  bold: boolean
  intro: TelopIntro
  shake: TelopShake
  typewriter_cps: number // chars per second for typewriter intro
}

export const DEFAULT_TELOP_STYLE: TelopStyle = {
  font: 'gothic',
  size: 44,
  color: '#ffffff',
  stroke_color: '#000000',
  stroke_width: 6,
  band_color: '#000000',
  band_opacity: 0.72,
  position: 'bottom',
  bold: true,
  intro: 'none',
  shake: 'none',
  typewriter_cps: 30,
}

export const TELOP_FONT_FAMILY: Record<TelopFont, string> = {
  gothic: '"Hiragino Kaku Gothic ProN", "Yu Gothic", "MS Gothic", sans-serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", serif',
  rounded: '"Kosugi Maru", "Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", sans-serif',
}


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
  // ナレーション(character_id=null)かつ audio なしのときの表示時間 ms。未指定なら 3000。
  duration_ms?: number | null
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
  // 所属する動画(未指定なら「未分類」扱い)
  video_id?: string | null
  order_index: number
  created_at: string
  updated_at: string
}

// シーンの入れ物。複数本の動画をこのアプリ1つで作り分けるために使う。
export interface Video {
  id: string
  name: string
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
  // 各セリフの冒頭で鳴らす効果音(SE)。未指定ならなし
  se_id: string | null
  se_volume: number // 0..1(未指定なら 1.0 を既定にする)
  // キャラクターの立ち位置(0..1, 0.5=中央) と スケール(1.0=縦いっぱい)
  character_x: number
  character_scale: number
  // キャラクターの左右反転(斜め前を向いている立ち絵を逆向きにする)
  character_flipped?: boolean
  // このセリフを終えてから次に進むまでの追加無音時間 ms(間合い)
  pause_after_ms?: number
  created_at: string
}

// 効果音(ピコッ/ドンッ等の短い oneshot クリップ)
export interface SoundEffect {
  id: string
  name: string
  file_url: string // blob URL (derived)
  file_blob?: Blob
  duration: number | null
  created_at: string
}

export interface SceneWithDialogues extends Scene {
  dialogues: Array<
    SceneDialogue & {
      dialogue: Dialogue | null
    }
  >
}

// キャスト配置のプリセット(シーンの 登場キャラ 構成を保存・呼び出し)
export interface CastPresetMember {
  character_id: string
  x: number
  scale: number
  idle_expression_id: string | null
  order_index: number
  flipped?: boolean
}

export interface CastPreset {
  id: string
  name: string
  members: CastPresetMember[]
  created_at: string
  updated_at: string
}

// シーンの「登場キャラ」。 speaker 以外は無音で立ち、speaker はリップシンクする。
export interface SceneCastMember {
  id: string
  scene_id: string
  character_id: string
  x: number // 0..1, 0.5=中央
  scale: number // 1.0=縦いっぱい
  // 喋ってないときに表示する表情 id。未指定なら mouth_closed → メイン画像 の順でフォールバック
  idle_expression_id: string | null
  // 描画順(小さいほど奥)
  order_index: number
  // 左右反転(斜め前向きの立ち絵を逆向きにする)
  flipped?: boolean
  created_at: string
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
