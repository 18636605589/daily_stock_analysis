# -*- coding: utf-8 -*-
"""AStockService v3 契约读取单元测试。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.services.a_stock_service import (
    AStockService,
    _as_bool,
    _categorize_action,
    _schema_family,
)


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


@pytest.fixture()
def a_stock_root(tmp_path: Path) -> Path:
    root = tmp_path / "a_stock"
    (root / "state").mkdir(parents=True)
    (root / "data" / "daily" / "202607").mkdir(parents=True)
    (root / "data" / "premarket" / "202607").mkdir(parents=True)
    (root / "reports" / "track").mkdir(parents=True)

    next_payload = {
        "schema_version": "a_stock_next_trading_day.v3",
        "purpose": "次日盘前复核入口",
        "report_time": "2026-07-24 15:58",
        "as_of_date": "2026-07-24",
        "next_trading_day": "2026-07-27",
        "source": {"data": "data/daily/202607/a_stock_data_20260724_1558.json"},
        "selection_context": {"mode": "full_market", "saved_factor_top_n": 50},
        "shortlist_meta": {
            "has_hot": True,
            "has_lhb": False,
            "has_limit_up_hit": True,
            "empty_reason": None,
            "count": 1,
        },
        "market": {
            "indices": {"上证指数": {"price": 3800.0, "change_pct": -1.2}},
            "limit_up": 10,
            "limit_down": 5,
        },
        "factor_data": [
            {
                "symbol": "600000.SS",
                "name": "研究池股",
                "industry": "银行",
                "factor_score": 70.0,
                "final_score": 72.0,
                "short_term_score": 8.0,
                "operation_rating": "观察等待确认",
                "deep_tech_rating": "B",
                "deep_tech_signal": "震荡",
                "pool_source": "research",
            },
            {
                "symbol": "600928.SS",
                "name": "精选票",
                "industry": "银行",
                "factor_score": 75.0,
                "final_score": 78.0,
                "short_term_score": 11.0,
                "operation_rating": "趋势延续可介入",
                "deep_tech_rating": "A",
                "deep_tech_signal": "多头",
                "pool_source": "shortlist+research",
                "shortlist_score": 49.7,
            },
        ],
    }
    _write(root / "state" / "next_trading_day.json", json.dumps(next_payload, ensure_ascii=False))

    daily_payload = {
        "schema_version": "a_stock_analysis_v3.next_trading_day.v1",
        "report_time": "2026-07-24 15:58",
        "as_of_date": "2026-07-24",
        "next_trading_day": "2026-07-27",
        "selection_context": {"mode": "full_market"},
        "market": {"indices": {}, "limit_up": 10, "limit_down": 5},
        "factor_data": next_payload["factor_data"],
        "technical": [],
        "ic_diagnostics": {"pe": {"direction": "low"}},
        "risk": {},
        "shortlist": {
            "enabled": True,
            "meta": {"count": 1},
            "items": [
                {
                    "symbol": "600928.SS",
                    "name": "精选票",
                    "industry": "银行",
                    "final_score": 78.0,
                    "shortlist_score": 49.7,
                    "operation_rating": "趋势延续可介入",
                    "deep_tech_rating": "A",
                    "pattern_tag": "回踩",
                    "sources": ["research_top"],
                    "auction_watch": "关注量比",
                }
            ],
        },
    }
    _write(
        root / "data" / "daily" / "202607" / "a_stock_data_20260724_1558.json",
        json.dumps(daily_payload, ensure_ascii=False),
    )

    premarket_payload = {
        "validate_time": "2026-07-24 09:26",
        "phase": "preopen",
        "phase_label": "集合竞价",
        "confidence": "中等",
        "market_bias": "中性",
        "market_reason": "隔夜中性",
        "elapsed_seconds": 12.5,
        "results": [
            {
                "symbol": "600928.SS",
                "code": "600928",
                "name": "精选票",
                "industry": "银行",
                "operation_rating": "趋势延续可介入",
                "final_score": 78.0,
                "factor_score": 75.0,
                "action": "开盘计划/小仓试探",
                "position": "1成",
                "reason": "竞价偏弱；缩量回调",
                "risk_flags": "",
                "change_pct": -0.5,
                "volume_ratio": 0.8,
                "latest": 3.5,
                "quote_source": "tencent",
                "auction_strength": "sell",
                "auction_score": -1,
                "auction_turnover": 0.01,
                "bid_ask_ratio": 1.2,
                "auction_enriched": True,
                "open_gap_pct": -0.8,
            }
        ],
    }
    _write(
        root / "data" / "premarket" / "202607" / "a_stock_premarket_validate_preopen_top10_20260724_0926.json",
        json.dumps(premarket_payload, ensure_ascii=False),
    )

    premarket_payload_oc = {
        "validate_time": "2026-07-24 09:35",
        "phase": "open-confirm",
        "phase_label": "开盘确认",
        "confidence": "高",
        "market_bias": "中性偏强",
        "market_reason": "开盘符合预期",
        "elapsed_seconds": 8.2,
        "results": premarket_payload["results"],
    }
    _write(
        root / "data" / "premarket" / "202607" / "a_stock_premarket_validate_open-confirm_top12_20260724_0935.json",
        json.dumps(premarket_payload_oc, ensure_ascii=False),
    )

    _write(
        root / "reports" / "track" / "factor_ic_history.csv",
        "compute_date,factor,direction,ic_mean,ic_std,icir,n_days\n"
        "20260710,pe,low,0.01,0.1,0.1,1\n"
        "20260724,pe,low,0.04,0.2,0.2,8\n"
        "20260724,vol_1m,neutral,0.12,0.17,0.73,8\n",
    )

    _write(
        root / "reports" / "track" / "top15_performance.csv",
        "report_date,symbol,name,industry,final_score,operation_rating,deep_tech_rating,"
        "is_actionable,price_at_rec,ret_t1,ret_t5,ret_t20,excess_t1,excess_t5,excess_t20,"
        "ret_t1_net,ret_t5_net,ret_t20_net,excess_t1_net,excess_t5_net,excess_t20_net,"
        "ret_t1_tradable,ret_t1_tradable_net,excess_t1_tradable,excess_t1_tradable_net,"
        "is_shortlist,pool_source\n"
        "20260723,600928.SS,精选票,银行,78.0,趋势延续可介入,A,1,3.5,1.0,2.0,,0.5,1.0,,"
        "0.7,1.7,,0.2,0.7,,1.2,0.9,0.8,0.5,1.0,shortlist+research\n"
        "20260723,600000.SS,研究池股,银行,72.0,观察等待确认,B,0,10.0,-1.0,0.5,,-1.5,0.1,,"
        "-1.3,0.2,,-1.8,-0.2,,-0.8,-1.1,-1.0,-1.3,0.0,research\n",
    )
    return root


def test_helpers():
    assert _schema_family("a_stock_next_trading_day.v3") == "v3"
    assert _schema_family("a_stock_analysis_v3.next_trading_day.v1") == "v3"
    assert _schema_family("old.v1") == "legacy"
    assert _schema_family("") == "unknown"
    assert _categorize_action("开盘计划/小仓试探") == "buy"
    assert _categorize_action("放弃/剔除") == "avoid"
    assert _categorize_action("观察等待") == "watch"
    assert _as_bool("1") is True
    assert _as_bool("0.0") is False
    assert _as_bool("") is None


def test_status_and_next(a_stock_root: Path):
    svc = AStockService(root=a_stock_root)
    status = svc.get_data_status()
    assert status["available"] is True
    assert status["schema_family"] == "v3"
    assert status["daily_count"] == 1
    assert status["premarket_count"] == 2
    assert status["premarket_day_count"] == 1
    assert status["latest_as_of_date"] == "2026-07-24"

    nxt = svc.get_next_recommendations()
    assert nxt is not None
    assert nxt["schema_family"] == "v3"
    assert nxt["shortlist_count"] == 1
    assert nxt["factor_data"][0]["symbol"] == "600928.SS"  # shortlist 置顶
    assert nxt["factor_data"][0]["pool_source"] == "shortlist+research"
    assert nxt["factor_data"][0]["shortlist_score"] == 49.7
    assert nxt["shortlist_meta"]["has_hot"] is True


def test_premarket_auction_fields(a_stock_root: Path):
    svc = AStockService(root=a_stock_root)
    pm = svc.get_premarket_review("20260724_0926_preopen")
    assert pm is not None
    assert pm["phase"] == "preopen"
    r0 = pm["results"][0]
    assert r0["action_category"] == "buy"
    assert r0["auction_strength"] == "sell"
    assert r0["open_gap_pct"] == pytest.approx(-0.8)
    assert r0["auction_enriched"] is True
    assert r0["quote_source"] == "tencent"

    pm_oc = svc.get_premarket_review("20260724_0935_open-confirm")
    assert pm_oc is not None
    assert pm_oc["phase"] == "open-confirm"
    assert pm_oc["phase_label"] == "开盘确认"


def test_daily_shortlist(a_stock_root: Path):
    svc = AStockService(root=a_stock_root)
    snap = svc.get_daily_snapshot("20260724")
    assert snap is not None
    assert snap["schema_family"] == "v3"
    assert snap["shortlist"]["enabled"] is True
    assert snap["shortlist"]["count"] == 1
    assert snap["shortlist"]["items"][0]["pattern_tag"] == "回踩"
    assert snap["factor_data"][0]["pool_source"].startswith("shortlist")


def test_factor_ic_meta(a_stock_root: Path):
    svc = AStockService(root=a_stock_root)
    ic = svc.get_factor_ic()
    assert ic["latest_date"] == "20260724"
    assert ic["earliest_date"] == "20260710"
    assert ic["sample_days"] == 2
    assert ic["history_restarted"] is True
    assert "v3" in ic["history_note"]
    factors = {it["factor"] for it in ic["items"]}
    assert "pe" in factors and "vol_1m" in factors
    pe = next(it for it in ic["items"] if it["factor"] == "pe")
    assert pe["ic_mean"] == pytest.approx(0.04)


def test_performance_net_and_subsets(a_stock_root: Path):
    svc = AStockService(root=a_stock_root)
    perf = svc.get_performance()
    assert perf["return_basis"] == "net"
    assert perf["stats"]["total_count"] == 2
    assert perf["actionable_stats"]["total_count"] == 1
    assert perf["shortlist_stats"]["total_count"] == 1

    actionable = next(it for it in perf["items"] if it["is_actionable"])
    assert actionable["ret_t1"] == pytest.approx(0.7)  # net preferred over gross 1.0
    assert actionable["ret_t1_gross"] == pytest.approx(1.0)
    assert actionable["pool_source"].startswith("shortlist")
    assert actionable["deep_tech_rating"] == "A"
