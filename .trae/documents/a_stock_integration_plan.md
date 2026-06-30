# A-Stock 荐股集成方案（方案 A：轻量级数据契约）

## 一、调研结论

### a_stock 侧（数据生产方）— 数据契约已就绪

| 数据类型 | 路径模式 | 内容 |
|---------|---------|------|
| 次日荐股（固定入口） | `state/next_trading_day.json` | 30只候选股、市场指数涨跌停数据、因子/技术评分、操作评级 |
| 完整收盘快照（历史） | `data/daily/YYYYMM/a_stock_data_YYYYMMDD_HHMM.json` | 50只因子候选+100只技术扫描、市场环境、风险评估、IC诊断、龙虎榜等 |
| 盘前复核结果（历史） | `data/premarket/YYYYMM/a_stock_premarket_validate_YYYYMMDD_HHMM.json` | 当日10只复核结果、市场多空判断、操作建议(买/观/卖)、具体原因、量价状态、MA5偏离等 |
| 最新快照别名 | `data/a_stock_data_latest.json` | 指向最近一次收盘分析完整JSON |
| 收盘日报 | `reports/daily/YYYYMM/a_stock_report_*.md` | Markdown格式日报 |
| 盘前复盘报告 | `reports/premarket/YYYYMM/a_stock_premarket_validate_*.md` | Markdown格式盘前复盘 |
| 因子IC历史 | `reports/track/factor_ic_history.csv` | 各因子IC均值、标准差、ICIR、样本天数 |
| 推荐绩效追踪 | `reports/track/top15_performance.csv` | T1/T5/T20收益率、超额收益、净收益（含手续费） |

### DSA 侧（展示方）— 架构模式清晰

- **后端**：FastAPI 模块化架构
  - 路由：`api/v1/endpoints/` + `api/v1/router.py` 聚合
  - Schema：`api/v1/schemas/` Pydantic 模型（snake_case → camelCase 自动转换）
  - 服务：`src/services/` 业务逻辑层
  - 认证：`APIKeyCookie` 会话鉴权
- **前端**：React + TypeScript + Tailwind
  - 路由：`App.tsx` 中 lazy load 页面组件
  - API：`src/api/` 层封装 axios，snake_case ↔ camelCase 转换
  - 类型：`src/types/` TypeScript 类型定义
  - 组件：`src/components/common/` 公共组件（Card、Badge、StatCard、EmptyState、Pagination等）
  - 导航：`SidebarNav.tsx` 侧边栏菜单配置
  - 页面：`src/pages/` 独立页面组件
- **配置**：`.env` 文件 + `src/config.py` 管理，系统配置页面可修改

---

## 二、功能设计

新增一个统一的「荐股」页面，包含 **5 个 Tab 区域**：

### Tab 1: 📌 今日荐股（Next Recommendations）
- 读取 `state/next_trading_day.json`
- 顶部展示：市场概况（四大指数涨跌幅、涨跌停家数）、报告日期/下一交易日
- 主体展示：30只候选股卡片列表
  - 股票代码/名称/行业、因子评分、综合评分、短期评分
  - 操作评级（颜色标签：买入=绿、观察=黄、谨慎=橙、回避=红）
  - 深度技术评级（A/B/C）+ 技术信号简述
- 底部提示：次日早上盘前复核会更新最终操作建议

### Tab 2: 🌅 盘前复盘（Premarket Review）
- 默认展示**当日最新**盘前复核结果（从 `data/premarket/` 扫描最新文件）
- 顶部展示：
  - 复盘时间、阶段（开盘前/开盘确认）、置信度
  - 市场多空判断（强/中/弱/极弱）+ 判断原因，含断路器警告标识
- 主体展示：10只复核股票卡片
  - 股票名称/代码、操作建议（买入/观察/卖出）
  - 量价组合状态（📈放量上涨/🔍缩量回调/⚪量能正常/⚠️缩量上涨/📉放量下跌）
  - 具体决策原因（含MA5/MA20支撑、量比、涨跌幅等）
  - 仓位建议、参考价格
- 历史选择器：下拉选择历史日期查看过往复盘记录

### Tab 3: 📜 历史荐股（History）
- 左侧：日期列表（从 `data/daily/` 扫描所有历史快照，按日期倒序）
- 右侧：选中日期的荐股详情
  - 市场环境、IC诊断摘要
  - 当日 Top N 推荐股票表格
  - 结合 `top15_performance.csv` 显示该批次股票后续表现（T1/T5/T20收益率）
- 股票详情可点击展开查看技术评分详情

### Tab 4: 📊 因子IC追踪（Factor IC）
- 读取 `factor_ic_history.csv`
- 表格展示：各因子最新IC均值、ICIR、方向偏好（高/低/中性）、样本天数
- 高亮 ICIR > 1.0 的有效因子和 ICIR < 0 的负向因子
- 可选：简单的趋势指示（↑/↓/→ 相比上次变化方向）

