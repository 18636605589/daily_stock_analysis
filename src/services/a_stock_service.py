# -*- coding: utf-8 -*-
"""A-Stock 数据读取服务。

职责：
- 从 a_stock 输出目录读取 JSON/CSV 契约文件（兼容 v2 落盘 + v3 扩展字段）
- 扫描按月归档的历史文件
- 处理 NaN/缺失字段等容错
- 提供给 API endpoint 的纯数据读取方法，不含 HTTP 逻辑

契约路径（相对 A_STOCK_ROOT）：
- state/next_trading_day.json
- data/daily/YYYYMM/a_stock_data_YYYYMMDD_HHMM.json
- data/premarket/YYYYMM/a_stock_premarket_validate_*.json
- reports/track/factor_ic_history.csv
- reports/track/top15_performance.csv  （文件名沿用；内容为 TOP-N / 含净收益口径）
"""

from __future__ import annotations

import csv
import json
import logging
import math
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

DEFAULT_A_STOCK_ROOT = Path("/Users/zilong/Documents/hermes/a_stock")

_FILENAME_DATE_RE = re.compile(r"(\d{8})_(\d{4})")

_PREMARKET_PHASE_KEYWORDS: List[Tuple[str, str]] = [
    ("preopen", "集合竞价"),
    ("open-confirm", "开盘确认"),
    ("open_confirm", "开盘确认"),
    ("intraday", "盘中复核"),
    ("midday", "盘中复核"),
    ("postclose", "盘后"),
    ("post_close", "盘后"),
    ("post-market", "盘后"),
    ("post_market", "盘后"),
    ("close", "盘后"),
]

# a_stock v3 起因子 IC 从空表重算；用于前端提示历史断档（非硬编码业务规则，仅展示元信息）
FACTOR_IC_V3_RESTART_NOTE = (
    "a_stock v3 改版后因子 IC 从空表重新累积，"
    "勿与 archive_pre_v3_rewrite 旧数据混用。"
)

_BUY_ACTIONS = {"建仓试仓", "开盘计划/小仓试探", "回踩低吸", "趋势跟踪"}
_AVOID_ACTIONS = {"不追高", "放弃/剔除"}

_STRING_FIELDS = {
    "compute_date", "report_date", "factor", "direction", "symbol", "code",
    "name", "industry", "operation_rating", "deep_tech_rating", "pool_source",
}


def _get_phase_from_filename(filename: str) -> str:
    """从文件名中提取阶段标签（preopen→集合竞价 等），未识别返回空字符串。"""
    name_lower = filename.lower()
    for keyword, label in _PREMARKET_PHASE_KEYWORDS:
        if keyword in name_lower:
            return label
    return ""


def _get_phase_key_from_filename(filename: str) -> str:
    """从文件名中提取阶段 key（preopen/open-confirm 等），未识别返回空字符串。"""
    name_lower = filename.lower()
    for keyword, _ in _PREMARKET_PHASE_KEYWORDS:
        if keyword in name_lower:
            return keyword
    return ""


def _get_a_stock_root() -> Path:
    root = os.environ.get("A_STOCK_ROOT", "").strip()
    if root:
        return Path(root).expanduser().resolve()
    return DEFAULT_A_STOCK_ROOT


def _clean_nan(obj: Any) -> Any:
    """递归将 NaN/Infinity 替换为 None。"""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _clean_nan(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean_nan(v) for v in obj]
    return obj


def _categorize_action(action: str) -> str:
    """将 a_stock 引擎原始 action 归一化为 buy/watch/avoid。"""
    if action in _BUY_ACTIONS:
        return "buy"
    if action in _AVOID_ACTIONS:
        return "avoid"
    return "watch"


