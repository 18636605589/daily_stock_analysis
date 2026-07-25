export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

export function cleanStockCode(symbol: string): string {
  return symbol.replace(/\.(SS|SZ|BJ|HK)$/i, '');
}

export function getOperationVariant(rating: string): BadgeVariant {
  if (!rating) return 'default';
  if (rating.includes('买入') || rating.includes('积极') || rating.includes('可介入')) return 'success';
  if (rating.includes('企稳可关注') || rating.includes('回调企稳')) return 'success';
  if (rating.includes('观察') || rating.includes('关注') || rating.includes('等待') || rating.includes('待确认')) return 'warning';
  if (rating.includes('谨慎') || rating.includes('回避') || rating.includes('不建议') || rating.includes('偏弱') || rating.includes('波动偏大')) return 'danger';
  if (rating.includes('持仓') || rating.includes('持有')) return 'info';
  return 'default';
}

/** a_stock v3 pool_source 是否属于精选 shortlist */
export function isShortlistPool(poolSource?: string | null): boolean {
  return Boolean(poolSource && poolSource.toLowerCase().includes('shortlist'));
}

export function getPoolSourceLabel(poolSource?: string | null): string {
  if (!poolSource) return '';
  const ps = poolSource.toLowerCase();
  if (ps.includes('shortlist') && ps.includes('research')) return '精选+研究';
  if (ps.includes('shortlist')) return '精选池';
  if (ps.includes('research')) return '研究池';
  return poolSource;
}

export function getPoolSourceVariant(poolSource?: string | null): BadgeVariant {
  if (!poolSource) return 'default';
  if (isShortlistPool(poolSource)) return 'success';
  if (poolSource.toLowerCase().includes('research')) return 'info';
  return 'default';
}

export function getAuctionStrengthLabel(strength?: string | null): string {
  if (!strength) return '';
  const s = strength.toLowerCase();
  if (s === 'buy' || s.includes('强') || s.includes('多')) return '竞价偏强';
  if (s === 'sell' || s.includes('弱') || s.includes('空')) return '竞价偏弱';
  if (s === 'neutral' || s.includes('中')) return '竞价中性';
  return strength;
}

export function getAuctionStrengthVariant(strength?: string | null): BadgeVariant {
  if (!strength) return 'default';
  const s = strength.toLowerCase();
  if (s === 'buy' || s.includes('强') || s.includes('多')) return 'success';
  if (s === 'sell' || s.includes('弱') || s.includes('空')) return 'danger';
  return 'warning';
}

export function formatPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

export function formatNum(v: number | null | undefined, digits: number = 2): string {
  if (v === null || v === undefined) return '--';
  return v.toFixed(digits);
}

export function pctClass(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'text-secondary-text';
  return v > 0 ? 'text-danger' : v < 0 ? 'text-success' : 'text-secondary-text';
}

export function formatYmdDate(yyyymmdd: string): string {
  if (!yyyymmdd) return '--';
  if (yyyymmdd.length === 8) return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  return yyyymmdd;
}
