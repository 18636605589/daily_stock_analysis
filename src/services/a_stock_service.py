# -*- coding: utf-8 -*-
"""A-Stock 数据读取服务。

职责：
- 从 a_stock 输出目录读取 JSON/CSV 契约文件
- 扫描按月归档的历史文件
- 处理 NaN/缺失字段等容错
- 提供给 API endpoint 的纯数据读取方法，不含 HTTP 逻辑
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


def _get_phase_from_filename(filename: str) -> str:
    """从文件名中提取阶段标签（preopen→集合竞价, open-confirm→开盘确认等），未识别返回空字符串。"""
    name_lower = filename.lower()
    for keyword, label in _PREMARKET_PHASE_KEYWORDS:
        if keyword in name_lower:
            return label
    return ""


def _get_phase_key_from_filename(filename: str) -> str:
    """从文件名中提取阶段key（preopen/open-confirm等），未识别返回空字符串。"""
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


_BUY_ACTIONS = {"建仓试仓", "开盘计划/小仓试探", "回踩低吸", "趋势跟踪"}
_AVOID_ACTIONS = {"不追高", "放弃/剔除"}


def _categorize_action(action: str) -> str:
    """将 a_stock 引擎原始 action 归一化为 buy/watch/avoid 三类，便于前端统计与着色。"""
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


_STRING_FIELDS = {
    "compute_date", "report_date", "factor", "direction", "symbol", "code",
    "name", "industry", "operation_rating",
}


def _load_csv(path: Path) -> List[Dict[str, Any]]:
    """加载 CSV 文件为字典列表，失败返回空列表。数值字段自动转 float，字符串字段保留。"""
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
                        if sval.endswith(".0") and sval.replace(".", "").isdigit():
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


def _scan_dated_files(base_dir: Path, prefix: str, suffix: str = ".json") -> List[Dict[str, str]]:
    """扫描按月归档的文件，返回 [{date, timestamp, path, label}] 列表（按日期倒序）。

    目录结构: base_dir/YYYYMM/{prefix}_YYYYMMDD_HHMM{suffix}
    同一日期有多份文件时只取最新一份（最大 HHMM）。
    """
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
    """根据HHMM时间返回阶段标签。"""
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
    """扫描盘前复盘所有时间点文件（同一日期的多次复核全部返回，不去重）。"""
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
        premarket_files = _scan_dated_files(self.data_premarket_dir, "a_stock_premarket_validate_")
        return {
            "available": available,
            "data_dir": str(self.root),
            "message": "" if available else f"A-Stock 数据目录不存在: {self.root}",
            "daily_count": len(daily_files),
            "premarket_count": len(premarket_files),
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
            indices[name] = {
                "price": _safe_float(info.get("price")) or 0.0,
                "change_pct": _safe_float(info.get("change_pct")) or 0.0,
            }
        factor_data = []
        for item in data.get("factor_data", []) or []:
            factor_data.append({
                "symbol": item.get("symbol", ""),
                "name": item.get("name", ""),
                "industry": item.get("industry", ""),
                "factor_score": _safe_float(item.get("factor_score")) or 0.0,
                "final_score": _safe_float(item.get("final_score")) or 0.0,
                "short_term_score": _safe_float(item.get("short_term_score")) or 0.0,
                "operation_rating": item.get("operation_rating", ""),
                "deep_tech_rating": item.get("deep_tech_rating", ""),
                "deep_tech_signal": item.get("deep_tech_signal", ""),
            })
        return {
            "schema_version": data.get("schema_version", ""),
            "report_time": data.get("report_time", ""),
            "as_of_date": data.get("as_of_date", ""),
            "next_trading_day": data.get("next_trading_day", ""),
            "market": {
                "indices": indices,
                "limit_up": _safe_int(market_raw.get("limit_up")) or 0,
                "limit_down": _safe_int(market_raw.get("limit_down")) or 0,
            },
            "factor_data": factor_data,
            "data_dir": str(self.root),
        }

    def get_premarket_dates(self) -> List[Dict[str, str]]:
        """返回盘前复盘历史时间点列表（倒序，同一天的多次复核全部返回）。"""
        return _scan_all_premarket_files(self.data_premarket_dir, "a_stock_premarket_validate_")

    def get_premarket_review(self, date_or_ts: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """读取盘前复盘；date_or_ts 为 None 取最新；支持 YYYYMMDD（取当天最新）或 YYYYMMDD_HHMM（精确时间点）。"""
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
            action_raw = item.get("action", "")
            results.append({
                "symbol": item.get("symbol", ""),
                "code": item.get("code", ""),
                "name": item.get("name", ""),
                "industry": item.get("industry", ""),
                "operation_rating": item.get("operation_rating", ""),
                "final_score": _safe_float(item.get("final_score")) or 0.0,
                "factor_score": _safe_float(item.get("factor_score")) or 0.0,
                "short_term_score": _safe_float(item.get("short_term_score")),
                "deep_tech_rating": item.get("deep_tech_rating", ""),
                "deep_tech_signal": item.get("deep_tech_signal", ""),
                "action": action_raw,
                "action_category": _categorize_action(action_raw),
                "position": str(item.get("position", "") or ""),
                "reason": item.get("reason", ""),
                "risk_flags": item.get("risk_flags", ""),
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
            })
        date_str_out = target["date"]
        time_str_out = target.get("time", "")
        phase_out = target.get("phase", "") or data.get("phase_label", "")
        return {
            "validate_time": data.get("validate_time", ""),
            "source_data": data.get("source_data", ""),
            "source_report_time": data.get("source_report_time", ""),
            "phase": data.get("phase", ""),
            "phase_label": phase_out or data.get("phase_label", ""),
            "confidence": data.get("confidence", ""),
            "market_bias": data.get("market_bias", ""),
            "market_reason": data.get("market_reason", ""),
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
        factor_data = []
        for item in data.get("factor_data", []) or []:
            factor_data.append({
                "symbol": item.get("symbol", ""),
                "name": item.get("name", ""),
                "industry": item.get("industry", ""),
                "factor_score": _safe_float(item.get("factor_score")) or 0.0,
                "final_score": _safe_float(item.get("final_score")) or 0.0,
                "short_term_score": _safe_float(item.get("short_term_score")),
                "operation_rating": item.get("operation_rating", ""),
                "deep_tech_rating": item.get("deep_tech_rating", ""),
                "deep_tech_signal": item.get("deep_tech_signal", ""),
            })
        return {
            "report_time": data.get("report_time", ""),
            "as_of_date": data.get("as_of_date", ""),
            "market": data.get("market", {}) or {},
            "factor_data": factor_data,
            "technical": data.get("technical", []) or [],
            "ic_diagnostics": data.get("ic_diagnostics", {}) or {},
            "risk": data.get("risk", {}) or {},
            "source_path": target["path"],
        }

    def get_factor_ic(self) -> Dict[str, Any]:
        """读取因子 IC 历史，返回每个因子最新一条数据。"""
        path = self.report_track_dir / "factor_ic_history.csv"
        rows = _load_csv(path)
        if not rows:
            return {"items": [], "latest_date": ""}
        latest_by_factor: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            factor = str(row.get("factor", ""))
            if not factor:
                continue
            date_val = str(row.get("compute_date", ""))
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
        latest_date = max((str(it.get("compute_date", "")) for it in items), default="")
        return {"items": items, "latest_date": latest_date}

    def get_performance(self) -> Dict[str, Any]:
        """读取推荐绩效追踪 CSV，计算统计摘要。"""
        path = self.report_track_dir / "top15_performance.csv"
        rows = _load_csv(path)
        if not rows:
            return {"stats": {}, "items": []}
        items: List[Dict[str, Any]] = []
        ret_t1_vals: List[float] = []
        ret_t5_vals: List[float] = []
        win_t1 = 0
        win_t5 = 0
        t1_count = 0
        t5_count = 0
        for row in rows:
            item = {
                "report_date": str(row.get("report_date", "") or ""),
                "symbol": str(row.get("symbol", "") or ""),
                "name": str(row.get("name", "") or ""),
                "industry": str(row.get("industry", "") or ""),
                "final_score": _safe_float(row.get("final_score")),
                "operation_rating": str(row.get("operation_rating", "") or ""),
                "price_at_rec": _safe_float(row.get("price_at_rec")),
                "ret_t1": _safe_float(row.get("ret_t1_net") or row.get("ret_t1")),
                "excess_t1": _safe_float(row.get("excess_t1_net") or row.get("excess_t1")),
                "ret_t5": _safe_float(row.get("ret_t5_net") or row.get("ret_t5")),
                "excess_t5": _safe_float(row.get("excess_t5_net") or row.get("excess_t5")),
                "ret_t20": _safe_float(row.get("ret_t20_net") or row.get("ret_t20")),
                "excess_t20": _safe_float(row.get("excess_t20_net") or row.get("excess_t20")),
            }
            items.append(item)
            t1 = item["ret_t1"]
            if t1 is not None:
                ret_t1_vals.append(t1)
                t1_count += 1
                if t1 > 0:
                    win_t1 += 1
            t5 = item["ret_t5"]
            if t5 is not None:
                ret_t5_vals.append(t5)
                t5_count += 1
                if t5 > 0:
                    win_t5 += 1
        items.sort(key=lambda x: x.get("report_date", ""), reverse=True)
        stats = {
            "total_count": len(items),
            "avg_ret_t1": (sum(ret_t1_vals) / len(ret_t1_vals)) if ret_t1_vals else None,
            "avg_ret_t5": (sum(ret_t5_vals) / len(ret_t5_vals)) if ret_t5_vals else None,
            "win_rate_t1": (win_t1 / t1_count * 100.0) if t1_count > 0 else None,
            "win_rate_t5": (win_t5 / t5_count * 100.0) if t5_count > 0 else None,
        }
        return {"stats": stats, "items": items}