def _load_json(path: Path) -> Optional[Dict[str, Any]]:
    """加载 JSON 文件，处理 NaN，失败返回 None。"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            def _parse_constant(c: str):
                if c in ("NaN", "Infinity", "-Infinity"):
                    return None
                raise ValueError(f"Invalid JSON constant: {c}")
            data = json.load(f, parse_constant=_parse_constant)
        return _clean_nan(data)
    except (FileNotFoundError, json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to load JSON %s: %s", path, exc)
        return None


def _load_csv(path: Path) -> List[Dict[str, Any]]:
    """加载 CSV 为字典列表；数值字段转 float，字符串字段保留。"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows: List[Dict[str, Any]] = []
            for row in reader:
                cleaned: Dict[str, Any] = {}
                for k, v in row.items():
                    if v is None or v == "":
                        cleaned[k] = None
                    elif k in _STRING_FIELDS:
                        sval = str(v).strip()
                        if sval.endswith(".0") and sval.replace(".", "", 1).isdigit():
                            sval = sval[:-2]
                        cleaned[k] = sval
                    else:
                        try:
                            fval = float(v)
                            if math.isnan(fval) or math.isinf(fval):
                                cleaned[k] = None
                            else:
                                cleaned[k] = fval
                        except (ValueError, TypeError):
                            cleaned[k] = v
                rows.append(cleaned)
            return rows
    except (FileNotFoundError, OSError) as exc:
        logger.warning("Failed to load CSV %s: %s", path, exc)
        return []


def _safe_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def _safe_int(val: Any) -> Optional[int]:
    f = _safe_float(val)
    if f is None:
        return None
    return int(f)


def _as_bool(val: Any) -> Optional[bool]:
    """宽松解析 bool；空值返回 None（表示字段缺失）。"""
    if val is None or val == "":
        return None
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        return bool(int(val))
    s = str(val).strip().lower()
    if s in ("1", "1.0", "true", "yes", "y"):
        return True
    if s in ("0", "0.0", "false", "no", "n"):
        return False
    return None


def _schema_family(schema_version: str) -> str:
    """从 schema_version 字符串推断契约家族。"""
    sv = (schema_version or "").lower()
    if "v3" in sv or "next_trading_day.v3" in sv or "analysis_v3" in sv:
        return "v3"
    if sv:
        return "legacy"
    return "unknown"


def _prefer_net(row: Dict[str, Any], net_key: str, gross_key: str) -> Optional[float]:
    """优先净收益口径，缺失时回退毛收益。"""
    net = _safe_float(row.get(net_key))
    if net is not None:
        return net
    return _safe_float(row.get(gross_key))


def _scan_dated_files(base_dir: Path, prefix: str, suffix: str = ".json") -> List[Dict[str, str]]:
    """扫描按月归档文件，返回 [{date, timestamp, path, label}]（按日期倒序，同日取最新 HHMM）。"""
    if not base_dir.is_dir():
        return []

    daily_latest: Dict[str, Dict[str, str]] = {}
    for month_dir in sorted(base_dir.iterdir()):
        if not month_dir.is_dir() or not re.match(r"^\d{6}$", month_dir.name):
            continue
        for f in month_dir.iterdir():
            if not f.is_file() or not f.name.startswith(prefix) or not f.name.endswith(suffix):
                continue
            m = _FILENAME_DATE_RE.search(f.name)
            if not m:
                continue
            date_str = m.group(1)
            time_str = m.group(2)
            ts = f"{date_str}_{time_str}"
            existing = daily_latest.get(date_str)
            if existing is None or ts > existing["timestamp"]:
                dt = datetime.strptime(ts, "%Y%m%d_%H%M")
                label = dt.strftime("%Y-%m-%d %H:%M")
                daily_latest[date_str] = {
                    "date": date_str,
                    "timestamp": ts,
                    "path": str(f),
                    "label": label,
                }

    return sorted(daily_latest.values(), key=lambda x: x["timestamp"], reverse=True)


def _get_time_phase_label(time_str: str) -> str:
    """根据 HHMM 返回阶段标签。"""
    if len(time_str) != 4 or not time_str.isdigit():
        return ""
    hhmm = int(time_str)
    if hhmm <= 930:
        return "集合竞价"
    if hhmm <= 940:
        return "开盘确认"
    if hhmm < 1130 or (1300 <= hhmm <= 1500):
        return "盘中复核"
    return "盘后"