### Tab 5: 🏆 绩效统计（Performance）
- 读取 `top15_performance.csv`
- 顶部统计卡片：总推荐次数、平均T1收益率、平均T5收益率、胜率统计
- 表格展示：每只推荐股票的T1/T5/T20收益率和超额收益
- 按操作评级分组展示绩效差异

---

## 三、需要修改/新增的文件

### 后端（Python/FastAPI）

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| **新增** | `src/services/a_stock_service.py` | A-Stock 数据读取服务层（扫描目录、解析JSON/CSV、构建响应数据） |
| **新增** | `api/v1/schemas/a_stock.py` | Pydantic 响应模型（荐股列表、盘前复盘、历史记录、IC数据、绩效统计） |
| **新增** | `api/v1/endpoints/a_stock.py` | API 端点（8个GET接口） |
| **修改** | `api/v1/router.py` | 注册 a_stock 路由（prefix="/a-stock", tags=["AStock"]） |
| **修改** | `src/config.py` | 添加 `A_STOCK_DATA_DIR` 配置项，支持环境变量覆盖 |

#### API 端点设计

```
GET /api/v1/a-stock/next              → 今日荐股（next_trading_day.json）
GET /api/v1/a-stock/premarket/latest  → 最新盘前复盘结果
GET /api/v1/a-stock/premarket/list    → 盘前复盘历史日期列表
GET /api/v1/a-stock/premarket/{date}  → 指定日期盘前复盘
GET /api/v1/a-stock/daily/list        → 历史荐股日期列表
GET /api/v1/a-stock/daily/{date}      → 指定日期荐股详情
GET /api/v1/a-stock/factor-ic         → 因子IC追踪数据
GET /api/v1/a-stock/performance       → 推荐绩效统计数据
```

### 前端（React/TypeScript）

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| **新增** | `src/types/aStock.ts` | TypeScript 类型定义 |
| **新增** | `src/api/aStock.ts` | API 客户端封装 |
| **新增** | `src/pages/AStockPage.tsx` | 主页面（含Tab切换） |
| **新增** | `src/components/a-stock/NextRecommendations.tsx` | 今日荐股Tab组件 |
| **新增** | `src/components/a-stock/PremarketReview.tsx` | 盘前复盘Tab组件 |
| **新增** | `src/components/a-stock/StockHistory.tsx` | 历史荐股Tab组件 |
| **新增** | `src/components/a-stock/FactorIC.tsx` | 因子IC追踪Tab组件 |
| **新增** | `src/components/a-stock/Performance.tsx` | 绩效统计Tab组件 |
| **修改** | `src/App.tsx` | 添加 `/a-stock` 路由，lazy load AStockPage |
| **修改** | `src/components/layout/SidebarNav.tsx` | 添加「荐股」导航菜单项（icon: TrendingUp） |
| **修改** | `src/i18n/uiText.ts` | 添加 i18n 文本键值 |

---

## 四、实施步骤（按顺序执行）

### Phase 1: 后端基础（数据层 + API）

1. **配置项**：在 `src/config.py` 添加 `A_STOCK_DATA_DIR` 配置，默认值 `/Users/zilong/Documents/hermes/a_stock`，支持环境变量 `A_STOCK_ROOT` 覆盖
2. **Schema**：创建 `api/v1/schemas/a_stock.py`，定义所有响应模型
3. **Service**：创建 `src/services/a_stock_service.py`，实现所有数据读取方法
4. **Endpoint**：创建 `api/v1/endpoints/a_stock.py`，注册 8 个 GET 接口
5. **路由注册**：修改 `api/v1/router.py`，include a_stock router

### Phase 2: 前端页面

6. **类型定义**：创建 `src/types/aStock.ts`
7. **API 客户端**：创建 `src/api/aStock.ts`
8. **Tab 子组件**：创建 5 个 Tab 组件
9. **主页面**：创建 `src/pages/AStockPage.tsx`
10. **路由注册**：修改 `App.tsx`
11. **导航菜单**：修改 `SidebarNav.tsx`
12. **i18n 文本**：在 `uiText.ts` 添加中文文本

### Phase 3: 验证与调整

13. **启动后端**：验证 API 端点
14. **启动前端**：验证页面渲染
15. **边界情况**：数据目录不存在、NaN处理、空数据提示
16. **样式调整**：对齐现有设计风格

---

## 五、风险控制

| 风险 | 应对措施 |
|------|---------|
| a_stock 数据目录不存在 | API 返回友好错误，前端显示配置提示 |
| JSON 解析失败（NaN等） | Service层try-catch，NaN转null |
| 新旧数据schema不一致 | 字段读取全部使用get带默认值 |
| 影响现有页面 | 新页面完全独立，只增不改 |
| 后端路由冲突 | 使用`/a-stock`独立前缀 |

---

## 六、核心原则

1. **不修改 a_stock 项目**：DSA 只读 a_stock 输出文件
2. **最小侵入**：对 DSA 现有代码只做新增和少量导航/路由修改
3. **容错优先**：所有文件读取都有异常处理和降级显示
4. **复用现有组件**：前端使用 Card、Badge、StatCard、EmptyState 等公共组件
