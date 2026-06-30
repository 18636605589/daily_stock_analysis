export interface MarketIndexInfo {
  price: number;
  changePct: number;
}

export interface MarketOverview {
  indices: Record<string, MarketIndexInfo>;
  limitUp: number;
  limitDown: number;
}

export interface FactorStockItem {
  symbol: string;
  name: string;
  industry: string;
  factorScore: number;
  finalScore: number;
  shortTermScore: number;
  operationRating: string;
  deepTechRating: string;
  deepTechSignal: string;
}

export interface NextRecommendationsResponse {
  schemaVersion: string;
  reportTime: string;
  asOfDate: string;
  nextTradingDay: string;
  market: MarketOverview;
  factorData: FactorStockItem[];
  dataDir: string;
}

export interface PremarketStockItem {
  symbol: string;
  code: string;
  name: string;
  industry: string;
  operationRating: string;
  finalScore: number;
  factorScore: number;
  shortTermScore?: number | null;
  deepTechRating: string;
  deepTechSignal: string;
  action: string;
  position: string;
  reason: string;
  riskFlags: string;
  changePct?: number | null;
  volumeRatio?: number | null;
  latest?: number | null;
  prevClose?: number | null;
  ma5?: number | null;
  ma10?: number | null;
  ma20?: number | null;
  ma60?: number | null;
  atrPct?: number | null;
  entryPrice?: number | null;
  stopLoss?: number | null;
  targetPrice?: number | null;
  riskReward?: number | null;
}

export interface PremarketReviewResponse {
  validateTime: string;
  sourceData: string;
  sourceReportTime: string;
  phase: string;
  phaseLabel: string;
  confidence: string;
  marketBias: string;
  marketReason: string;
  elapsedSeconds: number;
  results: PremarketStockItem[];
  date: string;
}

export interface DatedFileItem {
  date: string;
  label: string;
  timestamp: string;
}

export interface DailySnapshotStockItem {
  symbol: string;
  name: string;
  industry: string;
  factorScore: number;
  finalScore: number;
  shortTermScore?: number | null;
  operationRating: string;
  deepTechRating: string;
  deepTechSignal: string;
}

export interface DailySnapshotResponse {
  reportTime: string;
  asOfDate: string;
  market: Record<string, unknown>;
  factorData: DailySnapshotStockItem[];
  technical: Record<string, unknown>[];
  icDiagnostics: Record<string, unknown>;
  risk: Record<string, unknown>;
  sourcePath: string;
}

export interface FactorICItem {
  computeDate: string;
  factor: string;
  direction: string;
  icMean?: number | null;
  icStd?: number | null;
  icir?: number | null;
  nDays: number;
}

export interface FactorICResponse {
  items: FactorICItem[];
  latestDate: string;
}

export interface PerformanceStockItem {
  reportDate: string;
  symbol: string;
  name: string;
  industry: string;
  finalScore?: number | null;
  operationRating: string;
  priceAtRec?: number | null;
  retT1?: number | null;
  excessT1?: number | null;
  retT5?: number | null;
  excessT5?: number | null;
  retT20?: number | null;
  excessT20?: number | null;
}

export interface PerformanceStats {
  totalCount: number;
  avgRetT1?: number | null;
  avgRetT5?: number | null;
  winRateT1?: number | null;
  winRateT5?: number | null;
}

export interface PerformanceResponse {
  stats: PerformanceStats;
  items: PerformanceStockItem[];
}

export interface DataStatusResponse {
  available: boolean;
  dataDir: string;
  message: string;
  dailyCount: number;
  premarketCount: number;
}

export type AStockTabKey = 'next' | 'premarket' | 'history' | 'factor_ic' | 'performance';
