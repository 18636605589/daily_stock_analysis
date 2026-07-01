# -*- coding: utf-8 -*-
"""A-Stock 荐股集成 API schemas."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class MarketIndexInfo(BaseModel):
    price: float
    change_pct: float


class MarketOverview(BaseModel):
    indices: Dict[str, MarketIndexInfo] = Field(default_factory=dict)
    limit_up: int = 0
    limit_down: int = 0


class FactorStockItem(BaseModel):
    symbol: str
    name: str
    industry: str = ""
    factor_score: float = 0.0
    final_score: float = 0.0
    short_term_score: float = 0.0
    operation_rating: str = ""
    deep_tech_rating: str = ""
    deep_tech_signal: str = ""


class NextRecommendationsResponse(BaseModel):
    schema_version: str = ""
    report_time: str = ""
    as_of_date: str = ""
    next_trading_day: str = ""
    market: MarketOverview = Field(default_factory=MarketOverview)
    factor_data: List[FactorStockItem] = Field(default_factory=list)
    data_dir: str = ""


class PremarketStockItem(BaseModel):
    symbol: str
    code: str = ""
    name: str = ""
    industry: str = ""
    operation_rating: str = ""
    final_score: float = 0.0
    factor_score: float = 0.0
    short_term_score: Optional[float] = None
    deep_tech_rating: str = ""
    deep_tech_signal: str = ""
    action: str = ""
    action_category: str = "watch"
    position: str = ""
    reason: str = ""
    risk_flags: str = ""
    change_pct: Optional[float] = None
    volume_ratio: Optional[float] = None
    latest: Optional[float] = None
    prev_close: Optional[float] = None
    ma5: Optional[float] = None
    ma10: Optional[float] = None
    ma20: Optional[float] = None
    ma60: Optional[float] = None
    atr_pct: Optional[float] = None
    entry_price: Optional[float] = None
    stop_loss: Optional[float] = None
    target_price: Optional[float] = None
    risk_reward: Optional[float] = None


class PremarketReviewResponse(BaseModel):
    validate_time: str = ""
    source_data: str = ""
    source_report_time: str = ""
    phase: str = ""
    phase_label: str = ""
    confidence: str = ""
    market_bias: str = ""
    market_reason: str = ""
    elapsed_seconds: float = 0.0
    results: List[PremarketStockItem] = Field(default_factory=list)
    date: str = ""
    time: str = ""
    timestamp: str = ""


class DatedFileItem(BaseModel):
    date: str
    label: str
    timestamp: str = ""
    time: str = ""
    phase: str = ""


class DailySnapshotStockItem(BaseModel):
    symbol: str = ""
    name: str = ""
    industry: str = ""
    factor_score: float = 0.0
    final_score: float = 0.0
    short_term_score: Optional[float] = None
    operation_rating: str = ""
    deep_tech_rating: str = ""
    deep_tech_signal: str = ""


class DailySnapshotResponse(BaseModel):
    report_time: str = ""
    as_of_date: str = ""
    market: Dict[str, Any] = Field(default_factory=dict)
    factor_data: List[DailySnapshotStockItem] = Field(default_factory=list)
    technical: List[Dict[str, Any]] = Field(default_factory=list)
    ic_diagnostics: Dict[str, Any] = Field(default_factory=dict)
    risk: Dict[str, Any] = Field(default_factory=dict)
    source_path: str = ""


class FactorICItem(BaseModel):
    compute_date: str = ""
    factor: str = ""
    direction: str = ""
    ic_mean: Optional[float] = None
    ic_std: Optional[float] = None
    icir: Optional[float] = None
    n_days: int = 0


class FactorICResponse(BaseModel):
    items: List[FactorICItem] = Field(default_factory=list)
    latest_date: str = ""


class PerformanceStockItem(BaseModel):
    report_date: str = ""
    symbol: str = ""
    name: str = ""
    industry: str = ""
    final_score: Optional[float] = None
    operation_rating: str = ""
    price_at_rec: Optional[float] = None
    ret_t1: Optional[float] = None
    excess_t1: Optional[float] = None
    ret_t5: Optional[float] = None
    excess_t5: Optional[float] = None
    ret_t20: Optional[float] = None
    excess_t20: Optional[float] = None


class PerformanceStats(BaseModel):
    total_count: int = 0
    avg_ret_t1: Optional[float] = None
    avg_ret_t5: Optional[float] = None
    win_rate_t1: Optional[float] = None
    win_rate_t5: Optional[float] = None


class PerformanceResponse(BaseModel):
    stats: PerformanceStats = Field(default_factory=PerformanceStats)
    items: List[PerformanceStockItem] = Field(default_factory=list)


class DataStatusResponse(BaseModel):
    available: bool = False
    data_dir: str = ""
    message: str = ""
    daily_count: int = 0
    premarket_count: int = 0
