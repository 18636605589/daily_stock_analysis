import React from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Tooltip } from '../common/Tooltip';
import { StatCard } from '../common/StatCard';
import { EmptyState } from '../common/EmptyState';
import { Loading } from '../common/Loading';
import type { FactorICResponse } from '../../types/aStock';

const FACTOR_CN_NAMES: Record<string, string> = {
  factor_score: '因子综合评分',
  final_score: '最终综合评分',
  short_term_score: '短期技术评分',
  pe: '市盈率 PE',
  pb: '市净率 PB',
  roe: '净资产收益率 ROE',
  roa: '资产收益率 ROA',
  gross_margin: '毛利率',
  rev_growth: '营收增长率',
  div_yield: '股息率',
  mom_1m: '1月动量',
  mom_3m: '3月动量',
  vol_1m: '1月波动率',
  volume_ratio: '量比',
  deviation_ma20: 'MA20 偏离率',
};

const FACTOR_DESCRIPTIONS: Record<string, string> = {
  factor_score: '把所有有效量化因子按方向偏好和ICIR权重加权后的综合评分，满分100分。代表这只股票在量化选股模型中的基本面+量价综合得分。',
  final_score: '最终综合评分 = 因子评分 + 短期技术评分加权，是推荐排序的最终依据。',
  short_term_score: '短期技术面评分，基于量价、均线、RSI等技术指标给出的短期走势打分，满分100分。',
  pe: '市盈率（Price-to-Earnings）= 股价 ÷ 每股收益。估值类因子，一般越低越便宜，但要结合行业和成长性看。',
  pb: '市净率（Price-to-Book）= 股价 ÷ 每股净资产。估值类因子，越低说明股价相对账面价值越便宜，金融/周期股常用。',
  roe: '净资产收益率（Return on Equity）= 净利润 ÷ 股东权益。盈利能力因子，越高说明公司赚钱能力越强。',
  roa: '资产收益率（Return on Assets）= 净利润 ÷ 总资产。盈利能力因子，越高说明资产利用效率越高。',
  gross_margin: '毛利率 = （营收 - 成本）÷ 营收。盈利能力因子，越高说明产品附加值/议价能力越强。',
  rev_growth: '营收增长率 = 本期营收较上期的增长比例。成长类因子，越高说明公司扩张越快。',
  div_yield: '股息率 = 每股分红 ÷ 股价。收益类因子，越高说明分红回报越好，通常价值股特征。',
  mom_1m: '1月动量 = 过去1个月的股价涨跌幅。动量类因子，正动量代表上涨趋势，负动量代表下跌趋势。',
  mom_3m: '3月动量 = 过去3个月的股价涨跌幅。动量类因子，周期更长，趋势更稳定。',
  vol_1m: '1月波动率 = 过去1个月日收益率的标准差。风险类因子，越高说明股价波动越大、风险越高。',
  volume_ratio: '量比 = 当日成交量 ÷ 过去5日平均成交量。成交活跃度因子，越高说明放量越明显，可能有资金介入。',
  deviation_ma20: 'MA20 偏离率 = 当前股价 ÷ 20日均线 - 1。技术类因子，正值表示在均线上方（偏强），负值表示在均线下方（偏弱）。',
};

function getFactorCnName(factor: string): string {
  return FACTOR_CN_NAMES[factor] || factor;
}

function getFactorDescription(factor: string): string {
  return FACTOR_DESCRIPTIONS[factor] || '';
}

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

