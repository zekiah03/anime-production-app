// AI API 呼び出しの統一ラッパ。
// OpenAI / Anthropic(Claude)/ Google(Gemini)の 3 プロバイダをサポート。
// 全てクライアントから直接叩く(このアプリはローカル専用なので API キーはユーザー自身が管理)。
//
// 注意: ブラウザから API キーを叩く以上、そのプロバイダへはリクエストが送信される。
// 「アプリ自体はローカル完結」だが AI 呼び出しは例外。UI でその点を明示している。

import type { AiProvider, AiSettings } from '@/types/db'

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiCompletionRequest {
  messages: AiMessage[]
  // 個別呼び出しで model 等を上書きしたい場合
  modelOverride?: string
  // Anthropic の API 仕様上 max_tokens が必須のため、デフォルトで大きめの値
  // (実質無制限に近い)を送る。ユーザーが極端に長い応答を抑えたい特殊ケース用。
  maxTokensOverride?: number
  temperatureOverride?: number
}

// Anthropic は max_tokens 必須。ユーザー側では設定しなくて良いよう、デフォルトを大きく取る。
const DEFAULT_MAX_TOKENS = 8192

export interface AiCompletionResponse {
  text: string
  // 将来の拡張用: 消費トークン数など
  usage?: {
    inputTokens?: number
    outputTokens?: number
  }
}

export class AiError extends Error {
  constructor(
    message: string,
    public readonly provider: AiProvider,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'AiError'
  }
}

// プロバイダごとのおすすめモデル一覧(ドロップダウンに表示する用)
export const MODEL_CATALOG: Record<AiProvider, { id: string; label: string }[]> = {
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o mini(高速・安価)' },
    { id: 'gpt-4o', label: 'GPT-4o(標準)' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
    { id: 'o4-mini', label: 'o4-mini(推論)' },
  ],
  anthropic: [
    { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku(高速)' },
    { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet(標準)' },
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5(最新)' },
    { id: 'claude-opus-4-1', label: 'Claude Opus 4.1(高品質)' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash(高速)' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ],
}

export function providerLabel(p: AiProvider): string {
  if (p === 'openai') return 'OpenAI'
  if (p === 'anthropic') return 'Anthropic (Claude)'
  return 'Google (Gemini)'
}

export async function runAi(
  settings: AiSettings,
  req: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  const key = settings.apiKeys[settings.provider]
  if (!key) {
    throw new AiError(
      `${providerLabel(settings.provider)} の API キーが設定されていません`,
      settings.provider,
    )
  }
  const model = req.modelOverride ?? settings.model
  // ユーザーが明示的に絞らない限り、トークン上限は実質無効化(大きめの定数を送る)。
  // OpenAI / Gemini はそもそも max_tokens 省略可能だが、Anthropic は必須なので常に渡す。
  const maxTokens = req.maxTokensOverride ?? DEFAULT_MAX_TOKENS
  const temperature = req.temperatureOverride ?? settings.temperature ?? 0.7

  if (settings.provider === 'openai') {
    return callOpenAi(key, model, req.messages, maxTokens, temperature)
  }
  if (settings.provider === 'anthropic') {
    return callAnthropic(key, model, req.messages, maxTokens, temperature)
  }
  return callGemini(key, model, req.messages, maxTokens, temperature)
}

async function callOpenAi(
  key: string,
  model: string,
  messages: AiMessage[],
  maxTokens: number,
  temperature: number,
): Promise<AiCompletionResponse> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  })
  if (!resp.ok) {
    const body = await safeBody(resp)
    throw new AiError(
      `OpenAI エラー: ${resp.status} ${body}`,
      'openai',
      resp.status,
    )
  }
  const data = await resp.json()
  const text = data?.choices?.[0]?.message?.content ?? ''
  return {
    text,
    usage: {
      inputTokens: data?.usage?.prompt_tokens,
      outputTokens: data?.usage?.completion_tokens,
    },
  }
}

async function callAnthropic(
  key: string,
  model: string,
  messages: AiMessage[],
  maxTokens: number,
  temperature: number,
): Promise<AiCompletionResponse> {
  // Anthropic は system を別フィールド。user/assistant 連続のみ
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const turns = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // ブラウザから直接叩く事を明示(CORS 許可)
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      system,
      messages: turns,
      max_tokens: maxTokens,
      temperature,
    }),
  })
  if (!resp.ok) {
    const body = await safeBody(resp)
    throw new AiError(
      `Anthropic エラー: ${resp.status} ${body}`,
      'anthropic',
      resp.status,
    )
  }
  const data = await resp.json()
  const text = Array.isArray(data?.content)
    ? data.content.map((b: { type?: string; text?: string }) => (b.type === 'text' ? b.text : '')).join('')
    : ''
  return {
    text,
    usage: {
      inputTokens: data?.usage?.input_tokens,
      outputTokens: data?.usage?.output_tokens,
    },
  }
}

async function callGemini(
  key: string,
  model: string,
  messages: AiMessage[],
  maxTokens: number,
  temperature: number,
): Promise<AiCompletionResponse> {
  // Gemini は contents に history、systemInstruction に system
  const systemText = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
    },
  }
  if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] }
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const ret = await safeBody(resp)
    throw new AiError(`Gemini エラー: ${resp.status} ${ret}`, 'gemini', resp.status)
  }
  const data = await resp.json()
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const text = parts.map((p: { text?: string }) => p.text ?? '').join('')
  return {
    text,
    usage: {
      inputTokens: data?.usageMetadata?.promptTokenCount,
      outputTokens: data?.usageMetadata?.candidatesTokenCount,
    },
  }
}

async function safeBody(resp: Response): Promise<string> {
  try {
    const t = await resp.text()
    // 400 以上のエラー本文は長すぎることがあるので切り詰め
    return t.length > 500 ? t.slice(0, 500) + '…' : t
  } catch {
    return '(レスポンス本文を読めませんでした)'
  }
}

// 接続テスト: 超短いプロンプトを送って、API キーと鯖の疎通確認
export async function testAiConnection(settings: AiSettings): Promise<string> {
  const res = await runAi(settings, {
    messages: [
      { role: 'system', content: 'Reply with a single short greeting in Japanese.' },
      { role: 'user', content: 'Hello' },
    ],
    maxTokensOverride: 64,
  })
  return res.text.trim()
}
