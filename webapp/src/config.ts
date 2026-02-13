interface AppConfig { apiBaseUrl: string }
let config: AppConfig | null = null
export async function loadConfig(): Promise<AppConfig> {
  if (config) return config
  try { const r = await fetch('/aesthetics/config.json'); config = await r.json() }
  catch { config = { apiBaseUrl: '' } }
  return config!
}
export function getConfig(): AppConfig { if (!config) throw new Error('Config not loaded'); return config }
export function getApiBaseUrl(): string { return getConfig().apiBaseUrl }
