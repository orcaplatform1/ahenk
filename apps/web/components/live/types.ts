export type SonarState = 'new' | 'active' | 'pool';

export interface SonarDensity {
  mode: 'static' | 'real';
  districts: { name: string; level: 1 | 2 | 3 | 4; percent: number | null }[];
}

export interface LivePulse {
  sonar: {
    dots: { key: string; district: string | null; state: SonarState }[];
    labels: { name: string; active: boolean }[];
    density?: SonarDensity | null;
  };
  feed: {
    events: { key: string; at: string; place: string; kind: 'FULL' | 'MATCH' | 'OPEN' | 'VENUE'; value: number | null }[];
    perMinute: number;
  };
}

export interface LiveFill { filled: number; total: number }

export type OceanKey = 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';

export interface LiveOverview {
  city: { id: string; name: string };
  metrics: { pool: number; tables: number; fillPercent: number };
  groupSeatsLeft: number | null;
  fill: { group: LiveFill; oneOnOne: LiveFill; kanka: LiveFill };
  heatmap: { name: string; percent: number }[];
  density?: SonarDensity | null;
  signal: { closeCount: number; top: { key: OceanKey; score: number }[]; commonDimension: OceanKey | null };
  hasTable: boolean;
}
