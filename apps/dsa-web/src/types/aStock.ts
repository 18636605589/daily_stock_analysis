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
  poolSource?: string;
  shortlistScore?: number | null;
}

export interface ShortlistMeta {
  hasHot?: boolean;
  hasLhb?: boolean;
  hasLimitUpHit?: boolean;
  emptyReason?: unknown;
  count?: number | null;
}

export interface NextRecommendationsResponse {
  schemaVersion: string;
  schemaFamily?: string;
  purpose?: string;
  reportTime: string;
  asOfDate: string;
  nextTradingDay: string;
  market: MarketOverview;
  factorData: FactorStockItem[];
  shortlistMeta?: ShortlistMeta;
  selectionContext?: Record<string, unknown>;
  source?: Record<string, string>;
  shortlistCount?: number;
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
  actionCategory?: 'buy' | 'watch' | 'avoid';
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
  quoteSource?: string;
  auctionStrength?: string;
  auctionScore?: number | null;
  auctionTurnover?: number | null;
  bidAskRatio?: number | null;
  auctionEnriched?: boolean | null;
  openGapPct?: number | null;
  refPrice?: number | null;
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
  time: string;
  timestamp: string;
}

export interface DatedFileItem {
  date: string;
  label: string;
  timestamp: string;
  time: string;
  phase: string;
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
  poolSource?: string;
  shortlistScore?: number | null;
}

export interface ShortlistItem {
  symbol: string;
  name: string;
  industry: string;
  finalScore?: number | null;
  factorScore?: number | null;
  shortTermScore?: number | null;
  shortlistScore?: number | null;
  operationRating: string;
  deepTechRating: string;
  deepTechSignal: string;
  patternTag?: string;
  sources?: string[];
  auctionWatch?: string;
  shortTermReason?: string;
}

export interface ShortlistBlock {
  enabled: boolean;
  count: number;
  meta?: Record<string, unknown>;
  items: ShortlistItem[];
}

export interface DailySnapshotResponse {
  schemaVersion?: string;
  schemaFamily?: string;
  reportTime: string;
  asOfDate: string;
  nextTradingDay?: string;
  market: Record<string, unknown>;
  factorData: DailySnapshotStockItem[];
  technical: Record<string, unknown>[];
  icDiagnostics: Record<string, unknown>;
  risk: Record<string, unknown>;
  selectionContext?: Record<string, unknown>;
  shortlist?: ShortlistBlock;
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
  earliestDate?: string;
  sampleDays?: number;
  historyRestarted?: boolean;
  historyNote?: string;
}

export interface PerformanceStockItem {
  reportDate: string;
  symbol: string;
  name: string;
  industry: string;
  finalScore?: number | null;
  operationRating: string;
  deepTechRating?: string;
  isActionable?: boolean | null;
  isShortlist?: boolean | null;
  poolSource?: string;
  priceAtRec?: number | null;
  retT1?: number | null;
  excessT1?: number | null;
  retT5?: number | null;
  excessT5?: number | null;
  retT20?: number | null;
  excessT20?: number | null;
  retT1Gross?: number | null;
  excessT1Gross?: number | null;
  retT5Gross?: number | null;
  excessT5Gross?: number | null;
  retT1Tradable?: number | null;
  excessT1Tradable?: number | null;
}

export interface PerformanceStats {
  totalCount: number;
  avgRetT1?: number | null;
  avgRetT5?: number | null;
  winRateT1?: number | null;
  winRateT5?: number | null;
}

export interface PerformanceResponse {
  returnBasis?: string;
  trackLabel?: string;
  note?: string;
  stats: PerformanceStats;
  actionableStats?: PerformanceStats;
  shortlistStats?: PerformanceStats;
  items: PerformanceStockItem[];
}

export interface DataStatusResponse {
  available: boolean;
  dataDir: string;
  message: string;
  dailyCount: number;
  premarketCount: number;
  premarketDayCount?: number;
  schemaVersion?: string;
  schemaFamily?: string;
  latestAsOfDate?: string;
  latestNextTradingDay?: string;
}

export type AStockTabKey = 'next' | 'premarket' | 'history' | 'factor_ic' | 'performance';
