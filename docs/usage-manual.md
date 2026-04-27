# 使用手册（本地运行 + 火山方舟 Kimi）

本手册面向当前环境：**macOS + Python 3.13 + 火山方舟 Ark 托管的 Kimi K2.6（Anthropic 协议）+ 纯 A 股自选**，无需代理即可跑通。

> 如果你切换了 LLM 供应商、新增美股/港股分析、或部署到服务器，请同时参考 [完整指南](full-guide.md) 与 [部署指南](DEPLOY.md)。

---

## 1. 环境准备

### 1.1 一次性初始化

```bash
cd /Users/zilong/Documents/Project/Python/daily_stock_analysis

# 建议用项目独立虚拟环境，避免污染全局 Python
python -m venv .venv
source .venv/bin/activate

# 换国内镜像加速（首次建议配置一次，全局生效）
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 安装后端依赖
pip install -r requirements.txt

当前直接使用 conda activate stock_analysis 切换 conda 环境即可
```

### 1.2 前端构建（使用 Web 界面时才需要）

```bash
# 换 npm 国内镜像（首次建议配置一次，全局生效）
npm config set registry https://registry.npmmirror.com

cd apps/dsa-web
npm install
npm run build
cd ../..
```

以后启动 Web 前只要不改前端代码，就不用再 build。可以把 `.env` 里 `WEBUI_AUTO_BUILD=false` 保持关闭，避免每次启动都重新编译。

---

## 2. 当前 LLM 配置说明

`.env` 里已经配好火山方舟 Kimi 通道（Anthropic 兼容协议）：

```env
LLM_CHANNELS=volces
LITELLM_MODEL=anthropic/kimi-k2.6

LLM_VOLCES_PROTOCOL=anthropic
LLM_VOLCES_BASE_URL=https://ark.cn-beijing.volces.com/api/coding
LLM_VOLCES_ENABLED=true
LLM_VOLCES_API_KEY=<你的方舟 API Key>
LLM_VOLCES_MODELS=kimi-k2.6
```

- 原理：项目用 LiteLLM Router 统一调用。`LLM_CHANNELS=volces` 声明一个名叫 `volces` 的渠道，`PROTOCOL=anthropic` 表示用 Anthropic 协议走，`BASE_URL` 覆盖 Anthropic 默认域名到方舟。最终调用的模型名由 `LITELLM_MODEL` 指定。
- 换模型：只要火山方舟控制台里有这个模型，把 `LLM_VOLCES_MODELS` 和 `LITELLM_MODEL` 里的 `kimi-k2.6` 一起改成新模型名即可，如 `kimi-k2.7`、`doubao-pro-4k` 等。
- 多渠道：如需同时接入 DeepSeek / AIHubMix / Ollama，改成 `LLM_CHANNELS=volces,deepseek` 并追加 `LLM_DEEPSEEK_*` 字段即可。详见 [LLM 配置指南](LLM_CONFIG_GUIDE.md)。

---

## 3. 日常运行命令

所有命令前提：**已激活 venv**（`source .venv/bin/activate`）。

### 3.1 单股分析（最常用）

```bash
# 只抓数据，不调 LLM，用来调试数据源
python main.py --dry-run --stocks 600519

# 完整分析（抓数据 + 技术/舆情分析 + LLM + 生成报告）
python main.py --stocks 600519

# 多股一次分析（逗号分隔，支持 A 股 / 港股 / 美股代码）
python main.py --stocks 600519,300750,002594

# 不发送推送
python main.py --stocks 600519 --no-notify
```

### 3.2 按自选股列表批量分析

```bash
# 使用 .env 里 STOCK_LIST 定义的默认自选
python main.py
```

### 3.3 大盘复盘

```bash
# 只跑大盘复盘（不分析个股）
python main.py --market-review
```

### 3.4 定时任务模式

```bash
# 按 .env 里 SCHEDULE_TIME（默认 18:00）每日定时执行
python main.py --schedule

# 首次启动立即先跑一次
SCHEDULE_RUN_IMMEDIATELY=true python main.py --schedule
```

### 3.5 Web 界面

```bash
# 只启动 Web + API（不跑定时任务）
python main.py --serve-only

# 启动 Web + 执行定时分析
python main.py --webui
```

默认地址 `http://127.0.0.1:8000`，在浏览器打开即可。Web 界面里可以：

- 管理自选股（支持图片识别 / CSV 导入 / 粘贴）
- 手动触发分析 / 查看历史报告
- 修改所有 `.env` 配置（改完自动热加载，不需要重启）
- Agent 策略问股（`/chat` 页面）

如果公网部署再打开密码保护：

```env
ADMIN_AUTH_ENABLED=true
```

---

## 4. 验证与自检

每次改完 `.env` 或 pull 了新代码，建议按顺序跑：

```bash
python test_env.py --config        # 校验配置
python test_env.py --llm           # 真实调用 LLM
python test_env.py --fetch         # 测数据源
python test_env.py --notify        # 测推送渠道
python main.py --dry-run --stocks 600519   # 冒烟
```

`test_env.py --config` 会打印出最终解析到的渠道、模型、Key 前缀等，用于快速定位配置问题。

---

## 5. 通知推送配置（当前为空）

当前 `.env` 里没有配任何"主动推送"渠道，分析跑完只能在本地看日志 / Web 界面。要手机/邮件实时收到，至少配置其中一个：

### 5.1 企业微信（推荐，最简单）

群设置 → 添加群机器人 → Webhook → 拿到 URL：

```env
WECHAT_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
```

### 5.2 邮件（最通用）

QQ 邮箱 / 163 邮箱设置页开启 SMTP，拿到"授权码"（不是登录密码）：

