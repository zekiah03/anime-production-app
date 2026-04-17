// ローディング中の薄いプレースホルダー UI。
// Tailwind の animate-pulse と muted 背景で「何か来る」ことを示す。

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-muted ${className ?? ''}`}
      aria-hidden="true"
    />
  )
}

// シーンカード 1 枚分の骨格(storyboard 用)
export function SceneCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-4">
      <Skeleton className="w-4 h-4 mt-1 flex-shrink-0" />
      <Skeleton className="w-5 h-5 mt-1 flex-shrink-0" />
      <Skeleton className="w-24 h-14 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="flex gap-1">
        <Skeleton className="w-8 h-8" />
        <Skeleton className="w-8 h-8" />
      </div>
    </div>
  )
}

// キャラクターカード 1 枚分の骨格
export function CharacterCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <Skeleton className="h-8 w-full" />
    </div>
  )
}

// 汎用リスト骨格(N 行)
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}
