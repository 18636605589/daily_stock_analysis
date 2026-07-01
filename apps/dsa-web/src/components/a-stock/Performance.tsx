import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Tooltip } from '../common/Tooltip';
import { StatCard } from '../common/StatCard';
import { EmptyState } from '../common/EmptyState';
import { Loading } from '../common/Loading';
import type { PerformanceResponse } from '../../types/aStock';
import { cleanStockCode, formatPct, pctClass, formatYmdDate, getOperationVariant } from './utils';

interface PerformanceProps {
  data: PerformanceResponse | null;
  loading: boolean;
  error: string | null;
}

type FilterKey = 'all' | '买入' | '观察' | '谨慎' | '回避' | '持仓';

function ThHelp({ label, tip, align = 'right' }: { label: string; tip: string; align?: 'left' | 'center' | 'right' }) {
  const alignCls = align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right';
  return (
    <th className={`${alignCls} py-2 px-2 font-medium`}>
      <Tooltip content={tip} side="bottom">
        <span className="cursor-help border-b border-dotted border-border/60 hover:text-cyan transition-colors inline-flex items-center gap-1">
          {label}
          <span className="text-[9px] opacity-40">ⓘ</span>
        </span>
      </Tooltip>
    </th>
  );
}

function matchRating(rating: string, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === '买入') return rating.includes('买入') || rating.includes('积极') || rating.includes('可介入');
  if (filter === '观察') return rating.includes('观察') || rating.includes('关注') || rating.includes('等待') || rating.includes('待确认');
  if (filter === '谨慎') return rating.includes('谨慎');
  if (filter === '回避') return rating.includes('回避') || rating.includes('不建议');
  if (filter === '持仓') return rating.includes('持仓') || rating.includes('持有');
  return false;
}

