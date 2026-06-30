import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { StatCard } from '../common/StatCard';
import { EmptyState } from '../common/EmptyState';
import { Loading } from '../common/Loading';
import type { NextRecommendationsResponse, FactorStockItem } from '../../types/aStock';
import { cleanStockCode, formatPct, getOperationVariant } from './utils';

interface NextRecommendationsProps {
  data: NextRecommendationsResponse | null;
  loading: boolean;
  error: string | null;
}

function getTechVariant(rating: string): 'success' | 'warning' | 'danger' | 'default' {
  if (rating.startsWith('A')) return 'success';
  if (rating.startsWith('B')) return 'warning';
  if (rating.startsWith('C')) return 'danger';
  return 'default';
}

function IndexRow({ name, price, changePct }: { name: string; price: number; changePct: number }) {
  const color = changePct >= 0 ? 'text-danger' : 'text-success';
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-sm font-medium text-foreground">{name}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm text-secondary-text">{price.toFixed(2)}</span>
        <span className={`text-sm font-semibold ${color}`}>{formatPct(changePct)}</span>
      </div>
    </div>
  );
}

function StockCard({ stock, onNavigate }: { stock: FactorStockItem; onNavigate: (code: string, name: string) => void }) {
  const code = cleanStockCode(stock.symbol);
  return (
    <div
      className="rounded-xl border border-border/50 bg-card/60 p-4 transition-all hover:border-cyan/30 hover:bg-card/80 cursor-pointer"
      onClick={() => onNavigate(code, stock.name)}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-foreground truncate hover:text-cyan transition-colors">{stock.name}</span>
            <span className="text-xs text-secondary-text font-mono">{code}</span>
          </div>
          {stock.industry && <span className="text-xs text-secondary-text">{stock.industry}</span>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant={getOperationVariant(stock.operationRating)} size="sm">{stock.operationRating || '待评估'}</Badge>
          {stock.deepTechRating && <Badge variant={getTechVariant(stock.deepTechRating)} size="sm">{stock.deepTechRating}</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div>
          <div className="text-xs text-secondary-text">综合评分</div>
          <div className="text-lg font-semibold text-cyan">{stock.finalScore.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-xs text-secondary-text">因子评分</div>
          <div className="text-sm font-medium text-foreground">{stock.factorScore.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-xs text-secondary-text">短期评分</div>
          <div className="text-sm font-medium text-foreground">{stock.shortTermScore.toFixed(1)}</div>
        </div>
      </div>
      {stock.deepTechSignal && (
        <div className="mt-2 text-xs text-secondary-text border-t border-border/30 pt-2">{stock.deepTechSignal}</div>
      )}
    </div>
  );
}

export const NextRecommendations: React.FC<NextRecommendationsProps> = ({ data, loading, error }) => {
  const navigate = useNavigate();

  const handleNavigateToChat = (code: string, name: string) => {
    navigate(`/chat?stock=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`);
  };

  if (loading) return <Loading />;
  if (error) return <EmptyState title="数据加载失败" description={error} />;
  if (!data || !data.factorData.length) return <EmptyState title="暂无荐股数据" description="等待 a_stock 生成次日荐股数据" />;

  const indices = data.market?.indices || {};
  const indexNames: Record<string, string> = {
    sh: '上证指数', sz: '深证成指', cyb: '创业板指', hs300: '沪深300',
    zx: '中小板指', sci: '科创50',
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="报告日期" value={data.asOfDate || '--'} hint={`下一交易日: ${data.nextTradingDay || '--'}`} tone="primary" />
        <StatCard label="涨停家数" value={data.market?.limitUp ?? '--'} tone="success" />
        <StatCard label="跌停家数" value={data.market?.limitDown ?? '--'} tone={data.market && data.market.limitDown > 30 ? 'danger' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="市场指数" subtitle="MARKET OVERVIEW" className="lg:col-span-1">
          <div className="space-y-0">
            {Object.entries(indices).map(([key, info]) => (
              <IndexRow key={key} name={indexNames[key] || key} price={info.price} changePct={info.changePct} />
            ))}
          </div>
        </Card>

        <Card title={`候选股票 (${data.factorData.length}只)`} subtitle="STOCK PICKS" className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {data.factorData.map((stock) => (
              <StockCard key={stock.symbol} stock={stock} onNavigate={handleNavigateToChat} />
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-dashed border-border/60 bg-card/30 p-3 text-xs text-secondary-text">
            💡 次日早上 09:26 / 09:35 盘前复核后会更新最终操作建议，请关注「盘前复盘」Tab 获取最新操作指引。
          </div>
        </Card>
      </div>
    </div>
  );
};
