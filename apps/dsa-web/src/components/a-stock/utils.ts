export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

export function cleanStockCode(symbol: string): string {
  return symbol.replace(/\.(SS|SZ|BJ|HK)$/i, '');
}

export function getOperationVariant(rating: string): BadgeVariant {
  if (!rating) return 'default';
  if (rating.includes('买入') || rating.includes('积极') || rating.includes('可介入')) return 'success';
  if (rating.includes('观察') || rating.includes('关注') || rating.includes('等待')) return 'warning';
  if (rating.includes('谨慎') || rating.includes('回避') || rating.includes('不建议')) return 'danger';
  if (rating.includes('持仓') || rating.includes('持有')) return 'info';
  return 'default';
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
