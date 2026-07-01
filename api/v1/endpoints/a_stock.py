# -*- coding: utf-8 -*-
"""A-Stock 荐股集成 API endpoints。"""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, HTTPException, Security
from fastapi.security import APIKeyCookie

from api.v1.schemas.a_stock import (
    DailySnapshotResponse,
    DatedFileItem,
    DataStatusResponse,
    FactorICResponse,
    NextRecommendationsResponse,
    PerformanceResponse,
    PremarketReviewResponse,
)
from api.v1.schemas.common import ErrorResponse
from src.auth import COOKIE_NAME
from src.services.a_stock_service import AStockService


logger = logging.getLogger(__name__)

admin_session_cookie = APIKeyCookie(
    name=COOKIE_NAME,
    scheme_name="AdminSessionCookie",
    auto_error=False,
)
router = APIRouter(dependencies=[Security(admin_session_cookie)])

AUTH_RESPONSE = {
    401: {
        "model": ErrorResponse,
        "description": "未登录或管理员会话无效",
    },
}


def _get_service() -> AStockService:
    return AStockService()


def _require_data(svc: AStockService) -> None:
    status = svc.get_data_status()
    if not status["available"]:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "a_stock_data_unavailable",
                "message": status.get("message", "A-Stock 数据目录不可用"),
                "data_dir": status.get("data_dir", ""),
            },
        )


@router.get(
    "/status",
    response_model=DataStatusResponse,
    responses=AUTH_RESPONSE,
    summary="A-Stock 数据状态",
)
def get_status() -> DataStatusResponse:
    svc = _get_service()
    status = svc.get_data_status()
    return DataStatusResponse(**status)


@router.get(
    "/next",
    response_model=NextRecommendationsResponse,
    responses={**AUTH_RESPONSE, 404: {"model": ErrorResponse}},
    summary="次日荐股列表",
)
def get_next() -> NextRecommendationsResponse:
    svc = _get_service()
    _require_data(svc)
    data = svc.get_next_recommendations()
    if data is None:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "次日荐股数据不存在"})
    return NextRecommendationsResponse(**data)


@router.get(
    "/premarket/list",
    response_model=List[DatedFileItem],
    responses=AUTH_RESPONSE,
    summary="盘前复盘历史日期列表",
)
def list_premarket() -> List[DatedFileItem]:
    svc = _get_service()
    items = svc.get_premarket_dates()
    return [DatedFileItem(**it) for it in items]


@router.get(
    "/premarket/latest",
    response_model=PremarketReviewResponse,
    responses={**AUTH_RESPONSE, 404: {"model": ErrorResponse}},
    summary="最新盘前复盘",
)
def get_latest_premarket() -> PremarketReviewResponse:
    svc = _get_service()
    _require_data(svc)
    data = svc.get_latest_premarket()
    if data is None:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "暂无盘前复盘数据"})
    return PremarketReviewResponse(**data)


@router.get(
    "/premarket/{date}",
    response_model=PremarketReviewResponse,
    responses={**AUTH_RESPONSE, 404: {"model": ErrorResponse}},
    summary="指定日期/时间点盘前复盘（date=YYYYMMDD / YYYYMMDD_HHMM / YYYYMMDD_HHMM_phase）",
)
def get_premarket(date: str) -> PremarketReviewResponse:
    svc = _get_service()
    _require_data(svc)
    is_ts = "_" in date
    if is_ts:
        parts = date.split("_")
        if len(parts) == 2:
            valid = len(parts[0]) == 8 and parts[0].isdigit() and len(parts[1]) == 4 and parts[1].isdigit()
            if not valid:
                raise HTTPException(status_code=400, detail={"error": "invalid_date", "message": "时间戳格式应为 YYYYMMDD_HHMM"})
        elif len(parts) == 3:
            valid = (len(parts[0]) == 8 and parts[0].isdigit()
                     and len(parts[1]) == 4 and parts[1].isdigit()
                     and len(parts[2]) >= 2 and parts[2].replace("-", "").replace("_", "").isalnum())
            if not valid:
                raise HTTPException(status_code=400, detail={"error": "invalid_date", "message": "扩展时间戳格式应为 YYYYMMDD_HHMM_phase"})
        else:
            raise HTTPException(status_code=400, detail={"error": "invalid_date", "message": "时间戳格式应为 YYYYMMDD、YYYYMMDD_HHMM 或 YYYYMMDD_HHMM_phase"})
    else:
        if len(date) != 8 or not date.isdigit():
            raise HTTPException(status_code=400, detail={"error": "invalid_date", "message": "日期格式应为 YYYYMMDD、YYYYMMDD_HHMM 或 YYYYMMDD_HHMM_phase"})
    data = svc.get_premarket_review(date)
    if data is None:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": f"时间点 {date} 无盘前复盘数据"})
    return PremarketReviewResponse(**data)


@router.get(
    "/daily/list",
    response_model=List[DatedFileItem],
    responses=AUTH_RESPONSE,
    summary="历史荐股日期列表",
)
def list_daily() -> List[DatedFileItem]:
    svc = _get_service()
    items = svc.get_daily_dates()
    return [DatedFileItem(**it) for it in items]


@router.get(
    "/daily/{date}",
    response_model=DailySnapshotResponse,
    responses={**AUTH_RESPONSE, 404: {"model": ErrorResponse}},
    summary="指定日期荐股快照（date=YYYYMMDD）",
)
def get_daily(date: str) -> DailySnapshotResponse:
    svc = _get_service()
    _require_data(svc)
    if len(date) != 8 or not date.isdigit():
        raise HTTPException(status_code=400, detail={"error": "invalid_date", "message": "日期格式应为 YYYYMMDD"})
    data = svc.get_daily_snapshot(date)
    if data is None:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": f"日期 {date} 无荐股快照数据"})
    return DailySnapshotResponse(**data)


@router.get(
    "/factor-ic",
    response_model=FactorICResponse,
    responses=AUTH_RESPONSE,
    summary="因子 IC 追踪数据",
)
def get_factor_ic() -> FactorICResponse:
    svc = _get_service()
    data = svc.get_factor_ic()
    return FactorICResponse(**data)


@router.get(
    "/performance",
    response_model=PerformanceResponse,
    responses=AUTH_RESPONSE,
    summary="推荐绩效统计",
)
def get_performance() -> PerformanceResponse:
    svc = _get_service()
    data = svc.get_performance()
    return PerformanceResponse(**data)
