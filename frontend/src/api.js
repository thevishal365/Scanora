const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export function apiUrl(path) {
  const base = API_BASE.replace(/\/+$/, '')
  return `${base}${path}`
}
