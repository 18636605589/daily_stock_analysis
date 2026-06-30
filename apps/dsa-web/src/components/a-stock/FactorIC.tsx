import React from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { StatCard } from '../common/StatCard';
import { EmptyState } from '../common/EmptyState';
import { Loading } from '../common/Loading';
import type { FactorICResponse } from '../../types/aStock';

interface FactorICProps {
  data: FactorICResponse | null;
  loading: boolean;
  error: string | null;
}

function getDirectionLabel(dir: string): string {
  if (dir === 'high') return '偏好高值';
  if (dir === 'low') return '偏好低值';
  return '中性';
}

function getDirectionVariant(dir: string): 'success' | 'warning' | 'info' | 'default' {
  if (dir === 'high') return 'success';
  if (dir === 'low') return 'info';
  return 'default';
}

function formatNum(v: number | null | undefined, digits: number = 3): string {
  if (v === null || v === undefined) return '--';
  return v.toFixed(digits);
}

export const FactorIC: React.FC<FactorICProps> = ({ data, loading, error }) => {
  if (loading) return <Loading />;
  if (error) return <EmptyState title="数据加载失败" description={error} />;
  if (!data || !data.items.length) return <EmptyState title="暂无因子IC数据" description="等待 IC 统计脚本积累足够数据" />;

  const effective = data.items.filter((f) => (f.icir ?? 0) >= 1.0).length;
  const negative = data.items.filter((f) => (f.icir ?? 0) < 0).length;
  const total = data.items.length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="最新日期" value={data.latestDate ? `${data.latestDate.slice(0, 4)}-${data.latestDate.slice(4, 6)}-${data.latestDate.slice(6, 8)}` : '--'} tone="primary" />
        <StatCard label="因子总数" value={total} />
        <StatCard label="有效因子 (ICIR≥1.0)" value={effective} tone={effective > 0 ? 'success' : 'default'} />
        <StatCard label="负向因子 (ICIR<0)" value={negative} tone={negative > 0 ? 'danger' : 'default'} />
      </div>

      <Card title="因子 IC 详情" subtitle="FACTOR IC TRACKING">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-xs text-secondary-text">
                <th className="text-left py-2 px-3 font-medium">因子名称</th>
                <th className="text-center py-2 px-3 font-medium">方向偏好</th>
                <th className="text-right py-2 px-3 font-medium">IC均值</th>
                <th className="text-right py-2 px-3 font-medium">IC标准差</th>
                <th className="text-right py-2 px-3 font-medium">ICIR</th>
                <th className="text-right py-2 px-3 font-medium">样本天数</th>
                <th className="text-center py-2 px-3 font-medium">有效性</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((f) => {
                const icir = f.icir;
                const isEffective = icir !== null && icir !== undefined && icir >= 1.0;
                const isNegative = icir !== null && icir !== undefined && icir < 0;
                return (
                  <tr key={f.factor} className="border-b border-border/30 hover:bg-elevated/30">
                    <td className="py-2 px-3 font-medium text-foreground">{f.factor}</td>
                    <td className="text-center py-2 px-3">
                      <Badge variant={getDirectionVariant(f.direction)} size="sm">{getDirectionLabel(f.direction)}</Badge>
                    </td>
                    <td className={`text-right py-2 px-3 font-mono ${(f.icMean ?? 0) >= 0 ? 'text-danger' : 'text-success'}`}>{formatNum(f.icMean)}</td>
                    <td className="text-right py-2 px-3 font-mono text-secondary-text">{formatNum(f.icStd)}</td>
                    <td className={`text-right py-2 px-3 font-mono font-semibold ${isEffective ? 'text-success' : isNegative ? 'text-danger' : 'text-warning'}`}>{formatNum(icir, 2)}</td>
                    <td className="text-right py-2 px-3 text-secondary-text">{f.nDays}</td>
                    <td className="text-center py-2 px-3">
                      {isEffective ? (
                        <Badge variant="success" size="sm">✅ 有效</Badge>
                      ) : isNegative ? (
                        <Badge variant="danger" size="sm">❌ 反向</Badge>
                      ) : (
                        <Badge variant="warning" size="sm">⚠️ 观察</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-secondary-text">
          📖 IC（信息系数）衡量因子预测能力，ICIR = IC均值/IC标准差，ICIR ≥ 1.0 表示因子稳定有效；ICIR &lt; 0 表示因子反向（应反向使用）。
        </div>
      </Card>
    </div>
  );
};
