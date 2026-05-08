import { NextRequest, NextResponse } from 'next/server'

// OpenAI Whisper を使って音声 Blob を文字起こしするサーバルート。
// API キーはサーバ側 (process.env.OPENAI_API_KEY) のみで保持。
// 受け取った FormData の "file" フィールドをそのまま Whisper に転送する。

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'OPENAI_API_KEY が未設定です。Vercel Project Settings → Environment Variables に追加して再デプロイしてください(文字起こしには OpenAI Whisper を使います)',
      },
      { status: 500 },
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'multipart/form-data ではありません' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'file フィールドが必要です' }, { status: 400 })
  }

  // 言語指定(任意)。デフォルト ja。
  const lang = (formData.get('language') as string | null) ?? 'ja'

  const upstream = new FormData()
  // OpenAI 側にファイル名拡張子が要るのでフォールバック付きで付与。
  const filename =
    ('name' in file && typeof (file as { name?: unknown }).name === 'string'
      ? (file as { name: string }).name
      : '') || 'audio.webm'
  upstream.append('file', file, filename)
  upstream.append('model', 'whisper-1')
  if (lang) upstream.append('language', lang)
  upstream.append('response_format', 'json')

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    })
    if (!res.ok) {
      const errBody = await res.text()
      console.error('[anime-app] whisper failed', res.status, errBody)
      return NextResponse.json(
        {
          error: `Whisper API エラー (${res.status}): ${errBody.slice(0, 300)}`,
        },
        { status: 502 },
      )
    }
    const data = (await res.json()) as { text?: string }
    return NextResponse.json({ text: data.text ?? '' })
  } catch (e) {
    console.error('[anime-app] transcribe failed', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '不明なエラー' },
      { status: 500 },
    )
  }
}
