'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Film, Mountain } from 'lucide-react'

const NAV = [
  { href: '/', label: 'ダッシュボード', icon: Film },
  { href: '/characters', label: 'キャラクター', icon: Users },
  { href: '/environment', label: '環境', icon: Mountain },
  { href: '/storyboard', label: 'ストーリーボード', icon: Film },
] as const

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-sidebar-primary">アニメ制作</h1>
        <p className="text-sm text-muted-foreground mt-1">制作支援ツール</p>
      </div>
      <nav className="space-y-2">
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
    </aside>
  )
}
