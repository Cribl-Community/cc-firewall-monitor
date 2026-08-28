declare global {
  interface Window {
    CRIBL_API_URL?: string;
  }
}

export interface AppConfig {
  dataset: string;
  query: string;
}

const KV_PATH = '/kvstore/config';

function getApiBase(): string {
  return window.CRIBL_API_URL ?? '/api/v1';
}

const DEFAULT_QUERY = `dataset="$DATASET"
| where _time >= $FROM and _time <= $TO
| project _time, source_ip, source_port, destination_ip, destination_port, protocol, action, rule_name, application
| sort by _time desc
| limit 1000`;

export async function loadConfig(): Promise<AppConfig | null> {
  try {
    const res = await fetch(`${getApiBase()}${KV_PATH}`);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    const data = JSON.parse(text);
    if (data && data.dataset) return data;
  } catch { /* unavailable */ }
  return null;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const body = JSON.stringify(config);
  await fetch(`${getApiBase()}${KV_PATH}`, {
    method: 'PUT',
    body,
  });
}

export async function clearConfig(): Promise<void> {
  await fetch(`${getApiBase()}${KV_PATH}`, { method: 'DELETE' });
}

export function buildDefaultQuery(dataset: string): string {
  return DEFAULT_QUERY.replace('$DATASET', dataset);
}
