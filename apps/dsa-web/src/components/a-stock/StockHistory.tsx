import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { StatCard } from '../common/StatCard';
import { EmptyState } from '../common/EmptyState';
import { Loading } from '../common/Loading';
import type { DailySnapshotResponse, DatedFileItem, PerformanceStockItem } from '../../types/aStock';
import { cleanStockCode, formatPct, getOperationVariant, pctClass, formatYmdDate } from './utils';

interface StockHistoryProps {
  dates: DatedFileItem[];
  selectedDate: string;
  snapshot: DailySnapshotResponse | null;
  performance: PerformanceStockItem[];
  loading: boolean;
  error: string | null;
  onSelectDate: (date: string) => void;
}

export const StockHistory: React.FC<StockHistoryProps> = ({
  dates, selectedDate, snapshot, performance, loading, error, onSelectDate,
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const displayCount = expanded ? undefined : 15;

  const handleNavigateToChat = (code: string, name: string) => {
    navigate(`/chat?stock=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`);
  };

  const perfMap = useMemo(() => {
    const map = new Map<string, PerformanceStockItem>();
    for (const p of performance) {
      const key = `${p.reportDate}_${p.symbol}`;
      if (!map.has(key)) map.set(key, p);
    }
    return map;
  }, [performance]);

  if (loading) return <Loading />;
  if (error) return <EmptyState title="数据加载失败" description={error} />;

  const stocks = snapshot?.factorData || [];
  const marketInfo = snapshot?.market || {};
  const envInfo = (marketInfo as Record<string, unknown>)?.market_environment || {};
  const icDiag = snapshot?.icDiagnostics || {};

  const stocksWithPerf = stocks.map((s) => {
    const key = `${selectedDate}_${s.symbol}`;
    return { ...s, perf: perfMap.get(key) };
  });

  const displayStocks = displayCount ? stocksWithPerf.slice(0, displayCount) : stocksWithPerf;

  return (
    <div className="space-y-5">
      {snapshot && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="快照日期" value={formatYmdDate(snapshot.asOfDate || selectedDate)} tone="primary" />
          <StatCard label="报告时间" value={snapshot.reportTime?.substring(5, 16) || '--'} />
          <StatCard
            label="市场环境"
            value={typeof envInfo === 'object' && envInfo !== null && 'bias' in envInfo ? String((envInfo as Record<string, unknown>).bias || '--') : '--'}
            tone={
              typeof envInfo === 'object' && envInfo !== null && 'bias' in envInfo
                ? String((envInfo as Record<string, unknown>).bias).includes('强')
                  ? 'success'
                  : String((envInfo as Record<string, unknown>).bias).includes('弱')
                  ? 'warning'
                  : 'default'
                : 'default'
            }
          />
          <StatCard label="候选股数" value={stocks.length} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <Card title="历史日期" subtitle="HISTORY" className="lg:col-span-1">
          <div className="space-y-1 max-h-[700px] overflow-y-auto">
            {dates.length === 0 ? (
              <div className="text-sm text-secondary-text text-center py-4">暂无历史数据</div>
            ) : (
              dates.map((d) => (
                <button
                  key={d.date}
                  onClick={() => { setExpanded(false); onSelectDate(d.date); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    d.date === selectedDate
                      ? 'bg-cyan/15 text-cyan border border-cyan/30'
                      : 'text-secondary-text hover:bg-elevated/60 hover:text-foreground'
                  }`}
                >
                  {formatYmdDate(d.date)}
                </button>
              ))
            )}
          </div>
        </Card>

        <Card title="当日荐股详情" subtitle="DAILY PICKS" className="lg:col-span-3">
          {!snapshot ? (
            <EmptyState title="请选择一个日期" description="从左侧列表选择查看历史荐股详情" />
          ) : (
            <>
              {Object.keys(icDiag).length > 0 && (
                <div className="mb-3 rounded-lg bg-elevated/40 p-3 text-xs text-secondary-text">
                  <strong className="text-foreground">IC诊断：</strong>
                  {'overall_validity' in icDiag && <span className="mr-3">整体有效性: {String(icDiag.overall_validity)}</span>}
                  {'effective_factor_count' in icDiag && <span>有效因子数: {String(icDiag.effective_factor_count)}</span>}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-xs text-secondary-text">
                      <th className="text-left py-2 px-2 font-medium">名称/代码</th>
                      <th className="text-right py-2 px-2 font-medium">综合分</th>
                      <th className="text-left py-2 px-2 font-medium">评级</th>
                      <th className="text-right py-2 px-2 font-medium">T+1</th>
                      <th className="text-right py-2 px-2 font-medium">T+5</th>
                      <th className="text-right py-2 px-2 font-medium">T+20</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayStocks.map((s) => {
                      const code = cleanStockCode(s.symbol);
                      return (
                        <tr key={s.symbol} className="border-b border-border/30 hover:bg-elevated/30">
                          <td className="py-2 px-2">
                            <div
                              className="font-medium text-foreground cursor-pointer hover:text-cyan transition-colors"
                              onClick={() => handleNavigateToChat(code, s.name)}
                            >
                              {s.name}
                            </div>
                            <div className="text-xs text-secondary-text font-mono">
                              {code} {s.industry}
                            </div>
                          </td>
                          <td className="text-right py-2 px-2 font-semibold text-cyan">{s.finalScore.toFixed(1)}</td>
                          <td className="py-2 px-2">
                            <Badge variant={getOperationVariant(s.operationRating)} size="sm">{s.operationRating || '--'}</Badge>
                          </td>
                          <td className={`text-right py-2 px-2 font-medium ${pctClass(s.perf?.retT1)}`}>{formatPct(s.perf?.retT1)}</td>
                          <td className={`text-right py-2 px-2 font-medium ${pctClass(s.perf?.retT5)}`}>{formatPct(s.perf?.retT5)}</td>
                          <td className={`text-right py-2 px-2 font-medium ${pctClass(s.perf?.retT20)}`}>{formatPct(s.perf?.retT20)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {stocks.length > (displayCount || 15) && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-3 w-full py-2 text-sm text-cyan hover:bg-cyan/10 rounded-lg transition-colors"
                >
                  {expanded ? '收起' : `展开全部 ${stocks.length} 只`}
                </button>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
};
