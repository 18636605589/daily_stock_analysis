import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, TrendingUp, Sunrise, History, BarChart3, Trophy } from 'lucide-react';
import { aStockApi } from '../api/aStock';
import { getParsedApiError, type ParsedApiError } from '../api/error';
import { AppPage, PageHeader, Badge } from '../components/common';
import { NextRecommendations } from '../components/a-stock/NextRecommendations';
import { PremarketReview } from '../components/a-stock/PremarketReview';
import { StockHistory } from '../components/a-stock/StockHistory';
import { FactorIC } from '../components/a-stock/FactorIC';
import { Performance } from '../components/a-stock/Performance';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import type { AStockTabKey, DataStatusResponse, DailySnapshotResponse, DatedFileItem, FactorICResponse, NextRecommendationsResponse, PerformanceResponse, PremarketReviewResponse } from '../types/aStock';
import { cn } from '../utils/cn';

const TABS: { key: AStockTabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'next', label: '今日荐股', icon: <TrendingUp className="h-4 w-4" /> },
  { key: 'premarket', label: '盘前复盘', icon: <Sunrise className="h-4 w-4" /> },
  { key: 'history', label: '历史荐股', icon: <History className="h-4 w-4" /> },
  { key: 'factor_ic', label: '因子IC', icon: <BarChart3 className="h-4 w-4" /> },
  { key: 'performance', label: '绩效统计', icon: <Trophy className="h-4 w-4" /> },
];

export const AStockPage: React.FC = () => {
  const { t } = useUiLanguage();
  const [activeTab, setActiveTab] = useState<AStockTabKey>('next');
  const [status, setStatus] = useState<DataStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ParsedApiError | null>(null);

  const [nextData, setNextData] = useState<NextRecommendationsResponse | null>(null);
  const [premarketData, setPremarketData] = useState<PremarketReviewResponse | null>(null);
  const [premarketDates, setPremarketDates] = useState<DatedFileItem[]>([]);
  const [selectedPremarketDate, setSelectedPremarketDate] = useState<string>('');
  const [dailyDates, setDailyDates] = useState<DatedFileItem[]>([]);
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>('');
  const [dailySnapshot, setDailySnapshot] = useState<DailySnapshotResponse | null>(null);
  const [factorIcData, setFactorIcData] = useState<FactorICResponse | null>(null);
  const [perfData, setPerfData] = useState<PerformanceResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const st = await aStockApi.getStatus();
      setStatus(st);
      if (!st.available) {
        setLoading(false);
        return;
      }
      const [next, pmDates, pmLatest, dDates, ic, perf] = await Promise.all([
        aStockApi.getNext().catch(() => null),
        aStockApi.listPremarket().catch(() => []),
        aStockApi.getLatestPremarket().catch(() => null),
        aStockApi.listDaily().catch(() => []),
        aStockApi.getFactorIc().catch(() => null),
        aStockApi.getPerformance().catch(() => null),
      ]);
      setNextData(next);
      setPremarketDates(pmDates);
      setPremarketData(pmLatest);
      if (pmLatest) setSelectedPremarketDate(pmLatest.timestamp || pmLatest.date);
      setDailyDates(dDates);
      if (dDates.length > 0) {
        setSelectedDailyDate(dDates[0].date);
      }
      setFactorIcData(ic);
      setPerfData(perf);
    } catch (e) {
      setError(getParsedApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadPremarketDate = useCallback(async (date: string) => {
    try {
      const data = await aStockApi.getPremarket(date);
      setPremarketData(data);
      setSelectedPremarketDate(date);
    } catch (e) {
      setError(getParsedApiError(e));
    }
  }, []);

  const loadDailyDate = useCallback(async (date: string) => {
    setSelectedDailyDate(date);
    setDailySnapshot(null);
    try {
      const data = await aStockApi.getDaily(date);
      setDailySnapshot(data);
    } catch (e) {
      setError(getParsedApiError(e));
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history' && selectedDailyDate && !dailySnapshot) {
      loadDailyDate(selectedDailyDate);
    }
  }, [activeTab, selectedDailyDate, dailySnapshot, loadDailyDate]);

  const dataUnavailable = status && !status.available;

  const headerActions = (
    <button
      onClick={loadData}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-sm text-secondary-text hover:bg-elevated disabled:opacity-50 transition-colors"
    >
      <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
      {t('usage.refresh')}
    </button>
  );

  return (
    <AppPage>
      <PageHeader
        title="📈 A-Stock 智能荐股"
        description="来自 a_stock 量化选股引擎的每日推荐与复盘结果（已对齐 v3 契约）"
        actions={headerActions}
      />

      {dataUnavailable && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          ⚠️ A-Stock 数据目录不可用：<code className="text-xs">{status?.dataDir}</code>
          <br />请设置环境变量 <code className="text-xs">A_STOCK_ROOT</code> 指向 a_stock 项目根目录，或检查路径是否正确。
        </div>
      )}

      {error && !dataUnavailable && (
        <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          ❌ 数据加载错误: {error.message}
        </div>
      )}

      {status && status.available && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-secondary-text">
          <span>📂 数据源: <code className="text-foreground">{status.dataDir}</code></span>
          <span>·</span>
          <Badge variant="info" size="sm">历史日报 {status.dailyCount} 份</Badge>
          <Badge variant="info" size="sm">盘前复盘 {status.premarketDayCount ?? '--'} 天 / {status.premarketCount} 次</Badge>
          {status.schemaFamily && (
            <Badge variant={status.schemaFamily === 'v3' ? 'success' : 'default'} size="sm">
              契约 {status.schemaFamily}
            </Badge>
          )}
          {status.latestAsOfDate && (
            <span>最新 as_of: <code className="text-foreground">{status.latestAsOfDate}</code></span>
          )}
          {status.latestNextTradingDay && (
            <span>下一交易日: <code className="text-foreground">{status.latestNextTradingDay}</code></span>
          )}
          {status.schemaVersion && (
            <span className="font-mono opacity-80">{status.schemaVersion}</span>
          )}
        </div>
      )}

      {!dataUnavailable && (
        <>
          <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border/50 pb-0">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  activeTab === tab.key
                    ? 'border-cyan text-cyan'
                    : 'border-transparent text-secondary-text hover:text-foreground hover:border-border',
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div>
            {activeTab === 'next' && (
              <NextRecommendations data={nextData} loading={loading} error={error?.message ?? null} />
            )}
            {activeTab === 'premarket' && (
              <PremarketReview
                data={premarketData}
                dates={premarketDates}
                selectedDate={selectedPremarketDate}
                loading={loading}
                error={error?.message ?? null}
                onSelectDate={loadPremarketDate}
              />
            )}
            {activeTab === 'history' && (
              <StockHistory
                dates={dailyDates}
                selectedDate={selectedDailyDate}
                snapshot={dailySnapshot}
                performance={perfData?.items ?? []}
                loading={loading && !dailySnapshot}
                error={error?.message ?? null}
                onSelectDate={loadDailyDate}
              />
            )}
            {activeTab === 'factor_ic' && (
              <FactorIC data={factorIcData} loading={loading} error={error?.message ?? null} />
            )}
            {activeTab === 'performance' && (
              <Performance data={perfData} loading={loading} error={error?.message ?? null} />
            )}
          </div>
        </>
      )}
    </AppPage>
  );
};

export default AStockPage;
