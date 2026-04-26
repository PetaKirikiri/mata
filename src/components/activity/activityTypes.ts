export const DEMO_ACTIVITY_TYPE = 'demo_board';

export type DemoToken = {
  id: string;
  label: string;
  name: string;
  x: number;
  y: number;
  color: 'accent' | 'amber' | 'stone';
};

export type DemoTokenSource = {
  id: string;
  name: string;
};

export type DemoActivityState = {
  tokens: DemoToken[];
  updatedAt: string | null;
};

export type DemoActivityAction = 'move_token';

// #region agent log
function debugActivityTypes(hypothesisId: string, message: string, data: Record<string, unknown>) {
  fetch('http://127.0.0.1:7771/ingest/79f1aff3-86e0-4db0-a74d-86ce63141809', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '358ecf' },
    body: JSON.stringify({
      sessionId: '358ecf',
      runId: 'pre-fix',
      hypothesisId,
      location: 'src/components/activity/activityTypes.ts',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readColor(value: unknown): DemoToken['color'] {
  return value === 'amber' || value === 'stone' || value === 'accent' ? value : 'accent';
}

function readToken(value: unknown, fallback: DemoToken): DemoToken {
  if (!value || typeof value !== 'object') return fallback;
  const raw = value as Record<string, unknown>;
  return {
    id: typeof raw.id === 'string' ? raw.id : fallback.id,
    label: typeof raw.label === 'string' ? raw.label : fallback.label,
    name: typeof raw.name === 'string' ? raw.name : fallback.name,
    x: readNumber(raw.x, fallback.x),
    y: readNumber(raw.y, fallback.y),
    color: readColor(raw.color),
  };
}

function buildToken(source: DemoTokenSource, index: number, total: number): DemoToken {
  const colors: DemoToken['color'][] = ['accent', 'amber', 'stone'];
  const columns = Math.max(1, Math.ceil(Math.sqrt(total)));
  const row = Math.floor(index / columns);
  const column = index % columns;

  return {
    id: source.id,
    label: source.name.slice(0, 1).toUpperCase(),
    name: source.name,
    x: ((column + 1) / (columns + 1)) * 100,
    y: ((row + 1) / (Math.ceil(total / columns) + 1)) * 100,
    color: colors[index % colors.length],
  };
}

export function buildDemoActivityState(sources: DemoTokenSource[]): DemoActivityState {
  debugActivityTypes('H4', 'build demo activity state', {
    sourcesIsArray: Array.isArray(sources),
    sourceCount: Array.isArray(sources) ? sources.length : null,
  });
  return {
    tokens: sources.map((source, index) => buildToken(source, index, sources.length)),
    updatedAt: null,
  };
}

export function parseDemoActivityState(value: unknown, sources: DemoTokenSource[]): DemoActivityState {
  const defaultState = buildDemoActivityState(sources);
  debugActivityTypes('H5', 'parse demo activity state', {
    sourcesIsArray: Array.isArray(sources),
    sourceCount: Array.isArray(sources) ? sources.length : null,
    stateIsObject: value != null && typeof value === 'object',
    persistedTokenCount:
      value != null && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).tokens)
        ? ((value as Record<string, unknown>).tokens as unknown[]).length
        : null,
    defaultTokenCount: defaultState.tokens.length,
  });
  if (!value || typeof value !== 'object') return defaultState;
  const raw = value as Record<string, unknown>;
  const tokens = Array.isArray(raw.tokens)
    ? defaultState.tokens.map((fallback) => {
        const found = raw.tokens.find((token) => {
          return token && typeof token === 'object' && (token as Record<string, unknown>).id === fallback.id;
        });
        return readToken(found, fallback);
      })
    : defaultState.tokens;

  return {
    tokens,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  };
}
