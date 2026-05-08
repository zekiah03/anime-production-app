// セリフの感情ラベルに合う表情画像を、名前のマッチで探すヘルパー。
// 例: dialogue.emotion = '怒り' のとき、kind='expression' の中で
// name に '怒' '激' '怒り' を含むものを優先して返す。
//
// expression_id が明示指定されているときはこのヘルパーは使わない側で短絡する。
// 未指定時の "賢いフォールバック" として scene player と video export で使う。

import type { CharacterExpression } from '@/types/db'

// 感情ラベル → 候補となる表情名キーワード(部分一致)
// 同じ表情名を複数感情で再利用できるよう、キーワードはゆるめに広げてある。
const EMOTION_KEYWORDS: Record<string, string[]> = {
  通常: ['通常', '普通', 'デフォルト', 'normal', 'default'],
  喜び: ['喜', '笑', '嬉', 'にこ', 'スマイル', 'smile', 'happy', 'joy'],
  怒り: ['怒', '激', 'キレ', 'angry', 'mad'],
  悲しみ: ['悲', '泣', '涙', '凹', 'sad', 'cry'],
  驚き: ['驚', 'びっくり', '焦', 'surprise', 'shock'],
  恐怖: ['怖', '恐', '震', 'fear', 'scared'],
}

export function pickExpressionByEmotion(
  emotion: string | null | undefined,
  expressions: CharacterExpression[],
): string | null {
  if (!emotion) return null
  const candidates = expressions.filter((e) => e.kind === 'expression')
  if (candidates.length === 0) return null

  const keywords = EMOTION_KEYWORDS[emotion]
  if (!keywords) {
    // 未知の感情ラベルは emotion 文字列そのものを単純含有チェック
    const direct = candidates.find((c) => c.name.includes(emotion))
    return direct?.id ?? null
  }

  for (const kw of keywords) {
    const hit = candidates.find((c) =>
      c.name.toLowerCase().includes(kw.toLowerCase()),
    )
    if (hit) return hit.id
  }
  return null
}
