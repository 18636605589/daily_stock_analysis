import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { StatCard } from '../common/StatCard';
import { EmptyState } from '../common/EmptyState';
import { Loading } from '../common/Loading';
import type { PremarketReviewResponse, PremarketStockItem, DatedFileItem } from '../../types/aStock';
import { cleanStockCode, formatNum, formatPct } from './utils';

interface PremarketReviewProps {
  data: PremarketReviewResponse | null;
  dates: DatedFileItem[];
  selectedDate: string;
  loading: boolean;
  error: string | null;
  onSelectDate: (date: string) => void;
}

function getMarketBiasVariant(bias: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  if (bias.includes('强')) return 'success';
  if (bias.includes('极弱')) return 'danger';
  if (bias.includes('弱')) return 'warning';
  if (bias.includes('中')) return 'info';
  return 'default';
}

function getActionVariant(action: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  if (action === '买入') return 'success';
  if (action === '观察' || action === '观望') return 'warning';
  if (action === '卖出' || action === '回避') return 'danger';
  if (action === '持有') return 'info';
  return 'default';
}

function getVolumeStateEmoji(reason: string): string {
  if (reason.includes('📈')) return '📈';
  if (reason.includes('🔍')) return '🔍';
  if (reason.includes('⚠️')) return '⚠️';
  if (reason.includes('📉')) return '📉';
  return '⚪';
}

function getVolumeStateLabel(reason: string): string {
  if (reason.includes('放量上涨')) return '放量上涨';
  if (reason.includes('缩量回调')) return '缩量回调';
  if (reason.includes('缩量上涨')) return '缩量上涨';
  if (reason.includes('放量下跌')) return '放量下跌';
  return '量能正常';
}

function getVolumeStateVariant(reason: string): 'success' | 'warning' | 'danger' | 'default' {
  if (reason.includes('放量上涨') || reason.includes('缩量回调')) return 'success';
  if (reason.includes('缩量上涨')) return 'warning';
  if (reason.includes('放量下跌')) return 'danger';
  return 'default';
}

