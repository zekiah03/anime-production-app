// シーンカラータグのカラーパレット。Tailwind の色名 + HSL を両方返して UI 側で使いやすくする。

import type { SceneColorTag } from '@/types/db'

export const SCENE_COLORS: Array<{
  tag: SceneColorTag
  label: string
  hsl: string
  bg: string // カードに薄く乗せる用
}> = [
  { tag: 'red', label: '赤', hsl: 'hsl(0, 72%, 55%)', bg: 'hsl(0, 72%, 55%, 0.12)' },
  { tag: 'orange', label: '橙', hsl: 'hsl(25, 85%, 55%)', bg: 'hsl(25, 85%, 55%, 0.12)' },
  { tag: 'yellow', label: '黄', hsl: 'hsl(48, 90%, 55%)', bg: 'hsl(48, 90%, 55%, 0.12)' },
  { tag: 'green', label: '緑', hsl: 'hsl(140, 55%, 45%)', bg: 'hsl(140, 55%, 45%, 0.12)' },
  { tag: 'blue', label: '青', hsl: 'hsl(210, 75%, 55%)', bg: 'hsl(210, 75%, 55%, 0.12)' },
  { tag: 'purple', label: '紫', hsl: 'hsl(275, 60%, 60%)', bg: 'hsl(275, 60%, 60%, 0.12)' },
  { tag: 'gray', label: '灰', hsl: 'hsl(220, 8%, 55%)', bg: 'hsl(220, 8%, 55%, 0.12)' },
]

export function sceneColorFor(tag: SceneColorTag | null | undefined) {
  if (!tag) return null
  return SCENE_COLORS.find((c) => c.tag === tag) ?? null
}
