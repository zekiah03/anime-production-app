// キャラクター ID から決定論的に色を出すためのユーティリティ。
// 同じ ID なら常に同じ色になる。色相は ID のハッシュから計算する。

export function charHue(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0
  }
  return ((h % 360) + 360) % 360
}

export function charColorHsl(id: string, saturation = 65, lightness = 55): string {
  return `hsl(${charHue(id)}, ${saturation}%, ${lightness}%)`
}