function PremarketStockCard({ stock, onNavigate }: { stock: PremarketStockItem; onNavigate: (code: string, name: string) => void }) {
  const volEmoji = getVolumeStateEmoji(stock.reason);
  const volLabel = getVolumeStateLabel(stock.reason);
  const volVariant = getVolumeStateVariant(stock.reason);
  const isCircuitBreaker = stock.riskFlags?.includes('断路器');
  const code = cleanStockCode(stock.code || stock.symbol);
  const stockName = stock.name || stock.symbol;

  return (
    <div
      className={`rounded-xl border p-4 transition-all cursor-pointer ${isCircuitBreaker ? 'border-danger/30 bg-danger/5 hover:bg-danger/10' : 'border-border/50 bg-card/60 hover:border-cyan/30 hover:bg-card/80'}`}
      onClick={() => onNavigate(code, stockName)}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-foreground hover:text-cyan transition-colors">{stockName}</span>
            <span className="text-xs text-secondary-text font-mono">{code}</span>
            {stock.industry && <span className="text-xs text-secondary-text">· {stock.industry}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={getActionVariant(stock.action)} size="sm" glow={stock.action === '买入'}>{stock.action || '观察'}</Badge>
            <Badge variant={volVariant} size="sm">{volEmoji} {volLabel}</Badge>
            {stock.operationRating && stock.operationRating !== stock.action && (
              <Badge variant="default" size="sm">{stock.operationRating}</Badge>
            )}
            {isCircuitBreaker && <Badge variant="danger" size="sm">⛔ 断路器</Badge>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-semibold text-foreground">{formatNum(stock.latest)}</div>
          <div className={`text-sm font-medium ${(stock.changePct ?? 0) >= 0 ? 'text-danger' : 'text-success'}`}>
            {formatPct(stock.changePct)}
          </div>
        </div>
      </div>

      {stock.reason && (
        <div className="mt-2 text-sm text-secondary-text bg-elevated/40 rounded-lg p-2 leading-relaxed">
          {stock.reason}
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3 text-center">
        {stock.volumeRatio !== null && stock.volumeRatio !== undefined && (
          <div className="rounded bg-card/50 p-1.5">
            <div className="text-xs text-secondary-text">量比</div>
            <div className="text-sm font-medium text-foreground">{formatNum(stock.volumeRatio)}</div>
          </div>
        )}
        {stock.position && (
          <div className="rounded bg-card/50 p-1.5">
            <div className="text-xs text-secondary-text">建议仓位</div>
            <div className="text-sm font-medium text-cyan">{stock.position}</div>
          </div>
        )}
        {stock.entryPrice !== null && stock.entryPrice !== undefined && (
          <div className="rounded bg-card/50 p-1.5">
            <div className="text-xs text-secondary-text">参考价</div>
            <div className="text-sm font-medium text-foreground">{formatNum(stock.entryPrice)}</div>
          </div>
        )}
        {stock.stopLoss !== null && stock.stopLoss !== undefined && (
          <div className="rounded bg-card/50 p-1.5">
            <div className="text-xs text-secondary-text">止损</div>
            <div className="text-sm font-medium text-danger">{formatNum(stock.stopLoss)}</div>
          </div>
        )}
        {stock.targetPrice !== null && stock.targetPrice !== undefined && (
          <div className="rounded bg-card/50 p-1.5">
            <div className="text-xs text-secondary-text">目标</div>
            <div className="text-sm font-medium text-success">{formatNum(stock.targetPrice)}</div>
          </div>
        )}
        {stock.finalScore !== null && stock.finalScore !== undefined && (
          <div className="rounded bg-card/50 p-1.5">
            <div className="text-xs text-secondary-text">综合分</div>
            <div className="text-sm font-medium text-foreground">{formatNum(stock.finalScore, 1)}</div>
          </div>
        )}
      </div>

      {stock.riskFlags && !isCircuitBreaker && (
        <div className="mt-2 text-xs text-warning">⚠️ {stock.riskFlags}</div>
      )}
    </div>
  );
}

export const PremarketReview: React.FC<PremarketReviewProps> = ({
  data, dates, selectedDate, loading, error, onSelectDate,
}) => {
  const navigate = useNavigate();

  const handleNavigateToChat = (code: string, name: string) => {
    navigate(`/chat?stock=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`);
  };

  if (loading) return <Loading />;
  if (error) return <EmptyState title="数据加载失败" description={error} />;
  if (!data) return <EmptyState title="暂无盘前复盘数据" description="等待盘前复核脚本生成数据" />;

  const isCircuitBreaker = data.marketBias.includes('极弱');
  const buyCount = data.results.filter((r) => r.action === '买入').length;
  const watchCount = data.results.filter((r) => r.action === '观察').length;
  const sellCount = data.results.filter((r) => r.action === '卖出' || r.action === '回避').length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="市场判断"
          value={<Badge variant={getMarketBiasVariant(data.marketBias)} size="md" glow={isCircuitBreaker}>{data.marketBias || '--'}</Badge>}
          hint={data.marketReason?.substring(0, 30)}
          tone={isCircuitBreaker ? 'danger' : data.marketBias.includes('强') ? 'success' : data.marketBias.includes('弱') ? 'warning' : 'default'}
        />
        <StatCard label="复盘时间" value={data.validateTime?.substring(5, 16) || '--'} hint={data.phaseLabel || ''} />
        <StatCard label="买入" value={buyCount} tone="success" />
        <StatCard label="观察" value={watchCount} tone="warning" />
        <StatCard label="卖出/回避" value={sellCount} tone="danger" />
      </div>

      {isCircuitBreaker && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          ⛔ <strong>大盘断路器触发</strong>：{data.marketReason}。所有买入建议已降级为观察，请勿盲目开仓。
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <Card title="历史复盘" subtitle="HISTORY" className="lg:col-span-1">
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {dates.length === 0 ? (
              <div className="text-sm text-secondary-text text-center py-4">暂无历史记录</div>
            ) : (
              dates.map((d) => {
                const isSelected = (d.timestamp || d.date) === selectedDate;
                return (
                  <button
                    key={d.timestamp || d.date}
                    onClick={() => onSelectDate(d.timestamp || d.date)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      isSelected
                        ? 'bg-cyan/15 text-cyan border border-cyan/30'
                        : 'text-secondary-text hover:bg-elevated/60 hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{d.label}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card title={`复核股票 (${data.results.length}只)`} subtitle={data.phaseLabel || 'PREMARKET'} className="lg:col-span-3">
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {data.results.map((stock) => (
              <PremarketStockCard key={stock.symbol} stock={stock} onNavigate={handleNavigateToChat} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
