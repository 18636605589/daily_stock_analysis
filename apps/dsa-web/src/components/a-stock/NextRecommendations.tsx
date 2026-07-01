import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Tooltip } from '../common/Tooltip';
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

function getTechRatingDesc(rating: string): string {
  if (rating.startsWith('A')) return '技术面形态良好，短期走势健康';
  if (rating.startsWith('B')) return '技术面尚可，有一定机会但需确认';
  if (rating.startsWith('C')) return '技术面存在风险信号，需谨慎';
  return '技术面未评级';
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
  const rating = stock.operationRating || '待评估';
  let ratingDesc = '';
  if (rating.includes('买入') || rating.includes('积极') || rating.includes('可介入')) {
    ratingDesc = '✅ 操作建议：评分较高，形态良好，可以考虑关注或介入';
  } else if (rating.includes('关注') || rating.includes('企稳')) {
    ratingDesc = '👀 操作建议：可以加入自选观察，等待更好的入场时机';
  } else if (rating.includes('观察') || rating.includes('等待') || rating.includes('待确认')) {
    ratingDesc = '⚠️ 操作建议：暂时观望，等待信号更明确后再决策';
  } else if (rating.includes('谨慎') || rating.includes('偏弱') || rating.includes('回避')) {
    ratingDesc = '⛔ 操作建议：风险偏高，不建议追高，已有仓位注意风险';
  } else {
    ratingDesc = '操作建议待评估';
  }
  return (
    <div
      className="rounded-xl border border-border/50 bg-card/60 p-4 transition-all hover:border-cyan/30 hover:bg-card/80 cursor-pointer"
      onClick={() => onNavigate(code, stock.name)}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Tooltip content="点击进入个股详情页，查看AI深度分析">
              <span className="text-base font-semibold text-foreground truncate hover:text-cyan transition-colors cursor-help">{stock.name}</span>
            </Tooltip>
            <span className="text-xs text-secondary-text font-mono">{code}</span>
          </div>
          {stock.industry && <span className="text-xs text-secondary-text">{stock.industry}</span>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Tooltip content={ratingDesc}>
            <span className="inline-flex cursor-help">
              <Badge variant={getOperationVariant(stock.operationRating)} size="sm">{rating}</Badge>
            </span>
          </Tooltip>
          {stock.deepTechRating && (
            <Tooltip content={getTechRatingDesc(stock.deepTechRating)}>
              <span className="inline-flex cursor-help">
                <Badge variant={getTechVariant(stock.deepTechRating)} size="sm">{stock.deepTechRating}</Badge>
              </span>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div>
          <Tooltip content="综合评分 = 因子评分 + 短期评分加权，满分100分，越高越推荐" side="bottom">
            <div className="text-xs text-secondary-text cursor-help border-b border-dotted border-border/40 inline-block">综合评分</div>
          </Tooltip>
          <div className="text-lg font-semibold text-cyan">{stock.finalScore.toFixed(1)}</div>
        </div>
        <div>
          <Tooltip content="因子评分：把估值、动量、质量、波动率等多个量化因子，按「因子IC」里统计出的方向偏好（高好还是低好）和权重，标准化后加权得出的综合分。分数越高，说明这只股票在基本面/量化维度上越优质。满分100，和短期评分一起加权得到综合评分。" side="bottom">
            <div className="text-xs text-secondary-text cursor-help border-b border-dotted border-border/40 inline-block">因子评分</div>
          </Tooltip>
          <div className="text-sm font-medium text-foreground">{stock.factorScore.toFixed(1)}</div>
        </div>
        <div>
          <Tooltip content="短期评分：基于技术面（量价、均线、RSI等）的短期走势打分" side="bottom">
            <div className="text-xs text-secondary-text cursor-help border-b border-dotted border-border/40 inline-block">短期评分</div>
          </Tooltip>
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
      <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="text-sm text-foreground/90 leading-relaxed">
            <p className="font-semibold text-cyan mb-1">使用说明：</p>
            <ul className="space-y-1 text-secondary-text">
              <li>• 这里是收盘后量化模型筛选出的<strong className="text-foreground">次日候选股票</strong>，按综合评分从高到低排序；</li>
              <li>• <strong className="text-cyan">综合评分</strong>越高越值得关注，80分以上为优质标的；</li>
              <li>• 标签颜色：<span className="text-success font-medium">绿色=积极关注</span>，<span className="text-warning font-medium">黄色=观察等待</span>，<span className="text-danger font-medium">红色=谨慎回避</span>；</li>
              <li>• <strong className="text-foreground">点击任意股票卡片</strong>可跳转到问股页面进行AI深度分析；</li>
              <li>• 次日早上09:26集合竞价结束、09:35开盘后会有盘前复核更新最终建议，请关注「盘前复盘」。</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="报告日期" value={data.asOfDate || '--'} hint={`下一交易日: ${data.nextTradingDay || '--'}`} tone="primary" />
        <StatCard label="涨停家数" value={data.market?.limitUp ?? '--'} tone="success" hint="反映市场热度" />
        <StatCard label="跌停家数" value={data.market?.limitDown ?? '--'} tone={data.market && data.market.limitDown > 30 ? 'danger' : 'default'} hint="超过30家需警惕系统性风险" />
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
            💡 以上仅为量化模型初步筛选结果，不构成投资建议。请结合次日盘前复盘、大盘环境、自身风险承受能力综合决策，投资有风险，入市需谨慎。
          </div>
        </Card>
      </div>
    </div>
  );
};
