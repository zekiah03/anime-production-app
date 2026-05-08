'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Film, Mountain, Cloud, CloudOff, CloudCheck, Loader2, AlertCircle } from 'lucide-react'
import { useAutoSync } from '@/components/auto-sync-provider'

const NAV = [
  { href: '/', label: 'ダッシュボード', icon: Film },
  { href: '/characters', label: 'キャラクター', icon: Users },
  { href: '/environment', label: '環境', icon: Mountain },
  { href: '/storyboard', label: 'ストーリーボード', icon: Film },
] as const

function SyncBadge() {
  const { current, status, lastSavedAt, errorMessage } = useAutoSync()

  if (!current) {
    return (
      <div className="px-3 py-2 rounded-md bg-muted/40 text-muted-foreground text-xs flex items-start gap-2">
        <CloudOff size={14} className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">同期 OFF</p>
          <p className="text-[11px] opacity-80">クラウド同期から開始</p>
        </div>
      </div>
    )
  }

  let icon = <Cloud size={14} className="mt-0.5 flex-shrink-0 text-primary" />
  let label = '同期準備中'
  let detail: string = current.name
  let tone = 'bg-primary/10 text-primary'

  if (status === 'pending') {
    icon = <Cloud size={14} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
    label = '保存予約中...'
    detail = current.name
    tone = 'bg-muted/40 text-muted-foreground'
  } else if (status === 'saving') {
    icon = <Loader2 size={14} className="mt-0.5 flex-shrink-0 text-primary animate-spin" />
    label = '保存中...'
    detail = current.name
    tone = 'bg-primary/10 text-primary'
  } else if (status === 'saved') {
    icon = <CloudCheck size={14} className="mt-0.5 flex-shrink-0 text-primary" />
    label = '保存済み'
    detail = lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString('ja-JP') : current.name
    tone = 'bg-primary/10 text-primary'
  } else if (status === 'error') {
    icon = <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-destructive" />
    label = '同期エラー'
    detail = errorMessage ?? 'もう一度試してください'
    tone = 'bg-destructive/10 text-destructive'
  }

  return (
    <div className={`px-3 py-2 rounded-md text-xs flex items-start gap-2 ${tone}`}>
      {icon}
      <div className="min-w-0">
        <p className="font-medium truncate">{label}</p>
        <p className="text-[11px] opacity-80 truncate">{detail}</p>
      </div>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border p-6 flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-sidebar-primary">アニメ制作</h1>
        <p className="text-sm text-muted-foreground mt-1">制作支援ツール</p>
      </div>
      <nav className="space-y-2 flex-1">
        {NAV.map((item) => {
          const Icon = item.icon
          const active =
            item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? 'flex items-center gap-3 px-4 py-3 rounded-lg bg-sidebar-primary/20 text-sidebar-primary font-medium'
                  : 'flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition'
              }
            >
              <Icon size={20} />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="mt-4">
        <SyncBadge />
      </div>
    </aside>
  )
}
