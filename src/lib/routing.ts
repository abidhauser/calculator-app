const normalizeBase = (raw: string) => {
  // Normalize Vite BASE_URL into a stable prefix with no trailing slash.
  const value = (raw || '/').trim()
  if (!value || value === '/') return ''
  return value.endsWith('/') ? value.slice(0, -1) : value
}

export const APP_BASE_PATH = normalizeBase(import.meta.env.BASE_URL || '/')

export const APP_ROOT_PATH = APP_BASE_PATH ? `${APP_BASE_PATH}/` : '/'

export const stripAppBasePath = (pathname: string) => {
  if (!APP_BASE_PATH) return pathname

  if (pathname === APP_BASE_PATH || pathname === APP_ROOT_PATH) return '/'
  if (!pathname.startsWith(`${APP_BASE_PATH}/`)) return pathname

  return pathname.slice(APP_BASE_PATH.length) || '/'
}

export const withAppBasePath = (route: string) => {
  const scopedRoute = route.endsWith('/') ? route.slice(0, -1) : route
  if (!APP_BASE_PATH) return scopedRoute
  return `${APP_BASE_PATH}${scopedRoute}`
}

