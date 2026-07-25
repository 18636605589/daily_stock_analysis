# -*- coding: utf-8 -*-
"""A-Stock 荐股集成 API schemas（兼容 a_stock v3 契约）。"""

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
    pool_source: str = ""
    shortlist_score: Optional[float] = None


class ShortlistMeta(BaseModel):
    has_hot: bool = False
    has_lhb: bool = False
    has_limit_up_hit: bool = False
    empty_reason: Optional[Any] = None
    count: Optional[int] = None


class NextRecommendationsResponse(BaseModel):
    schema_version: str = ""
    schema_family: str = "unknown"
    purpose: str = ""
    report_time: str = ""
    as_of_date: str = ""
    next_trading_day: str = ""
    market: MarketOverview = Field(default_factory=MarketOverview)
    factor_data: List[FactorStockItem] = Field(default_factory=list)
    shortlist_meta: ShortlistMeta = Field(default_factory=ShortlistMeta)
    selection_context: Dict[str, Any] = Field(default_factory=dict)
    source: Dict[str, str] = Field(default_factory=dict)
    shortlist_count: int = 0
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
    # v3 auction enrichment
    quote_source: str = ""
    auction_strength: str = ""
    auction_score: Optional[float] = None
    auction_turnover: Optional[float] = None
    bid_ask_ratio: Optional[float] = None
    auction_enriched: Optional[bool] = None
    open_gap_pct: Optional[float] = None
    ref_price: Optional[float] = None


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
    pool_source: str = ""
    shortlist_score: Optional[float] = None


class ShortlistItem(BaseModel):
    symbol: str = ""
    name: str = ""
    industry: str = ""
    final_score: Optional[float] = None
    factor_score: Optional[float] = None
    short_term_score: Optional[float] = None
    shortlist_score: Optional[float] = None
    operation_rating: str = ""
    deep_tech_rating: str = ""
    deep_tech_signal: str = ""
    pattern_tag: str = ""
    sources: List[str] = Field(default_factory=list)
    auction_watch: str = ""
    short_term_reason: str = ""


class ShortlistBlock(BaseModel):
    enabled: bool = False
    count: int = 0
    meta: Dict[str, Any] = Field(default_factory=dict)
    items: List[ShortlistItem] = Field(default_factory=list)


class DailySnapshotResponse(BaseModel):
    schema_version: str = ""
    schema_family: str = "unknown"
    report_time: str = ""
    as_of_date: str = ""
    next_trading_day: str = ""
    market: Dict[str, Any] = Field(default_factory=dict)
    factor_data: List[DailySnapshotStockItem] = Field(default_factory=list)
    technical: List[Dict[str, Any]] = Field(default_factory=list)
    ic_diagnostics: Dict[str, Any] = Field(default_factory=dict)
    risk: Dict[str, Any] = Field(default_factory=dict)
    selection_context: Dict[str, Any] = Field(default_factory=dict)
    shortlist: ShortlistBlock = Field(default_factory=ShortlistBlock)
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
    earliest_date: str = ""
    sample_days: int = 0
    history_restarted: bool = True
    history_note: str = ""


class PerformanceStockItem(BaseModel):
    report_date: str = ""
    symbol: str = ""
    name: str = ""
    industry: str = ""
    final_score: Optional[float] = None
    operation_rating: str = ""
    deep_tech_rating: str = ""
    is_actionable: Optional[bool] = None
    is_shortlist: Optional[bool] = None
    pool_source: str = ""
    price_at_rec: Optional[float] = None
    ret_t1: Optional[float] = None
    excess_t1: Optional[float] = None
    ret_t5: Optional[float] = None
    excess_t5: Optional[float] = None
    ret_t20: Optional[float] = None
    excess_t20: Optional[float] = None
    ret_t1_gross: Optional[float] = None
    excess_t1_gross: Optional[float] = None
    ret_t5_gross: Optional[float] = None
    excess_t5_gross: Optional[float] = None
    ret_t1_tradable: Optional[float] = None
    excess_t1_tradable: Optional[float] = None


class PerformanceStats(BaseModel):
    total_count: int = 0
    avg_ret_t1: Optional[float] = None
    avg_ret_t5: Optional[float] = None
    win_rate_t1: Optional[float] = None
    win_rate_t5: Optional[float] = None


class PerformanceResponse(BaseModel):
    return_basis: str = "net"
    track_label: str = "top_n"
    note: str = ""
    stats: PerformanceStats = Field(default_factory=PerformanceStats)
    actionable_stats: PerformanceStats = Field(default_factory=PerformanceStats)
    shortlist_stats: PerformanceStats = Field(default_factory=PerformanceStats)
    items: List[PerformanceStockItem] = Field(default_factory=list)


class DataStatusResponse(BaseModel):
    available: bool = False
    data_dir: str = ""
    message: str = ""
    daily_count: int = 0
    premarket_count: int = 0
    premarket_day_count: int = 0
    schema_version: str = ""
    schema_family: str = "unknown"
    latest_as_of_date: str = ""
    latest_next_trading_day: str = ""
