import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// 複数キャラの掛け合い(ジェル系/コラボ動画スタイル)を一括生成するエンドポイント。
// /api/generate-dialogue は単独キャラ用。こちらは speaker を切り替えながら会話を作る。

const KnowledgeSchema = z.object({
  basic_setting: z.string().default(''),
  personality: z.string().default(''),
  motivation: z.string().default(''),
  speech_pattern: z.string().default(''),
  backstory: z.string().default(''),
  preferences: z.string().default(''),
  relationships: z.string().default(''),
  sample_dialogues: z.string().default(''),
  notes: z.string().default(''),
})

const RequestSchema = z.object({
  characters: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        knowledge: KnowledgeSchema,
      }),
    )
    .min(2)
    .max(5),
  scenario: z.string().min(1),
  // 何ターン分の発話を作るか
  count: z.number().int().min(2).max(20),
})

const EMOTIONS = ['通常', '喜び', '怒り', '悲しみ', '驚き', '恐怖'] as const
const MOTIONS = [
  'none',
  'shake',
  'jump',
  'pop_in',
  'slide_in_left',
  'slide_in_right',
  'fade_in',
  'zoom_in',
] as const
const EFFECTS = [
  'none',
  'anger',
  'sweat',
  'sparkle',
  'heart',
  'shock',
  'question',
  'shock_lines',
  'speed_lines',
] as const

const ConversationSchema = z.object({
  lines: z.array(
    z.object({
      character_id: z.string(),
      text: z.string(),
      emotion: z.enum(EMOTIONS),
      // セリフ冒頭で発火する動き(必要に応じて)
      motion: z.enum(MOTIONS),
      // セリフ中の画面エフェクト
      effect: z.enum(EFFECTS),
      notes: z.string(),
    }),
  ),
})

function buildSystemPrompt(
  chars: z.infer<typeof RequestSchema>['characters'],
): string {
  const profiles = chars
    .map(
      (c) => `## ${c.name} (id=${c.id})

### 行動原理(最重要)
${c.knowledge.motivation || '(未設定)'}

### 性格
${c.knowledge.personality || '(未設定)'}

### 口調・一人称
${c.knowledge.speech_pattern || '(未設定)'}

### 関係性
${c.knowledge.relationships || '(未設定)'}

### サンプルセリフ
${c.knowledge.sample_dialogues || '(未設定)'}

### 基本設定
${c.knowledge.basic_setting || '(未設定)'}

### 背景
${c.knowledge.backstory || '(未設定)'}
`,
    )
    .join('\n')

  return `あなたはアニメ・ショート動画(ジェル様、P丸様、コラボ動画系のテイスト)の脚本家です。指定された複数キャラの掛け合いを、各キャラの行動原理と口調を厳守して書いてください。

# 登場キャラ

${profiles}

# 会話作成原則
1. **各キャラの行動原理から自然に発話が生まれる**ように書く。性格に反する都合の良い発言は禁止。
2. **口調・一人称・語尾を厳守**。サンプルセリフの質感を再現。
3. **関係性に基づいた距離感**(タメ口/敬語、呼び方、感情温度)を保つ。
4. **対立・ボケツッコミ・共感** など起伏を入れて掛け合いとして成立させる。
5. テンポ重視: 1セリフは短く(20〜50文字目安、最長 80字)。

# 出力ルール
- 各行に character_id(必ず上記のいずれか) / text / emotion / motion / effect / notes を付ける
- motion: 動きを付けるか none。震え=shake、ジャンプ=jump、登場=pop_in/slide_in_*/fade_in/zoom_in
- effect: 画面エフェクト or none。怒り=anger、汗=sweat、キラキラ=sparkle、ハート=heart、驚き=shock、疑問=question、強調=shock_lines、勢い=speed_lines
- notes: 「行動原理から見たこの発話の動機」を1行で(なければ空文字)
- character_id は **必ず提示された ID 文字列のいずれか**。新しい ID を作らない`
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'ANTHROPIC_API_KEY が未設定です。Vercel Project Settings → Environment Variables に追加するか、ローカルの .env.local に書いてください',
      },
      { status: 500 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストの JSON が不正です' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '入力が不正です', detail: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const validIds = new Set(parsed.data.characters.map((c) => c.id))
  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.parse({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(ConversationSchema) },
      system: buildSystemPrompt(parsed.data.characters),
      messages: [
        {
          role: 'user',
          content: `次のシナリオで、登場キャラの掛け合いを ${parsed.data.count} 行生成してください。

シナリオ:
${parsed.data.scenario}

${parsed.data.count} 行で、自然なテンポで会話を成立させてください。`,
        },
      ],
    })

    const result = response.parsed_output
    if (!result) {
      return NextResponse.json({ error: '応答の解析に失敗しました' }, { status: 500 })
    }

    // hallucination 防止: 提示外の id を捨てる(全捨ての場合のみエラー)
    const cleaned = {
      lines: result.lines.filter((l) => validIds.has(l.character_id)),
    }
    if (cleaned.lines.length === 0) {
      return NextResponse.json(
        { error: '生成結果が指定キャラに紐付きませんでした。再試行してください' },
        { status: 502 },
      )
    }
    return NextResponse.json(cleaned)
  } catch (e) {
    console.error('[anime-app] conversation API failed', e)
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'レート制限。少し待って再試行してください' },
        { status: 429 },
      )
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: 'API キーが無効です' },
        { status: 401 },
      )
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API エラー (${e.status}): ${e.message}` },
        { status: 502 },
      )
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '不明なエラー' },
      { status: 500 },
    )
  }
}
