# A-Stock 集成说明

本仓库通过**读取磁盘契约文件**对接本地 `a_stock` 量化选股引擎（不发起远程 API 调用）。

## 配置

| 项 | 说明 |
| --- | --- |
| `A_STOCK_ROOT` | `a_stock` 项目根目录。未配置时使用服务内默认路径（本机开发默认值，生产务必显式配置）。 |

见 `.env.example` 中的注释示例。

## 契约路径（相对 `A_STOCK_ROOT`）

| 路径 | 用途 |
| --- | --- |
| `state/next_trading_day.json` | 次日荐股精简 payload（盘前固定入口） |
| `data/daily/YYYYMM/a_stock_data_YYYYMMDD_HHMM.json` | 收盘历史快照 |
| `data/premarket/YYYYMM/a_stock_premarket_validate_*.json` | 盘前/盘中复核 |
| `reports/track/factor_ic_history.csv` | 因子 IC 时间序列 |
| `reports/track/top15_performance.csv` | 推荐绩效（历史文件名；内容为 TOP-N） |

## API

前缀：`/api/v1/a-stock`（需管理员会话 Cookie）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/status` | 目录可用性、schema 家族、最新 as_of |
| GET | `/next` | 次日荐股（含 pool_source / shortlist） |
| GET | `/premarket/list` | 复盘时间点列表 |
| GET | `/premarket/latest` | 最新复盘 |
| GET | `/premarket/{date}` | 指定日期/时间点复盘 |
| GET | `/daily/list` | 历史日报日期 |
| GET | `/daily/{date}` | 指定日快照（含 shortlist 块） |
| GET | `/factor-ic` | 因子 IC + v3 历史元信息 |
| GET | `/performance` | 绩效（净收益优先 + 精选/shortlist 统计） |

实现：

- 服务层：`src/services/a_stock_service.py`
- Schema：`api/v1/schemas/a_stock.py`
- 路由：`api/v1/endpoints/a_stock.py`
- Web：`apps/dsa-web` 路由 `/a-stock`

## v3 对齐要点

1. **schema 感知**：解析 `schema_version`，暴露 `schema_family`（`v3` / `legacy` / `unknown`）。
2. **池来源**：`pool_source`、`shortlist_score`；精选票在 next/daily 列表中置顶。
3. **Shortlist 块**：daily 快照返回 `shortlist.{enabled,count,items,meta}`。
4. **盘前竞价字段**：`auction_strength` / `auction_score` / `open_gap_pct` / `bid_ask_ratio` 等。
5. **绩效口径**：
   - 主列优先 `*_net`（净收益），毛收益在 `*_gross`；
   - 统计拆分 `stats` / `actionable_stats` / `shortlist_stats`；
   - 字段 `is_actionable`、`is_shortlist`、`deep_tech_rating`。
6. **因子 IC 历史**：v3 改版后从空表重算；API 返回 `history_restarted` + `history_note`，勿与旧 archive 混用。

## 兼容策略

- **向后兼容**：旧字段仍可读；新字段缺失时用空串 / `null` / 默认统计。
- **不 fail-fast**：目录不存在时 `/status.available=false`；业务接口返回 503/404。
- **action 归一化**：盘前 `action` 映射为 `buy|watch|avoid`，未知文案归 `watch`。

## 本地验证

```bash
# 单元测试（假数据树）
python -m pytest tests/test_a_stock_service.py -q

# 对真实目录冒烟（需本机有 a_stock 产出）
A_STOCK_ROOT=/path/to/a_stock python - <<'PY'
from pathlib import Path
from src.services.a_stock_service import AStockService
svc = AStockService()
print(svc.get_data_status())
print((svc.get_next_recommendations() or {}).get("shortlist_count"))
print((svc.get_performance() or {}).get("actionable_stats"))
PY
```
