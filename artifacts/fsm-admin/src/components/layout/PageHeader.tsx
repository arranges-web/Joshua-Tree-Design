import type { ReactNode } from "react";

/**
 * Standardized header for every admin page. Renders the now-
 * established Joshua Tree pattern:
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ EYEBROW · UPPERCASE                                  │
 *   │                                                      │
 *   │ Page Title          [Optional inline status badge]   │
 *   │ One-line description of what this page is for.       │
 *   │                                                      │
 *   │ ──────────────────────────────────────  [actions...] │
 *   └──────────────────────────────────────────────────────┘
 *
 * Putting this in one place gives every page the same vertical
 * rhythm and lets us tweak the look in a single file rather than
 * chasing twelve ad-hoc `<div className="flex items-end ...">`
 * blocks. Each page passes a `title`, optional `eyebrow`,
 * `description`, `icon`, and `actions`.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  actions,
  badges,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  badges?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-1.5">
        {eyebrow && (
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground sm:h-11 sm:w-11">
              {icon}
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
        </div>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {badges && (
          <div className="flex flex-wrap items-center gap-2 pt-1">{badges}</div>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
