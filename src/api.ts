declare global {
  interface Window {
    CRIBL_API_URL?: string;
  }
}

function getApiBase(): string {
  return window.CRIBL_API_URL ?? '/api/v1';
}

const SEARCH_PREFIX = '/m/default_search';

let currentJobId: string | null = null;

interface DatasetItem {
  id: string;
  type: string;
  description?: string;
}

interface DatasetsResponse {
  items: DatasetItem[];
  count: number;
}

interface FieldsResponse {
  fields: string[];
}

export async function fetchDatasets(): Promise<DatasetItem[]> {
  const res = await fetch(`${getApiBase()}${SEARCH_PREFIX}/search/datasets`);
  if (!res.ok) throw new Error(`Failed to fetch datasets: ${res.status}`);
  const data: DatasetsResponse = await res.json();
  return data.items;
}

export async function fetchDatasetFields(datasetId: string): Promise<string[]> {
  const res = await fetch(`${getApiBase()}${SEARCH_PREFIX}/search/datasets/${encodeURIComponent(datasetId)}/fields`);
  if (!res.ok) throw new Error(`Failed to fetch fields: ${res.status}`);
  const data: FieldsResponse = await res.json();
  return data.fields;
}

interface SearchJobResponse {
  items: Array<{ id: string }>;
}

export interface SearchResult {
  [key: string]: unknown;
}

export async function executeSearch(query: string, earliest: string, latest: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const createRes = await fetch(`${getApiBase()}${SEARCH_PREFIX}/search/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, earliest, latest }),
    signal,
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(err);
  }
  const job: SearchJobResponse = await createRes.json();
  currentJobId = job.items[0].id;

  const results: SearchResult[] = [];
  let finished = false;

  while (!finished) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    await new Promise(r => setTimeout(r, 500));

    const pollRes = await fetch(`${getApiBase()}${SEARCH_PREFIX}/search/jobs/${currentJobId}/results-poll`, { signal });
    if (!pollRes.ok) throw new Error(`Failed to poll results: ${pollRes.status}`);

    const text = await pollRes.text();
    const lines = text.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.isFinished !== undefined) {
          finished = parsed.isFinished;
        } else if (!parsed.job && !parsed.totalEventCount && Object.keys(parsed).length > 1) {
          results.push(parsed);
        }
      } catch { /* skip */ }
    }
  }

  currentJobId = null;
  return results;
}

export function cancelSearch() {
  if (!currentJobId) return;
  fetch(`${getApiBase()}${SEARCH_PREFIX}/search/jobs/${currentJobId}/cancel`, { method: 'POST' }).catch(() => {});
  currentJobId = null;
}