def _scan_all_premarket_files(base_dir: Path, prefix: str, suffix: str = ".json") -> List[Dict[str, str]]:
    """扫描盘前复盘全部时间点（同一日期多次复核不去重）。"""
    if not base_dir.is_dir():
        return []

    items: List[Dict[str, str]] = []
    for month_dir in sorted(base_dir.iterdir()):
        if not month_dir.is_dir() or not re.match(r"^\d{6}$", month_dir.name):
            continue
        for f in month_dir.iterdir():
            if not f.is_file() or not f.name.startswith(prefix) or not f.name.endswith(suffix):
                continue
            m = _FILENAME_DATE_RE.search(f.name)
            if not m:
                continue
            date_str = m.group(1)
            time_str = m.group(2)
            phase_key = _get_phase_key_from_filename(f.name)
            base_ts = f"{date_str}_{time_str}"
            ts = f"{base_ts}_{phase_key}" if phase_key else base_ts
            dt = datetime.strptime(base_ts, "%Y%m%d_%H%M")
            phase = _get_phase_from_filename(f.name) or _get_time_phase_label(time_str)
            if phase:
                label = f"{dt.strftime('%Y-%m-%d %H:%M')} · {phase}"
            else:
                label = dt.strftime("%Y-%m-%d %H:%M")
            items.append({
                "date": date_str,
                "time": time_str,
                "timestamp": ts,
                "path": str(f),
                "label": label,
                "phase": phase,
            })

    return sorted(items, key=lambda x: x["timestamp"], reverse=True)


def _format_date_label(date_str: str) -> str:
    """YYYYMMDD → YYYY-MM-DD"""
    if len(date_str) == 8:
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    return date_str


def _map_factor_stock_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """映射 next/daily 中的 factor_data 条目（含 v3 pool/shortlist 字段）。"""
    return {
        "symbol": item.get("symbol", "") or "",
        "name": item.get("name", "") or "",
        "industry": item.get("industry", "") or "",
        "factor_score": _safe_float(item.get("factor_score")) or 0.0,
        "final_score": _safe_float(item.get("final_score")) or 0.0,
        "short_term_score": _safe_float(item.get("short_term_score")) or 0.0,
        "operation_rating": item.get("operation_rating", "") or "",
        "deep_tech_rating": item.get("deep_tech_rating", "") or "",
        "deep_tech_signal": item.get("deep_tech_signal", "") or "",
        "pool_source": item.get("pool_source", "") or "",
        "shortlist_score": _safe_float(item.get("shortlist_score")),
    }


def _is_shortlist_pool(pool_source: str) -> bool:
    ps = (pool_source or "").lower()
    return "shortlist" in ps


def _slim_shortlist_item(item: Dict[str, Any]) -> Dict[str, Any]:
    sources = item.get("sources") or []
    if not isinstance(sources, list):
        sources = [str(sources)] if sources else []
    return {
        "symbol": item.get("symbol", "") or "",
        "name": item.get("name", "") or "",
        "industry": item.get("industry", "") or "",
        "final_score": _safe_float(item.get("final_score")),
        "factor_score": _safe_float(item.get("factor_score")),
        "short_term_score": _safe_float(item.get("short_term_score")),
        "shortlist_score": _safe_float(item.get("shortlist_score")),
        "operation_rating": item.get("operation_rating", "") or "",
        "deep_tech_rating": item.get("deep_tech_rating", "") or "",
        "deep_tech_signal": item.get("deep_tech_signal", "") or "",
        "pattern_tag": item.get("pattern_tag", "") or "",
        "sources": [str(s) for s in sources],
        "auction_watch": item.get("auction_watch", "") or "",
        "short_term_reason": item.get("short_term_reason", "") or "",
    }


