// クリップボードから画像を貼り付けるためのヘルパー。
// - paste イベント: element.addEventListener('paste', ...) に渡して使う
// - navigator.clipboard.read(): 明示ボタン用(対応ブラウザでのみ動く)
//
// 返り値は File オブジェクト or null。あとは通常のファイル入力と同じフローに渡せる。

export function extractImageFromPasteEvent(e: ClipboardEvent): File | null {
  const items = e.clipboardData?.items
  if (!items) return null
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (it.kind !== 'file') continue
    if (!it.type.startsWith('image/')) continue
    const file = it.getAsFile()
    if (!file) continue
    // 貼り付け画像に拡張子を補う(image/png → pasted.png)
    const ext = it.type.split('/')[1] || 'png'
    const named = new File([file], `pasted.${ext}`, { type: it.type })
    return named
  }
  return null
}

// navigator.clipboard.read() から画像を取得する(ボタン用)。
// 対応していないブラウザ(古い Safari 等)では null を返す。
export async function readImageFromClipboard(): Promise<File | null> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.read) return null
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      for (const type of item.types) {
        if (!type.startsWith('image/')) continue
        const blob = await item.getType(type)
        const ext = type.split('/')[1] || 'png'
        return new File([blob], `pasted.${ext}`, { type })
      }
    }
  } catch (e) {
    console.warn('[clipboard] read failed', e)
  }
  return null
}