function getDirectionDesc(dir: string): string {
  if (dir === 'high') return '该因子数值越高，股票未来上涨概率越大 → 选股时优先选因子值高的';
  if (dir === 'low') return '该因子数值越低，股票未来上涨概率越大 → 选股时优先选因子值低的';
  return '该因子数值高低对选股没有明显方向性影响';
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

function ThWithTooltip({ label, tip }: { label: string; tip: string }) {
  return (
    <th className="text-right py-2 px-3 font-medium">
      <Tooltip content={tip} side="bottom">
        <span className="cursor-help border-b border-dotted border-border/60 hover:text-cyan transition-colors inline-flex items-center gap-1">
          {label}
          <span className="text-[10px] opacity-50">ⓘ</span>
        </span>
      </Tooltip>
    </th>
  );
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
      <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="text-sm text-foreground/90 leading-relaxed">
            <p className="font-semibold text-cyan mb-1">新手入门：怎么看这张表？</p>
            <p className="text-secondary-text">
              量化选股就像给学生考试打分——"因子"就是考试科目（比如估值、动量、成交量等），
              <strong className="text-foreground"> ICIR 是最重要的指标</strong>，
              相当于这门科目的"预测可信度"。
            </p>
            <ul className="mt-2 space-y-1 text-secondary-text">
              <li>✅ <strong className="text-success">有效因子（ICIR ≥ 1.0）</strong>：历史表现稳定，可以放心参考；</li>
              <li>⚠️ <strong className="text-warning">观察中（0 ≤ ICIR &lt; 1.0）</strong>：有一定参考价值，但还不够稳定，需结合其他因子；</li>
              <li>❌ <strong className="text-danger">反向因子（ICIR &lt; 0）</strong>：结论反过来用——它说"买"你要小心，它说"卖"反而可能是机会。</li>
            </ul>
            <p className="mt-2 text-xs text-secondary-text">
              简单来说：<strong className="text-foreground">你只需要重点关注标有 ✅ 有效的因子</strong>，
              它们的方向偏好（偏好高值/低值）指导了你应该选什么样特征的股票。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="统计截止日期" value={data.latestDate ? `${data.latestDate.slice(0, 4)}-${data.latestDate.slice(4, 6)}-${data.latestDate.slice(6, 8)}` : '--'} tone="primary" />
        <StatCard
          label="跟踪因子总数"
          value={total}
          hint="正在监控的量化指标数量"
        />
        <StatCard
          label="✅ 有效因子"
          value={effective}
          tone={effective > 0 ? 'success' : 'default'}
          hint={`ICIR ≥ 1.0，预测能力稳定可靠${effective > 0 ? `，占比 ${(effective / total * 100).toFixed(0)}%` : ''}`}
        />
        <StatCard
          label="❌ 反向因子"
          value={negative}
          tone={negative > 0 ? 'danger' : 'default'}
          hint="ICIR &lt; 0，需要反向理解"
        />
      </div>

      <Card title="因子 IC 详情" subtitle="FACTOR IC TRACKING">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-xs text-secondary-text">
                <th className="text-left py-2 px-3 font-medium">
                  <Tooltip content="量化因子的中文名称和英文标识。悬停可查看该因子的具体含义（如估值、动量、质量、波动率等选股维度）" side="bottom">
                    <span className="cursor-help border-b border-dotted border-border/60 hover:text-cyan transition-colors inline-flex items-center gap-1">
                      因子名称
                      <span className="text-[10px] opacity-50">ⓘ</span>
                    </span>
                  </Tooltip>
                </th>
                <th className="text-center py-2 px-3 font-medium">
                  <Tooltip content="方向偏好 = 历史上这个因子的数值高低，和股票未来涨跌的相关性方向。是用过去N天的因子值和次日收益率做相关性统计得出的：正相关=偏好高值，负相关=偏好低值。" side="bottom">
                    <span className="cursor-help border-b border-dotted border-border/60 hover:text-cyan transition-colors inline-flex items-center gap-1">
                      方向偏好
                      <span className="text-[10px] opacity-50">ⓘ</span>
                    </span>
                  </Tooltip>
                </th>
                <ThWithTooltip label="IC均值" tip="信息系数均值：衡量因子预测涨跌的准确性。正值越大越准，负值表示反向。一般 &gt;0.03 就有参考价值" />
                <ThWithTooltip label="IC标准差" tip="IC值的波动幅度：越小说明因子表现越稳定，不会时灵时不灵" />
                <ThWithTooltip label="ICIR ⭐" tip="IC信息比率 = IC均值 ÷ IC标准差。这是最重要的指标！≥1.0=稳定有效；0~1=观察中；&lt;0=应反向使用" />
                <ThWithTooltip label="样本天数" tip="用于统计的历史交易日数量，天数越多结论越可靠" />
                <th className="text-center py-2 px-3 font-medium">
                  <Tooltip content="根据ICIR值给出的直观结论，帮助你快速判断" side="bottom">
                    <span className="cursor-help border-b border-dotted border-border/60 hover:text-cyan transition-colors inline-flex items-center gap-1">
                      有效性
                      <span className="text-[10px] opacity-50">ⓘ</span>
                    </span>
                  </Tooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((f) => {
                const icir = f.icir;
                const isEffective = icir !== null && icir !== undefined && icir >= 1.0;
                const isNegative = icir !== null && icir !== undefined && icir < 0;
                let effectivenessTip = '';
                if (isEffective) {
                  effectivenessTip = '✅ 该因子历史预测稳定，可以作为选股的重要参考';
                } else if (isNegative) {
                  effectivenessTip = '❌ 该因子结论反向：数值高反而要小心，数值低反而可能是机会';
                } else {
                  effectivenessTip = '⚠️ 该因子有一定预测能力但还不够稳定，建议结合其他因子一起看';
                }
                return (
                  <tr key={f.factor} className="border-b border-border/30 hover:bg-elevated/30">
                    <td className="py-2 px-3">
                      <Tooltip content={getFactorDescription(f.factor) || f.factor}>
                        <div className="cursor-help">
                          <div className="font-medium text-foreground inline-flex items-center gap-1">
                            {getFactorCnName(f.factor)}
                            <span className="text-[10px] opacity-50">ⓘ</span>
                          </div>
                          <div className="text-xs text-secondary-text font-mono">{f.factor}</div>
                        </div>
                      </Tooltip>
                    </td>
                    <td className="text-center py-2 px-3">
                      <Tooltip content={getDirectionDesc(f.direction)}>
                        <span className="inline-flex cursor-help">
                          <Badge variant={getDirectionVariant(f.direction)} size="sm">{getDirectionLabel(f.direction)}</Badge>
                        </span>
                      </Tooltip>
                    </td>
                    <td className={`text-right py-2 px-3 font-mono ${(f.icMean ?? 0) >= 0 ? 'text-danger' : 'text-success'}`}>
                      <Tooltip content={Math.abs(f.icMean ?? 0) >= 0.05 ? 'IC均值较强' : Math.abs(f.icMean ?? 0) >= 0.03 ? 'IC均值中等' : 'IC均值偏弱，单独使用效果有限'}>
                        <span className="cursor-help">{formatNum(f.icMean)}</span>
                      </Tooltip>
                    </td>
                    <td className="text-right py-2 px-3 font-mono text-secondary-text">{formatNum(f.icStd)}</td>
                    <td className={`text-right py-2 px-3 font-mono font-semibold ${isEffective ? 'text-success' : isNegative ? 'text-danger' : 'text-warning'}`}>
                      <Tooltip content={isEffective ? 'ICIR ≥ 1.0，因子稳定有效' : isNegative ? 'ICIR < 0，因子反向，需反着看' : '0 ≤ ICIR < 1，因子有潜力但还需观察'}>
                        <span className="cursor-help">{formatNum(icir, 2)}</span>
                      </Tooltip>
                    </td>
                    <td className="text-right py-2 px-3 text-secondary-text">
                      <Tooltip content={`基于 ${f.nDays} 个交易日的历史数据统计${f.nDays >= 60 ? '，样本充足，结论可靠' : f.nDays >= 30 ? '，样本基本够用' : '，样本偏少，结论需谨慎参考'}`}>
                        <span className="cursor-help">{f.nDays}</span>
                      </Tooltip>
                    </td>
                    <td className="text-center py-2 px-3">
                      <Tooltip content={effectivenessTip}>
                        <span className="inline-flex cursor-help">
                          {isEffective ? (
                            <Badge variant="success" size="sm">✅ 有效</Badge>
                          ) : isNegative ? (
                            <Badge variant="danger" size="sm">❌ 反向</Badge>
                          ) : (
                            <Badge variant="warning" size="sm">⚠️ 观察</Badge>
                          )}
                        </span>
                      </Tooltip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 rounded-lg bg-elevated/40 p-3 text-xs text-secondary-text leading-relaxed">
          <p className="font-medium text-foreground mb-1">📖 术语大白话翻译：</p>
          <ul className="space-y-1 ml-1">
            <li>• <strong className="text-foreground">因子</strong>：一个选股指标/考试科目，比如"市盈率越低越好"就是一个因子；</li>
            <li>• <strong className="text-foreground">方向偏好</strong>：这个因子是"越高越涨"还是"越低越涨"？是用历史数据做相关性统计算出来的，不是拍脑袋定的；</li>
            <li>• <strong className="text-foreground">IC（信息系数）</strong>：因子预测股票涨跌的准确率，像考试的"分数"，越高越准；</li>
            <li>• <strong className="text-foreground">ICIR（信息比率）⭐</strong>：因子的"综合可信度"，考虑了预测准不准 AND 稳不稳定，是你最该看的指标；</li>
            <li>• <strong className="text-foreground">和「今日荐股」的关系</strong>：荐股里的"因子评分"，就是把这页所有有效因子，按方向偏好和ICIR权重，给每只股票打的综合分。</li>
            <li>• <strong className="text-foreground">实战建议</strong>：优先选择 ICIR ≥ 1.0（✅ 有效）且方向偏好与个股特征匹配的股票；ICIR &lt; 0 的因子反着用即可。</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};
