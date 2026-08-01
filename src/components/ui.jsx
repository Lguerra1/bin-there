/**
 * Shared building blocks. Every screen composes these rather than hand-rolling
 * classes, so sizing and spacing stay consistent as the app grows.
 *
 * Sizing rules that matter on a phone:
 *  - Interactive things are at least 48px tall (Apple and Google both put the
 *    minimum comfortable touch target around 44-48px).
 *  - Inputs never go below 16px text. iOS Safari auto-zooms the page when you
 *    focus a smaller field, which feels broken.
 */

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50'

const sizes = {
  md: 'min-h-12 px-5 text-base',
  lg: 'min-h-14 px-6 text-lg',
}

const variants = {
  primary: 'bg-accent text-white shadow-sm hover:bg-accent-hover',
  secondary:
    'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-750',
  ghost:
    'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  dangerGhost:
    'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50',
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) {
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    />
  )
}

/** Square tap target for icon-only actions. */
export function IconButton({ variant = 'ghost', className = '', ...props }) {
  return (
    <button
      className={`${base} h-12 w-12 shrink-0 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function TextField({ label, hint, className = '', ...props }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
      )}
      <input
        className={`min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-accent focus:ring-4 focus:ring-accent/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 ${className}`}
        {...props}
      />
      {hint && <span className="mt-1.5 block text-sm text-gray-500">{hint}</span>}
    </label>
  )
}

export function Select({ label, className = '', children, ...props }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
      )}
      <select
        className={`min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

export function Checkbox({ label, description, ...props }) {
  return (
    <label className="flex min-h-12 items-start gap-3 py-2">
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 rounded accent-accent"
        {...props}
      />
      <span className="text-base text-gray-800 dark:text-gray-200">
        {label}
        {description && (
          <span className="mt-0.5 block text-sm text-gray-500 dark:text-gray-400">
            {description}
          </span>
        )}
      </span>
    </label>
  )
}

export function Card({ className = '', ...props }) {
  return (
    <div
      className={`rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}
      {...props}
    />
  )
}

export function Page({ children }) {
  return (
    <div className="min-h-full bg-gray-50 pb-[env(safe-area-inset-bottom)] dark:bg-gray-950">
      <div className="mx-auto max-w-xl px-4 pb-16">{children}</div>
    </div>
  )
}

export function PageHeader({ title, subtitle, back, actions }) {
  return (
    <header className="flex items-center gap-3 py-5">
      {back}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>
      {actions}
    </header>
  )
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <Card className="px-6 py-14 text-center">
      {Icon && <Icon size={40} strokeWidth={1.5} className="mx-auto text-gray-300 dark:text-gray-600" />}
      <p className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">{title}</p>
      {children && (
        <p className="mx-auto mt-1.5 max-w-xs text-base text-gray-500 dark:text-gray-400">
          {children}
        </p>
      )}
    </Card>
  )
}

export function ErrorBanner({ children }) {
  if (!children) return null
  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
      {children}
    </div>
  )
}

export function Badge({ tone = 'gray', children }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    accent: 'bg-accent/10 text-accent dark:bg-accent/20',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