def _compute_return_stats(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """基于已映射的 ret_t1 / ret_t5 计算摘要统计。"""
    ret_t1_vals: List[float] = []
    ret_t5_vals: List[float] = []
    win_t1 = 0
    win_t5 = 0
    for item in items:
        t1 = item.get("ret_t1")
        if t1 is not None:
            ret_t1_vals.append(float(t1))
            if t1 > 0:
                win_t1 += 1
        t5 = item.get("ret_t5")
        if t5 is not None:
            ret_t5_vals.append(float(t5))
            if t5 > 0:
                win_t5 += 1
    t1_count = len(ret_t1_vals)
    t5_count = len(ret_t5_vals)
    return {
        "total_count": len(items),
        "avg_ret_t1": (sum(ret_t1_vals) / t1_count) if t1_count else None,
        "avg_ret_t5": (sum(ret_t5_vals) / t5_count) if t5_count else None,
        "win_rate_t1": (win_t1 / t1_count * 100.0) if t1_count else None,
        "win_rate_t5": (win_t5 / t5_count * 100.0) if t5_count else None,
    }


class AStockService:
    """A-Stock 数据读取服务（无状态，每次调用都从磁盘读取）。"""

    def __init__(self, root: Optional[Path] = None):
        self.root = (root or _get_a_stock_root()).resolve()
        self.state_dir = self.root / "state"
        self.data_dir = self.root / "data"
        self.data_daily_dir = self.data_dir / "daily"
        self.data_premarket_dir = self.data_dir / "premarket"
        self.report_track_dir = self.root / "reports" / "track"

    def get_data_status(self) -> Dict[str, Any]:
        available = self.root.is_dir() and self.state_dir.is_dir()
        daily_files = _scan_dated_files(self.data_daily_dir, "a_stock_data_")
        premarket_days = _scan_dated_files(self.data_premarket_dir, "a_stock_premarket_validate_")
        premarket_all = _scan_all_premarket_files(self.data_premarket_dir, "a_stock_premarket_validate_")

        schema_version = ""
        as_of_date = ""
        next_trading_day = ""
        if available:
            nxt = _load_json(self.state_dir / "next_trading_day.json")
            if nxt:
                schema_version = str(nxt.get("schema_version", "") or "")
                as_of_date = str(nxt.get("as_of_date", "") or "")
                next_trading_day = str(nxt.get("next_trading_day", "") or "")
            elif daily_files:
                snap = _load_json(Path(daily_files[0]["path"]))
                if snap:
                    schema_version = str(snap.get("schema_version", "") or "")
                    as_of_date = str(snap.get("as_of_date", "") or "")
                    next_trading_day = str(snap.get("next_trading_day", "") or "")

        return {
            "available": available,
            "data_dir": str(self.root),
            "message": "" if available else f"A-Stock 数据目录不存在: {self.root}",
            "daily_count": len(daily_files),
            "premarket_count": len(premarket_all),
            "premarket_day_count": len(premarket_days),
            "schema_version": schema_version,
            "schema_family": _schema_family(schema_version),
            "latest_as_of_date": as_of_date,
            "latest_next_trading_day": next_trading_day,
        }

    def get_next_recommendations(self) -> Optional[Dict[str, Any]]:
        """读取次日荐股（state/next_trading_day.json）。"""
        path = self.state_dir / "next_trading_day.json"
        data = _load_json(path)
        if data is None:
            return None
        market_raw = data.get("market", {}) or {}
        indices_raw = market_raw.get("indices", {}) or {}
        indices = {}
        for name, info in indices_raw.items():
            if not isinstance(info, dict):
                continue
            indices[name] = {
                "price": _safe_float(info.get("price")) or 0.0,
                "change_pct": _safe_float(info.get("change_pct")) or 0.0,
            }
        factor_data = [_map_factor_stock_item(item) for item in (data.get("factor_data") or [])]
        # shortlist 票置顶，便于前端默认优先展示
        factor_data.sort(
            key=lambda x: (
                0 if _is_shortlist_pool(str(x.get("pool_source") or "")) else 1,
                -(x.get("final_score") or 0.0),
            )
        )
        shortlist_meta = data.get("shortlist_meta") or {}
        if not isinstance(shortlist_meta, dict):
            shortlist_meta = {}
        selection_context = data.get("selection_context") or {}
        if not isinstance(selection_context, dict):
            selection_context = {}
        source = data.get("source") or {}
        if not isinstance(source, dict):
            source = {}

        schema_version = str(data.get("schema_version", "") or "")
        shortlist_count = sum(
            1 for x in factor_data if _is_shortlist_pool(str(x.get("pool_source") or ""))
        )
        return {
            "schema_version": schema_version,
            "schema_family": _schema_family(schema_version),
            "purpose": str(data.get("purpose", "") or ""),
            "report_time": data.get("report_time", "") or "",
            "as_of_date": data.get("as_of_date", "") or "",
            "next_trading_day": data.get("next_trading_day", "") or "",
            "market": {
                "indices": indices,
                "limit_up": _safe_int(market_raw.get("limit_up")) or 0,
                "limit_down": _safe_int(market_raw.get("limit_down")) or 0,
            },
            "factor_data": factor_data,
            "shortlist_meta": {
                "has_hot": bool(shortlist_meta.get("has_hot")),
                "has_lhb": bool(shortlist_meta.get("has_lhb")),
                "has_limit_up_hit": bool(shortlist_meta.get("has_limit_up_hit")),
                "empty_reason": shortlist_meta.get("empty_reason"),
                "count": _safe_int(shortlist_meta.get("count")) if shortlist_meta.get("count") is not None else shortlist_count,
            },
            "selection_context": _clean_nan(selection_context),
            "source": {str(k): str(v) for k, v in source.items()},
            "shortlist_count": shortlist_count,
            "data_dir": str(self.root),
        }

    def get_premarket_dates(self) -> List[Dict[str, str]]:
        """返回盘前复盘历史时间点列表（倒序，同一天多次复核全部返回）。"""
        return _scan_all_premarket_files(self.data_premarket_dir, "a_stock_premarket_validate_")

    def get_premarket_review(self, date_or_ts: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """读取盘前复盘；None 取最新；支持 YYYYMMDD / YYYYMMDD_HHMM / YYYYMMDD_HHMM_phase。"""
        files = self.get_premarket_dates()
        if not files:
            return None
        if date_or_ts:
            if "_" in date_or_ts:
                target = next((f for f in files if f["timestamp"] == date_or_ts), None)
            else:
                same_day = [f for f in files if f["date"] == date_or_ts]
                target = same_day[0] if same_day else None
            if target is None:
                return None
        else:
            target = files[0]
        data = _load_json(Path(target["path"]))
        if data is None:
            return None
        results = []
        for item in data.get("results", []) or []:
            action_raw = item.get("action", "") or ""
            results.append({
                "symbol": item.get("symbol", "") or "",
                "code": item.get("code", "") or "",
                "name": item.get("name", "") or "",
                "industry": item.get("industry", "") or "",
                "operation_rating": item.get("operation_rating", "") or "",
                "final_score": _safe_float(item.get("final_score")) or 0.0,
                "factor_score": _safe_float(item.get("factor_score")) or 0.0,
                "short_term_score": _safe_float(item.get("short_term_score")),
                "deep_tech_rating": item.get("deep_tech_rating", "") or "",
                "deep_tech_signal": item.get("deep_tech_signal", "") or "",
                "action": action_raw,
                "action_category": _categorize_action(action_raw),
                "position": str(item.get("position", "") or ""),
                "reason": item.get("reason", "") or "",
                "risk_flags": item.get("risk_flags", "") or "",
                "change_pct": _safe_float(item.get("change_pct")),
                "volume_ratio": _safe_float(item.get("volume_ratio")),
                "latest": _safe_float(item.get("latest")),
                "prev_close": _safe_float(item.get("prev_close")),
                "ma5": _safe_float(item.get("ma5")),
                "ma10": _safe_float(item.get("ma10")),
                "ma20": _safe_float(item.get("ma20")),
                "ma60": _safe_float(item.get("ma60")),
                "atr_pct": _safe_float(item.get("atr_pct")),
                "entry_price": _safe_float(item.get("entry_price")),
                "stop_loss": _safe_float(item.get("stop_loss")),
                "target_price": _safe_float(item.get("target_price")),
                "risk_reward": _safe_float(item.get("risk_reward")),
                # v3 竞价增强字段
                "quote_source": item.get("quote_source", "") or "",
                "auction_strength": item.get("auction_strength", "") or "",
                "auction_score": _safe_float(item.get("auction_score")),
                "auction_turnover": _safe_float(item.get("auction_turnover")),
                "bid_ask_ratio": _safe_float(item.get("bid_ask_ratio")),
                "auction_enriched": _as_bool(item.get("auction_enriched")),
                "open_gap_pct": _safe_float(item.get("open_gap_pct")),
                "ref_price": _safe_float(item.get("ref_price")) if item.get("ref_price") not in ("-", "") else None,
            })
        date_str_out = target["date"]
        time_str_out = target.get("time", "")
        phase_out = target.get("phase", "") or data.get("phase_label", "")
        return {
            "validate_time": data.get("validate_time", "") or "",
            "source_data": data.get("source_data", "") or "",
            "source_report_time": data.get("source_report_time", "") or "",
            "phase": data.get("phase", "") or "",
            "phase_label": phase_out or data.get("phase_label", "") or "",
            "confidence": data.get("confidence", "") or "",
            "market_bias": data.get("market_bias", "") or "",
            "market_reason": data.get("market_reason", "") or "",
            "elapsed_seconds": _safe_float(data.get("elapsed_seconds")) or 0.0,
            "results": results,
            "date": date_str_out,
            "time": time_str_out,
            "timestamp": target["timestamp"],
        }

    def get_latest_premarket(self) -> Optional[Dict[str, Any]]:
        return self.get_premarket_review(None)

    def get_daily_dates(self) -> List[Dict[str, str]]:
        """返回历史荐股日期列表（倒序）。"""
        return _scan_dated_files(self.data_daily_dir, "a_stock_data_")

    def get_daily_snapshot(self, date_str: str) -> Optional[Dict[str, Any]]:
        """读取指定日期（YYYYMMDD）的收盘快照。"""
        files = self.get_daily_dates()
        target = next((f for f in files if f["date"] == date_str), None)
        if target is None:
            return None
        data = _load_json(Path(target["path"]))
        if data is None:
            return None
        factor_data = [_map_factor_stock_item(item) for item in (data.get("factor_data") or [])]
        factor_data.sort(
            key=lambda x: (
                0 if _is_shortlist_pool(str(x.get("pool_source") or "")) else 1,
                -(x.get("final_score") or 0.0),
            )
        )

        shortlist_raw = data.get("shortlist") or {}
        shortlist_items: List[Dict[str, Any]] = []
        shortlist_enabled = False
        shortlist_meta: Dict[str, Any] = {}
        if isinstance(shortlist_raw, dict):
            shortlist_enabled = bool(shortlist_raw.get("enabled"))
            shortlist_meta = shortlist_raw.get("meta") or {}
            if not isinstance(shortlist_meta, dict):
                shortlist_meta = {}
            for item in shortlist_raw.get("items") or []:
                if isinstance(item, dict):
                    shortlist_items.append(_slim_shortlist_item(item))
        elif isinstance(shortlist_raw, list):
            shortlist_enabled = bool(shortlist_raw)
            for item in shortlist_raw:
                if isinstance(item, dict):
                    shortlist_items.append(_slim_shortlist_item(item))

        schema_version = str(data.get("schema_version", "") or "")
        selection_context = data.get("selection_context") or {}
        if not isinstance(selection_context, dict):
            selection_context = {}

        return {
            "schema_version": schema_version,
            "schema_family": _schema_family(schema_version),
            "report_time": data.get("report_time", "") or "",
            "as_of_date": data.get("as_of_date", "") or "",
            "next_trading_day": data.get("next_trading_day", "") or "",
            "market": data.get("market", {}) or {},
            "factor_data": factor_data,
            "technical": data.get("technical", []) or [],
            "ic_diagnostics": data.get("ic_diagnostics", {}) or {},
            "risk": data.get("risk", {}) or {},
            "selection_context": _clean_nan(selection_context),
            "shortlist": {
                "enabled": shortlist_enabled,
                "count": len(shortlist_items),
                "meta": _clean_nan(shortlist_meta) if shortlist_meta else {},
                "items": shortlist_items,
            },
            "source_path": target["path"],
        }

    def get_factor_ic(self) -> Dict[str, Any]:
        """读取因子 IC 历史；每个因子取最新一条，并附 v3 历史元信息。"""
        path = self.report_track_dir / "factor_ic_history.csv"
        rows = _load_csv(path)
        if not rows:
            return {
                "items": [],
                "latest_date": "",
                "earliest_date": "",
                "sample_days": 0,
                "history_restarted": True,
                "history_note": FACTOR_IC_V3_RESTART_NOTE,
            }
        latest_by_factor: Dict[str, Dict[str, Any]] = {}
        all_dates: List[str] = []
        for row in rows:
            factor = str(row.get("factor", "") or "")
            if not factor:
                continue
            date_val = str(row.get("compute_date", "") or "")
            if date_val:
                all_dates.append(date_val)
            existing = latest_by_factor.get(factor)
            if existing is None or date_val > str(existing.get("compute_date", "")):
                latest_by_factor[factor] = {
                    "compute_date": date_val,
                    "factor": factor,
                    "direction": str(row.get("direction", "") or ""),
                    "ic_mean": _safe_float(row.get("ic_mean")),
                    "ic_std": _safe_float(row.get("ic_std")),
                    "icir": _safe_float(row.get("icir")),
                    "n_days": _safe_int(row.get("n_days")) or 0,
                }
        items = sorted(latest_by_factor.values(), key=lambda x: -(x.get("icir") or -999))
        latest_date = max(all_dates) if all_dates else ""
        earliest_date = min(all_dates) if all_dates else ""
        sample_days = len(set(all_dates))
        # v3 改版后样本通常较短；有数据也统一给出说明，避免与旧 IC 混淆
        return {
            "items": items,
            "latest_date": latest_date,
            "earliest_date": earliest_date,
            "sample_days": sample_days,
            "history_restarted": True,
            "history_note": FACTOR_IC_V3_RESTART_NOTE,
        }

    def get_performance(self) -> Dict[str, Any]:
        """读取推荐绩效追踪 CSV；默认净收益口径，并拆分精选/shortlist 统计。"""
        path = self.report_track_dir / "top15_performance.csv"
        rows = _load_csv(path)
        empty_stats = {
            "total_count": 0,
            "avg_ret_t1": None,
            "avg_ret_t5": None,
            "win_rate_t1": None,
            "win_rate_t5": None,
        }
        if not rows:
            return {
                "return_basis": "net",
                "track_label": "top_n",
                "note": "收益默认优先使用净收益口径（*_net）；文件名 top15_performance 为历史兼容命名。",
                "stats": empty_stats,
                "actionable_stats": empty_stats,
                "shortlist_stats": empty_stats,
                "items": [],
            }

        items: List[Dict[str, Any]] = []
        for row in rows:
            is_actionable = _as_bool(row.get("is_actionable"))
            is_shortlist = _as_bool(row.get("is_shortlist"))
            item = {
                "report_date": str(row.get("report_date", "") or ""),
                "symbol": str(row.get("symbol", "") or ""),
                "name": str(row.get("name", "") or ""),
                "industry": str(row.get("industry", "") or ""),
                "final_score": _safe_float(row.get("final_score")),
                "operation_rating": str(row.get("operation_rating", "") or ""),
                "deep_tech_rating": str(row.get("deep_tech_rating", "") or ""),
                "is_actionable": is_actionable,
                "is_shortlist": is_shortlist,
                "pool_source": str(row.get("pool_source", "") or ""),
                "price_at_rec": _safe_float(row.get("price_at_rec")),
                # 主展示：净收益优先
                "ret_t1": _prefer_net(row, "ret_t1_net", "ret_t1"),
                "excess_t1": _prefer_net(row, "excess_t1_net", "excess_t1"),
                "ret_t5": _prefer_net(row, "ret_t5_net", "ret_t5"),
                "excess_t5": _prefer_net(row, "excess_t5_net", "excess_t5"),
                "ret_t20": _prefer_net(row, "ret_t20_net", "ret_t20"),
                "excess_t20": _prefer_net(row, "excess_t20_net", "excess_t20"),
                # 毛收益对照
                "ret_t1_gross": _safe_float(row.get("ret_t1")),
                "excess_t1_gross": _safe_float(row.get("excess_t1")),
                "ret_t5_gross": _safe_float(row.get("ret_t5")),
                "excess_t5_gross": _safe_float(row.get("excess_t5")),
                # 可交易口径（T+1）
                "ret_t1_tradable": _prefer_net(row, "ret_t1_tradable_net", "ret_t1_tradable"),
                "excess_t1_tradable": _prefer_net(row, "excess_t1_tradable_net", "excess_t1_tradable"),
            }
            items.append(item)

        items.sort(key=lambda x: x.get("report_date", ""), reverse=True)

        actionable_items = [it for it in items if it.get("is_actionable") is True]
        shortlist_items = [
            it for it in items
            if it.get("is_shortlist") is True or _is_shortlist_pool(str(it.get("pool_source") or ""))
        ]

        return {
            "return_basis": "net",
            "track_label": "top_n",
            "note": (
                "收益默认优先净收益（已扣手续费估算）；"
                "精选口径 is_actionable 与 a_stock 报告可操作池一致；"
                "文件名 top15_performance.csv 为历史兼容命名，实际跟踪 TOP-N。"
            ),
            "stats": _compute_return_stats(items),
            "actionable_stats": _compute_return_stats(actionable_items),
            "shortlist_stats": _compute_return_stats(shortlist_items),
            "items": items,
        }
