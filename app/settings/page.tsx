'use client'

// 設定ページ。主に AI 接続設定とプロジェクトのエクスポート/インポートを扱う。
// API キーは IndexedDB に保存され、この端末の外には出ない(AI 呼び出し時にプロバイダへは送られる)。

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sidebar } from '@/components/sidebar'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Upload,
} from 'lucide-react'
import type { AiProvider, AiSettings } from '@/types/db'
import { DEFAULT_AI_SETTINGS } from '@/types/db'
import { getAiSettings, saveAiSettings } from '@/lib/db'
import { MODEL_CATALOG, providerLabel, testAiConnection } from '@/lib/ai'
import {
  exportProject,
  importProject,
} from '@/lib/project-export-import'
import { useToast } from '@/components/toast'

export default function SettingsPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<
    { ok: true; text: string } | { ok: false; text: string } | null
  >(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)

  useEffect(() => {
    getAiSettings()
      .then(setSettings)
      .catch((e) => {
        console.error('[settings] load failed', e)
      })
      .finally(() => setLoading(false))
  }, [])

  async function persist(next: AiSettings) {
    setSettings(next)
    try {
      await saveAiSettings(next)
    } catch (e) {
      console.error('[settings] save failed', e)
      toast.error('設定の保存に失敗しました')
    }
  }

  function setProvider(p: AiProvider) {
    // provider 切替時に、そのプロバイダの推奨モデルをデフォルトにする(既に有効なモデルなら保持)
    const catalog = MODEL_CATALOG[p]
    const currentInCatalog = catalog.some((m) => m.id === settings.model)
    const nextModel = currentInCatalog ? settings.model : catalog[0].id
    persist({ ...settings, provider: p, model: nextModel })
  }

  function setApiKey(k: string) {
    persist({
      ...settings,
      apiKeys: { ...settings.apiKeys, [settings.provider]: k },
    })
  }

  async function handleTestConnection() {
    setTestResult(null)
    setTesting(true)
    try {
      const text = await testAiConnection(settings)
      setTestResult({ ok: true, text })
      toast.success('AI 接続に成功しました')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setTestResult({ ok: false, text: msg })
      toast.error('AI 接続に失敗しました')
    } finally {
      setTesting(false)
    }
  }

  async function handleExport() {
    setExportBusy(true)
    try {
      const blob = await exportProject()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      a.download = `anime-project-${ts}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 0)
      toast.success('プロジェクトを zip に書き出しました')
    } catch (e) {
      console.error(e)
      toast.error('エクスポートに失敗しました')
    } finally {
      setExportBusy(false)
    }
  }

  async function handleImport(file: File) {
    if (
      !window.confirm(
        `「${file.name}」を読み込むと、現在のプロジェクトは完全に置き換えられます。続けますか?`,
      )
    )
      return
    setImportBusy(true)
    try {
      await importProject(file)
      toast.success('プロジェクトを読み込みました。ページを再読み込みします')
      setTimeout(() => window.location.reload(), 800)
    } catch (e) {
      console.error(e)
      toast.error('インポートに失敗しました')
    } finally {
      setImportBusy(false)
    }
  }

  const apiKey = settings.apiKeys[settings.provider] ?? ''
  const catalog = MODEL_CATALOG[settings.provider]

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-3xl space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-foreground">設定</h2>
            <p className="text-muted-foreground mt-1">
              AI 連携・プロジェクトのバックアップ等を管理します
            </p>
          </div>

          {/* AI 連携 */}
          <Card className="bg-card border-border p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-foreground">AI 連携</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  セリフ生成・タイトル提案などに使います。API キーは
                  この端末の IndexedDB にのみ保存されます。
                  <br />
                  AI 呼び出し時は、選択したプロバイダへリクエストが送信されます。
                </p>
              </div>
              <label className="inline-flex items-center gap-2 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => persist({ ...settings, enabled: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-foreground">AI 機能を有効にする</span>
              </label>
            </div>

            {/* プロバイダ選択 */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground">
                プロバイダ
              </label>
              <div className="flex gap-2 flex-wrap">
                {(['openai', 'anthropic', 'gemini'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    className={`px-3 py-2 text-sm rounded border transition ${
                      settings.provider === p
                        ? 'bg-primary/20 border-primary/40 text-primary font-medium'
                        : 'bg-background border-input text-foreground hover:bg-primary/10'
                    }`}
                  >
                    {providerLabel(p)}
                  </button>
                ))}
              </div>
            </div>

            {/* API キー */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground">
                {providerLabel(settings.provider)} API キー
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      settings.provider === 'openai'
                        ? 'sk-...'
                        : settings.provider === 'anthropic'
                          ? 'sk-ant-...'
                          : 'AIza...'
                    }
                    className="bg-background border-input pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    title={showKey ? '隠す' : '表示'}
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={!apiKey || testing}
                  className="gap-2 flex-shrink-0"
                >
                  {testing ? <Loader2 size={14} className="animate-spin" /> : null}
                  接続テスト
                </Button>
              </div>
              {testResult && (
                <div
                  className={`flex items-start gap-2 text-xs p-2 rounded border ${
                    testResult.ok
                      ? 'bg-green-500/10 border-green-500/30 text-green-600'
                      : 'bg-destructive/10 border-destructive/30 text-destructive'
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  )}
                  <span className="whitespace-pre-wrap break-words">
                    {testResult.text}
                  </span>
                </div>
              )}
            </div>

            {/* モデル */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground">モデル</label>
              <select
                value={settings.model}
                onChange={(e) => persist({ ...settings, model: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {catalog.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}({m.id})
                  </option>
                ))}
                {/* カタログ外のモデルも許容。現状の選択が catalog に無い場合だけ表示 */}
                {!catalog.some((m) => m.id === settings.model) && settings.model && (
                  <option value={settings.model}>{settings.model}(カスタム)</option>
                )}
              </select>
              <Input
                type="text"
                value={settings.model}
                onChange={(e) => persist({ ...settings, model: e.target.value })}
                placeholder="カスタムモデル ID"
                className="bg-background border-input text-xs font-mono h-8"
              />
            </div>

            {/* 詳細設定 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  温度(創造性 0〜2)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={settings.temperature ?? 0.7}
                  onChange={(e) =>
                    persist({ ...settings, temperature: Number(e.target.value) })
                  }
                  className="bg-background border-input h-9"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  最大トークン
                </label>
                <Input
                  type="number"
                  min={1}
                  max={8192}
                  step={1}
                  value={settings.maxTokens ?? 1024}
                  onChange={(e) =>
                    persist({ ...settings, maxTokens: Number(e.target.value) })
                  }
                  className="bg-background border-input h-9"
                />
              </div>
            </div>

            {loading && (
              <p className="text-xs text-muted-foreground">設定を読み込み中...</p>
            )}
          </Card>

          {/* プロジェクト バックアップ / 復元 */}
          <Card className="bg-card border-border p-6 space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-foreground">
                プロジェクトのバックアップ・復元
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                全てのキャラ・音声・セリフ・シーン・背景・BGM・SE を zip 1 ファイルで保存できます。
                USB メモリや外付け SSD で別端末に運ぶのに使えます。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleExport} disabled={exportBusy} className="gap-2">
                {exportBusy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                zip でエクスポート
              </Button>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-foreground hover:bg-primary/10 transition cursor-pointer">
                {importBusy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                zip からインポート(上書き)
                <input
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  disabled={importBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleImport(f)
                    if (e.target) e.target.value = ''
                  }}
                />
              </label>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