export const Performance: React.FC<PerformanceProps> = ({ data, loading, error }) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [showAll, setShowAll] = useState(false);

  const handleNavigateToChat = (code: string, name: string) => {
    navigate(`/chat?stock=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`);
  };

  const items = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((it) => matchRating(it.operationRating, filter));
  }, [data, filter]);

  const displayItems = showAll ? items : items.slice(0, 50);

  if (loading) return <Loading />;
  if (error) return <EmptyState title="数据加载失败" description={error} />;
  if (!data || !data.items.length) return <EmptyState title="暂无绩效数据" description="等待追踪脚本积累推荐结果的后续表现数据" />;

  const stats = data.stats;
  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: '买入', label: '买入' },
    { key: '观察', label: '观察' },
    { key: '谨慎', label: '谨慎' },
    { key: '回避', label: '回避' },
    { key: '持仓', label: '持仓' },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="text-sm text-foreground/90 leading-relaxed">
            <p className="font-semibold text-cyan mb-1">绩效追踪说明：</p>
            <ul className="space-y-1 text-secondary-text">
              <li>• 这里记录了所有历史荐股在<strong className="text-foreground">推荐后1天(T+1)、5天(T+5)、20天(T+20)</strong>的实际涨跌幅表现；</li>
              <li>• <strong className="text-foreground">胜率</strong>：盈利次数占总推荐次数的比例，超过50%说明模型整体能赚钱；</li>
              <li>• <strong className="text-foreground">超额收益</strong>：相对沪深300指数的收益，为正说明跑赢大盘；</li>
              <li>• <span className="text-danger font-medium">红色=盈利</span>，<span className="text-success font-medium">绿色=亏损</span>（遵循A股红涨绿跌习惯）；</li>
              <li>• 可以通过上方按钮筛选不同评级的历史表现，验证哪类建议最靠谱。</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="总推荐次数" value={stats.totalCount} tone="primary" hint="累计推荐股票次数" />
        <StatCard
          label="平均 T+1 收益"
          value={formatPct(stats.avgRetT1)}
          tone={stats.avgRetT1 !== null && stats.avgRetT1 !== undefined ? (stats.avgRetT1 > 0 ? 'success' : 'danger') : 'default'}
          hint="推荐后次日收盘平均收益"
        />
        <StatCard
          label="平均 T+5 收益"
          value={formatPct(stats.avgRetT5)}
          tone={stats.avgRetT5 !== null && stats.avgRetT5 !== undefined ? (stats.avgRetT5 > 0 ? 'success' : 'danger') : 'default'}
          hint="推荐后5个交易日平均收益"
        />
        <StatCard
          label="T+1 胜率"
          value={stats.winRateT1 !== null && stats.winRateT1 !== undefined ? `${stats.winRateT1.toFixed(1)}%` : '--'}
          tone={stats.winRateT1 !== null && stats.winRateT1 !== undefined && stats.winRateT1 > 50 ? 'success' : 'warning'}
          hint="次日收盘盈利的比例"
        />
        <StatCard
          label="T+5 胜率"
          value={stats.winRateT5 !== null && stats.winRateT5 !== undefined ? `${stats.winRateT5.toFixed(1)}%` : '--'}
          tone={stats.winRateT5 !== null && stats.winRateT5 !== undefined && stats.winRateT5 > 50 ? 'success' : 'warning'}
          hint="5日后盈利的比例"
        />
      </div>

      <Card title="推荐绩效明细" subtitle="PERFORMANCE TRACKING">
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setShowAll(false); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-cyan/20 text-cyan border border-cyan/40'
                  : 'bg-elevated/60 text-secondary-text border border-border/50 hover:text-foreground'
              }`}
            >
              {f.label}
              {f.key !== 'all' && (
                <span className="ml-1 opacity-70">
                  {data.items.filter((it) => matchRating(it.operationRating, f.key)).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card/95 backdrop-blur-sm">
              <tr className="border-b border-border/50 text-xs text-secondary-text">
                <ThHelp label="日期" tip="荐股报告发布日期" align="left" />
                <th className="text-left py-2 px-2 font-medium">股票</th>
                <th className="text-center py-2 px-2 font-medium">评级</th>
                <ThHelp label="推荐价" tip="报告发布当日收盘价，作为收益计算基准" />
                <ThHelp label="T+1" tip="推荐后次日收盘相对推荐价的涨跌幅" />
                <ThHelp label="T+1超额" tip="T+1收益减去同期沪深300涨跌幅，正值=跑赢大盘" />
                <ThHelp label="T+5" tip="推荐后5个交易日收盘的累计涨跌幅" />
                <ThHelp label="T+5超额" tip="T+5收益减去同期沪深300涨跌幅" />
                <ThHelp label="T+20" tip="推荐后20个交易日（约1个月）的累计涨跌幅" />
                <ThHelp label="T+20超额" tip="T+20收益减去同期沪深300涨跌幅" />
              </tr>
            </thead>
            <tbody>
              {displayItems.map((it, idx) => {
                const code = cleanStockCode(it.symbol);
                return (
                  <tr key={`${it.reportDate}_${it.symbol}_${idx}`} className="border-b border-border/30 hover:bg-elevated/30">
                    <td className="py-2 px-2 text-secondary-text font-mono text-xs">{formatYmdDate(it.reportDate)}</td>
                    <td className="py-2 px-2">
                      <div
                        className="font-medium text-foreground cursor-pointer hover:text-cyan transition-colors"
                        onClick={() => handleNavigateToChat(code, it.name)}
                      >
                        {it.name}
                      </div>
                      <div className="text-xs text-secondary-text font-mono">
                        {code} {it.industry}
                      </div>
                    </td>
                  <td className="text-center py-2 px-2">
                    <Badge variant={getOperationVariant(it.operationRating)} size="sm">{it.operationRating || '--'}</Badge>
                  </td>
                  <td className="text-right py-2 px-2 text-foreground font-mono">{it.priceAtRec?.toFixed(2) ?? '--'}</td>
                  <td className={`text-right py-2 px-2 font-mono font-medium ${pctClass(it.retT1)}`}>{formatPct(it.retT1)}</td>
                  <td className={`text-right py-2 px-2 font-mono text-xs ${pctClass(it.excessT1)}`}>{formatPct(it.excessT1)}</td>
                  <td className={`text-right py-2 px-2 font-mono font-medium ${pctClass(it.retT5)}`}>{formatPct(it.retT5)}</td>
                  <td className={`text-right py-2 px-2 font-mono text-xs ${pctClass(it.excessT5)}`}>{formatPct(it.excessT5)}</td>
                  <td className={`text-right py-2 px-2 font-mono font-medium ${pctClass(it.retT20)}`}>{formatPct(it.retT20)}</td>
                  <td className={`text-right py-2 px-2 font-mono text-xs ${pctClass(it.excessT20)}`}>{formatPct(it.excessT20)}</td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
        {items.length > 50 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-3 w-full py-2 text-sm text-cyan hover:bg-cyan/10 rounded-lg transition-colors"
          >
            {showAll ? `收起 (显示前50条)` : `展开全部 ${items.length} 条记录`}
          </button>
        )}
        <div className="mt-3 text-xs text-secondary-text">
          💡 收益已扣除手续费；超额收益为相对沪深300的超额收益。红色=盈利，绿色=亏损（A股习惯）。
        </div>
      </Card>
    </div>
  );
};
