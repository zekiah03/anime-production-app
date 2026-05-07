import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// API route はサーバ側実行されるため、ANTHROPIC_API_KEY をブラウザに露出させない。
// ユーザーは Vercel の Environment Variables / .env.local に ANTHROPIC_API_KEY を設定する。

const RequestSchema = z.object({
  characterName: z.string(),
  knowledge: z.object({
    basic_setting: z.string(),
    personality: z.string(),
    motivation: z.string().default(''),
    speech_pattern: z.string(),
    backstory: z.string(),
    preferences: z.string(),
    relationships: z.string(),
    sample_dialogues: z.string(),
    notes: z.string(),
  }),
  scenario: z.string().min(1),
  count: z.number().int().min(1).max(10),
})

const EMOTIONS = ['通常', '喜び', '怒り', '悲しみ', '驚き', '恐怖'] as const

const DialogueSchema = z.object({
  dialogues: z.array(
    z.object({
      text: z.string(),
      emotion: z.enum(EMOTIONS),
      notes: z.string(),
    }),
  ),
})

function buildSystemPrompt(name: string, k: z.infer<typeof RequestSchema>['knowledge']): string {
  return `あなたはアニメ・ショート動画(P丸様、ジェル系のテイスト)のセリフライターです。指定されたキャラを「演じる」つもりで、行動原理に裏打ちされた自然なセリフを書いてください。

# キャラクター: ${name}

## 行動原理(最重要・このキャラの「なぜ」)
${k.motivation || '(未設定)'}

## 性格(表面と内面のギャップを意識)
${k.personality || '(未設定)'}

## 口調・一人称(発話の質感を支配)
${k.speech_pattern || '(未設定)'}

## サンプルセリフ(口調の絶対参考)
${k.sample_dialogues || '(未設定)'}

## 基本設定
${k.basic_setting || '(未設定)'}

## 背景・経歴(現在の振る舞いの伏線)
${k.backstory || '(未設定)'}

## 好き嫌い
${k.preferences || '(未設定)'}

## 関係性
${k.relationships || '(未設定)'}

## メモ
${k.notes || '(未設定)'}

# 生成原則(順守度: 上から強い)
1. **行動原理との整合性**: セリフはキャラの根本動機・恐れ・欲求から自然に湧いて出るものにする。設定に反する都合の良い発言や、行動原理を無視した「いい話」をでっちあげない。
2. **口調の厳守**: サンプルセリフの一人称・語尾・口癖を完全に踏襲する。違和感のある言い回しは禁止。
3. **性格のギャップ**: 表面の印象と内面のホンネを織り込む(例: 強がりだけどたまに弱音、明るいけど一瞬翳る等)。
4. **背景の影**: 過去の経験から来る反射的な反応・トラウマへの触れ方など、ナレッジの伏線を活かす。
5. **関係性**: シナリオに他キャラが出てくる場合、関係性に応じた距離感(タメ口/敬語/呼び方/感情温度)を維持する。

# 生成ルール
- 1セリフは短く(20〜50文字目安、最長でも80文字)
- アニメ的・コミカルな表現はOK
- 各セリフに感情ラベル(通常/喜び/怒り/悲しみ/驚き/恐怖 のいずれか)を付ける
- メモ欄(notes)には**「行動原理から見たこのセリフの動機」を1行**で書く(例: 「強がりで本心を隠す」「妹を守りたい欲求の表れ」「孤独への恐れの裏返し」)。なければ空文字。
- 連続するセリフは自然な流れになるよう構成する(会話、モノローグ、心情の起伏など)`
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

  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.parse({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(DialogueSchema) },
      system: buildSystemPrompt(parsed.data.characterName, parsed.data.knowledge),
      messages: [
        {
          role: 'user',
          content: `次のシナリオで、${parsed.data.characterName} のセリフを ${parsed.data.count} 個生成してください。

シナリオ:
${parsed.data.scenario}

セリフは順番に流れるように、自然な会話・モノローグになるようにしてください。`,
        },
      ],
    })

    const result = response.parsed_output
    if (!result) {
      return NextResponse.json({ error: '応答の解析に失敗しました' }, { status: 500 })
    }
    return NextResponse.json(result)
  } catch (e) {
    console.error('[anime-app] Claude API failed', e)
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'レート制限に達しました。少し待ってから再試行してください' },
        { status: 429 },
      )
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: 'API キーが無効です。ANTHROPIC_API_KEY を確認してください' },
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