```env
EMAIL_SENDER=you@qq.com
EMAIL_PASSWORD=授权码
EMAIL_RECEIVERS=you@qq.com      # 多个逗号分隔；留空则发给自己
```

### 5.3 PushPlus（手机推送最方便）

[pushplus.plus](https://www.pushplus.plus) 微信扫码注册：

```env
PUSHPLUS_TOKEN=xxx
```

### 5.4 钉钉群机器人

群机器人 → 自定义 → 拿到 Webhook：

```env
CUSTOM_WEBHOOK_URLS=https://oapi.dingtalk.com/robot/send?access_token=xxx
```

### 5.5 飞书群机器人

```env
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
```

---

## 6. 数据源与搜索增强（可选）

| 配置 | 推荐优先级 | 用途 |
| --- | --- | --- |
| `BOCHA_API_KEYS` | 中文新闻首选，[open.bocha.cn](https://open.bocha.cn) | 国内直连稳定 |
| `TUSHARE_TOKEN` | A 股数据源补充，[tushare.pro](https://tushare.pro) | 默认 akshare/efinance 已够用，可不填 |
| `TAVILY_API_KEYS` | 全球新闻搜索 | 需代理 |
| `SERPAPI_API_KEYS` | 全渠道搜索 | 需代理 |
| `BRAVE_API_KEYS` | 当前已填 | 国内直连不稳定，可删 |

---

## 7. 美股 / 港股场景

目前 `STOCK_LIST=600519,300750,002594` 都是 A 股。如果要分析：

- **港股**：代码格式 `hk00700`、`hk09988`
- **美股**：代码格式 `AAPL`、`TSLA`、`NVDA`

**注意**：美股 / 港股的行情接口走 YFinance / Yahoo Finance，国内直连会超时，需要先开代理：

```env
USE_PROXY=true
PROXY_HOST=127.0.0.1
PROXY_PORT=10809   # 改成你自己的代理端口
```

`main.py` 启动时会读这三项自动注入 `http_proxy`/`https_proxy` 环境变量。

---

## 8. Agent 策略问股

`.env` 里 `AGENT_MODE=true` 已开启。启动 Web 后访问：

```
http://127.0.0.1:8000/chat
```

可以用自然语言提问，如：

- `用均线金叉策略分析 600519`
- `用缠论分析 300750`
- `帮我对比 600519 和 贵州茅台 的技术面`

内置 11 种策略（均线金叉 / 缠论 / 波浪 / 多头趋势 等），在 `strategies/` 目录，可自己添加 YAML 策略文件。

---

## 9. 常见故障排查

### 9.1 启动报 `LITELLM_MODEL 已配置，但当前渠道中不存在该模型`

确认 `LITELLM_MODEL` 和 `LLM_<CHANNEL>_MODELS` 一致。项目会自动给模型名加 `anthropic/`/`openai/` 等前缀：

- `LLM_VOLCES_PROTOCOL=anthropic` + `LLM_VOLCES_MODELS=kimi-k2.6` → 最终模型名是 `anthropic/kimi-k2.6`
- 所以 `LITELLM_MODEL` 必须写 `anthropic/kimi-k2.6`，不能只写 `kimi-k2.6`

### 9.2 LLM 调用报 401 / invalid api key

火山方舟控制台 → API Key 管理 → 确认 Key 仍有效、对应的推理接入点（endpoint）包含 `kimi-k2.6` 模型。

### 9.3 分析美股卡在获取数据

检查是否开了代理（`USE_PROXY=true` 且代理在运行）。或者切回只分析 A 股。

### 9.4 企业微信推送报 `Message too long`

在 `.env` 加：

```env
REPORT_TYPE=simple           # simple(精简) / full(完整) / brief(3-5句)
SINGLE_STOCK_NOTIFY=true     # 每分析完一只就推送，避免汇总超长
```

### 9.5 Web 界面启动时一直在编译前端

```env
WEBUI_AUTO_BUILD=false
```

然后手动 `cd apps/dsa-web && npm run build`，以后启动就跳过编译。

### 9.6 定时任务提示"非交易日跳过"

非 A 股交易日会自动跳过。临时测试可加：

```bash
python main.py --stocks 600519 --force-run
```

或在 `.env`：

```env
TRADING_DAY_CHECK_ENABLED=false
```

---

## 10. 常用命令速查

```bash
# 激活环境
source .venv/bin/activate

# 配置校验
python test_env.py --config

# LLM 调通验证
python test_env.py --llm

# 单股快测
python main.py --dry-run --stocks 600519
python main.py --stocks 600519

# 完整批量分析
python main.py

# 大盘复盘
python main.py --market-review

# Web 界面
python main.py --serve-only

# 定时模式
python main.py --schedule

# 查看日志
tail -f logs/stock_analysis.log

# 查看历史报告
ls -lt reports/ | head -20
```

---

## 11. 更多文档入口

- [完整指南 full-guide.md](full-guide.md)：全部配置项、高级用法
- [LLM 配置指南](LLM_CONFIG_GUIDE.md)：三层配置、YAML、多渠道
- [部署指南 DEPLOY.md](DEPLOY.md)：Docker、Systemd、服务器部署
- [FAQ](FAQ.md)：常见问题集中解答
- [桌面端打包](desktop-package.md)：Electron 客户端
- [云服务器 Web 部署](deploy-webui-cloud.md)：公网访问配置

---

## 12. 免责声明

本项目仅供学习与研究，不构成任何投资建议。分析结果由 AI 基于公开数据生成，可能存在错误或偏差。股市有风险，投资需谨慎，作者不对使用本项目产生的任何损失负责。
