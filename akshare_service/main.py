"""FastAPI service wrapping AkShare fund datasets.

This module exposes three primary endpoints:

* ``GET /fund/{code}`` – 基金基础信息（雪球数据）及实时估算
* ``GET /fund/{code}/estimate`` – 仅实时净值估算（含更新时间）
* ``GET /fund/qdii`` – QDII/T+0 基金列表，可按投资地域筛选（默认欧美市场）

AkShare 通过网络抓取公共行情，因此接口可能存在请求超时、限频等问题；
使用缓存降低对源站的压力并提升响应速度。
"""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional

import akshare as ak
import requests
from cachetools import TTLCache, cached
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel


class FundRealtime(BaseModel):
    code: str
    name: str
    price: Optional[float]
    estimate: Optional[float]
    estimate_change_rate: Optional[float]
    previous_value: Optional[float]
    previous_change_rate: Optional[float]
    updated_at: Optional[str]


class FundProfile(BaseModel):
    code: str
    name: str
    company: Optional[str]
    manager: Optional[str]
    type: Optional[str]
    establish_date: Optional[str]
    scale: Optional[str]
    risk_level: Optional[str]


class FundResponse(BaseModel):
    profile: FundProfile
    realtime: FundRealtime


class QDIIFund(BaseModel):
    code: str
    name: str
    region: Optional[str]
    latest_net_value: Optional[float]
    net_value_date: Optional[str]
    daily_change: Optional[float]


class IndexQuote(BaseModel):
    id: str
    name: str
    symbol: str
    last: Optional[float]
    change: Optional[float]
    change_percent: Optional[float]
    currency: Optional[str]
    updated_at: Optional[str]


app = FastAPI(title="AkShare Fund Service", version="0.1.0")

_realtime_cache: TTLCache[str, Dict[str, Any]] = TTLCache(maxsize=256, ttl=120)
_profile_cache: TTLCache[str, Dict[str, Any]] = TTLCache(maxsize=512, ttl=3600)
_qdii_cache: TTLCache[str, List[Dict[str, Any]]] = TTLCache(maxsize=16, ttl=900)
_index_cache: TTLCache[str, Dict[str, Any]] = TTLCache(maxsize=64, ttl=300)  # 增加缓存时间从 60 到 300 秒


def _clean_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned in {"", "--", "---"}:
            return None
        return cleaned
    return str(value)


def _safe_float(value: Any) -> Optional[float]:
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned in {"", "--", "---"}:
            return None
        cleaned = cleaned.replace(",", "")
        if cleaned.endswith("%"):
            cleaned = cleaned[:-1]
        value = cleaned
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_iso(timestamp: Optional[float]) -> Optional[str]:
    if timestamp is None:
        return None
    try:
        value = float(timestamp)
        if value > 1_000_000_000_000:
            value /= 1000
        moment = datetime.fromtimestamp(value, tz=timezone.utc)
        return moment.isoformat()
    except (TypeError, ValueError, OSError):  # pragma: no cover - defensive
        return None


def _fetch_index_via_akshare(symbol: str) -> Optional[Dict[str, Any]]:
    """使用 AkShare 获取美股指数数据（备用方案）"""
    import logging
    logger = logging.getLogger("uvicorn")
    
    try:
        logger.info(f"AkShare 请求: {symbol}")
        # AkShare 的美股指数接口
        df = ak.index_us_stock_sina(symbol=symbol)
        
        if df is None or df.empty:
            logger.warning(f"AkShare 返回空数据: {symbol}")
            return None
        
        logger.info(f"AkShare 返回 {len(df)} 行数据")
        logger.info(f"列名: {list(df.columns)}")
        
        latest = df.iloc[-1]
        logger.info(f"最新数据: {dict(latest)}")
        
        result = {
            "last": _safe_float(latest.get("收盘")),
            "change": None,  # AkShare 数据可能不包含涨跌额
            "change_percent": _safe_float(latest.get("涨跌幅")),
            "updated_at": str(latest.get("日期")) if "日期" in latest else None,
        }
        
        logger.info(f"解析结果: {result}")
        return result
        
    except Exception as e:
        logger.error(f"AkShare 异常: {type(e).__name__}: {e}")
        return None


def _fetch_yahoo_quotes(symbols: List[str]) -> Dict[str, Dict[str, Any]]:
    """获取 Yahoo Finance 指数数据，失败时自动切换到 AkShare"""
    import logging
    logger = logging.getLogger("uvicorn")
    
    if not symbols:
        return {}
    
    cache_key = "yahoo:" + ",".join(sorted(symbols))
    cached_value = _index_cache.get(cache_key)
    if cached_value is not None:
        logger.info(f"Using cached Yahoo data for {symbols}")
        return cached_value
    
    # 定义符号映射
    symbol_map = {
        "^IXIC": ".IXIC",  # 纳斯达克
        "^GSPC": ".INX",   # 标普500
    }
    
    # 先尝试 Yahoo Finance
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
    }
    
    yahoo_failed = False
    try:
        response = requests.get(
            "https://query1.finance.yahoo.com/v7/finance/quote",
            params={"symbols": ",".join(symbols)},
            headers=headers,
            timeout=10,
        )
        
        # 检查是否失败（401, 429 等）
        if response.status_code in [401, 429]:
            logger.warning(f"Yahoo API 返回 {response.status_code}，切换到 AkShare 备用方案")
            yahoo_failed = True
        elif not response.ok:
            logger.error(f"Yahoo API 错误: {response.status_code}")
            yahoo_failed = True
        else:
            # 成功获取数据
            payload = response.json() or {}
            result: Dict[str, Dict[str, Any]] = {}
            for item in payload.get("quoteResponse", {}).get("result", []):
                symbol = item.get("symbol")
                if symbol:
                    result[symbol] = item
            
            if result:
                logger.info(f"Yahoo API 成功获取 {len(result)} 个指数")
                _index_cache[cache_key] = result
                return result
            else:
                logger.warning("Yahoo API 返回空数据，切换到 AkShare")
                yahoo_failed = True
                
    except requests.RequestException as exc:
        logger.warning(f"Yahoo API 请求失败: {exc}，切换到 AkShare")
        yahoo_failed = True
    
    # 如果 Yahoo 失败，使用 AkShare 备用方案
    if yahoo_failed:
        logger.info("使用 AkShare 获取美股指数...")
        result: Dict[str, Dict[str, Any]] = {}
        
        for yahoo_symbol in symbols:
            akshare_symbol = symbol_map.get(yahoo_symbol)
            if not akshare_symbol:
                logger.warning(f"无法映射符号: {yahoo_symbol}")
                continue
            
            logger.info(f"通过 AkShare 获取 {yahoo_symbol} ({akshare_symbol})")
            data = _fetch_index_via_akshare(akshare_symbol)
            
            if data and data.get("last") is not None:
                # 转换为 Yahoo API 格式
                result[yahoo_symbol] = {
                    "regularMarketPrice": data.get("last"),
                    "regularMarketChange": data.get("change"),
                    "regularMarketChangePercent": data.get("change_percent"),
                    "currency": "USD",
                    "regularMarketTime": None,
                }
                logger.info(f"✓ AkShare 获取成功: {yahoo_symbol} = {data.get('last')}")
            else:
                logger.error(f"✗ AkShare 获取失败: {yahoo_symbol}")
        
        if result:
            logger.info(f"AkShare 成功获取 {len(result)} 个指数，缓存结果")
            _index_cache[cache_key] = result
            return result
        else:
            logger.error("Yahoo 和 AkShare 都失败了")
            # 返回空字典而不是抛出异常，让调用方处理
            return {}
    
    return {}


def _fetch_gold_price() -> Dict[str, Any]:
    cache_key = "lbma:gold"
    cached_value = _index_cache.get(cache_key)
    if cached_value is not None:
        return cached_value
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        response = requests.get("https://data-asg.goldprice.org/dbXRates/USD", headers=headers, timeout=5)
        response.raise_for_status()
    except requests.RequestException as exc:  # pragma: no cover - external call
        raise HTTPException(status_code=502, detail=f"LBMA gold request failed: {exc}") from exc
    payload = response.json() or {}
    items = payload.get("items") or []
    if not items:
        raise HTTPException(status_code=502, detail="LBMA gold response missing items")
    item = items[0]
    result = {
        "last": _safe_float(item.get("xauPrice")),
        "change": _safe_float(item.get("chgXau")),
        "change_percent": _safe_float(item.get("pcXau")),
        "updated_at": _to_iso(payload.get("ts")) or payload.get("date"),
        "currency": "USD/oz",
    }
    _index_cache[cache_key] = result
    return result


def _fetch_sse_quote() -> Dict[str, Any]:
    cache_key = "index:sse"
    cached_value = _index_cache.get(cache_key)
    if cached_value is not None:
        return cached_value
    params = {
        "secid": "1.000001",
        "fltt": "2",
        "fields": "f43,f169,f170",
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://quote.eastmoney.com/",
    }
    try:
        response = requests.get("https://push2.eastmoney.com/api/qt/stock/get", params=params, headers=headers, timeout=5)
        response.raise_for_status()
    except requests.RequestException as exc:  # pragma: no cover - external call
        raise HTTPException(status_code=502, detail=f"SSE quote request failed: {exc}") from exc
    payload = response.json() or {}
    data = payload.get("data") or {}
    result = {
        "last": _safe_float(data.get("f43")),
        "change": _safe_float(data.get("f169")),
        "change_percent": _safe_float(data.get("f170")),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "currency": "CNY",
    }
    _index_cache[cache_key] = result
    return result


def _guess_estimation_categories(fund_type: Optional[str]) -> List[str]:
    if not fund_type:
        return []
    categories: List[str] = []
    mapping = [
        ("QDII", "QDII"),
        ("ETF联接", "ETF联接"),
        ("ETF", "场内交易基金"),
        ("LOF", "LOF"),
        ("混合", "混合型"),
        ("债券", "债券型"),
        ("指数", "指数型"),
        ("股票", "股票型"),
    ]
    for keyword, category in mapping:
        if keyword in fund_type and category not in categories:
            categories.append(category)
    return categories


@cached(_profile_cache)
def fetch_fund_profile(code: str) -> Dict[str, Any]:
    try:
        df = ak.fund_individual_basic_info_xq(symbol=code)
    except Exception as exc:  # pragma: no cover - AkShare runtime errors
        raise HTTPException(status_code=502, detail=f"AkShare XQ request failed: {exc}") from exc
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"Fund profile not found for code {code}")
    rows = df.to_dict("records")
    items: Dict[str, Any] = {}
    for entry in rows:
        key = _clean_text(entry.get("item"))
        if not key:
            continue
        items[key] = _clean_text(entry.get("value"))

    def pick(*keys: str) -> Optional[str]:
        for key in keys:
            value = items.get(key)
            if value is not None:
                return value
        return None

    return {
        "code": code,
        "name": pick("基金简称", "基金名称"),
        "company": pick("基金公司", "基金管理人"),
        "manager": pick("基金经理"),
        "type": pick("基金类型"),
        "establish_date": pick("成立时间", "成立日期"),
        "scale": pick("最新规模", "基金资产规模"),
        "risk_level": pick("基金评级", "风险等级"),
    }


@cached(_realtime_cache)
def fetch_realtime_estimate(code: str) -> Dict[str, Any]:
    profile = fetch_fund_profile(code)
    categories = _guess_estimation_categories(profile.get("type"))
    categories.append("全部")
    record = None
    df = None
    last_error: Optional[Exception] = None
    seen: set[str] = set()
    for category in categories:
        if category in seen:
            continue
        seen.add(category)
        try:
            df = ak.fund_value_estimation_em(symbol=category)
        except Exception as exc:  # pragma: no cover
            last_error = exc
            continue
        if df is None or df.empty:
            continue
        code_series = df.get("基金代码")
        if code_series is None:
            continue
        subset = df[code_series == code]
        if subset.empty:
            continue
        record = subset.iloc[0]
        break

    if record is None:
        if last_error is not None:
            raise HTTPException(status_code=502, detail=f"AkShare realtime request failed: {last_error}") from last_error
        raise HTTPException(status_code=404, detail=f"Realtime quote not found for code {code}")

    def column_entry(keyword: str) -> Optional[tuple[str, Any]]:
        for col in record.index:
            text = str(col)
            if keyword in text:
                return col, record[col]
        return None

    def previous_net_value() -> Any:
        for col in record.index:
            text = str(col)
            if "单位净值" in text and "公布数据" not in text and "估算数据" not in text:
                return record[col]
        return None

    estimate_entry = column_entry("估算值")
    price_entry = column_entry("公布数据-单位净值")
    change_entry = column_entry("估算增长率")
    prev_change_entry = column_entry("公布数据-日增长率")

    updated_at = None
    if estimate_entry or price_entry:
        source_col = estimate_entry[0] if estimate_entry else price_entry[0]
        parts = str(source_col).split("-")
        updated_at = "-".join(parts[:3]) if len(parts) >= 3 else parts[0]

    return {
        "code": code,
        "name": _clean_text(record.get("基金名称"))
        or _clean_text(record.get("基金简称"))
        or profile.get("name"),
        "price": _safe_float(price_entry[1]) if price_entry else None,
        "estimate": _safe_float(estimate_entry[1]) if estimate_entry else None,
        "estimate_change_rate": _safe_float(change_entry[1]) if change_entry else None,
        "previous_value": _safe_float(previous_net_value()),
        "previous_change_rate": _safe_float(prev_change_entry[1]) if prev_change_entry else None,
        "updated_at": updated_at,
    }


@cached(_qdii_cache)
def fetch_qdii_list(region_keyword: Optional[str]) -> List[Dict[str, Any]]:
    try:
        df = ak.fund_category_sina(symbol="QDII")
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"AkShare QDII request failed: {exc}") from exc
    if df is None or df.empty:
        return []
    filtered = df
    if region_keyword:
        filtered = df[df.apply(lambda row: region_keyword in str(row.get("投资地域", "")), axis=1)]
    result: List[Dict[str, Any]] = []
    for _, row in filtered.iterrows():
        result.append(
            {
                "code": str(row.get("基金代码")),
                "name": row.get("基金名称"),
                "region": row.get("投资地域"),
                "latest_net_value": _safe_float(row.get("最新净值")),
                "net_value_date": row.get("净值日期"),
                "daily_change": _safe_float(row.get("日涨幅")),
            }
        )
    return result


@app.get("/fund/{code}", response_model=FundResponse)
async def get_fund(code: str) -> FundResponse:
    profile = fetch_fund_profile(code)
    realtime = fetch_realtime_estimate(code)
    return FundResponse(profile=FundProfile(**profile), realtime=FundRealtime(**realtime))


@app.get("/fund/{code}/estimate", response_model=FundRealtime)
async def get_fund_estimate(code: str) -> FundRealtime:
    realtime = fetch_realtime_estimate(code)
    return FundRealtime(**realtime)


@app.get("/fund/qdii", response_model=List[QDIIFund])
async def get_qdii_funds(region: Optional[str] = Query("欧美", description="投资地域关键字")) -> List[QDIIFund]:
    result = fetch_qdii_list(region_keyword=region if region else None)
    return [QDIIFund(**item) for item in result]


@app.get("/market/indexes", response_model=List[IndexQuote])
async def get_market_indexes() -> List[IndexQuote]:
    import logging
    logger = logging.getLogger("uvicorn")
    
    targets = [
        {"id": "nasdaq", "name": "纳斯达克指数", "symbol": "^IXIC", "source": "yahoo"},
        {"id": "sp500", "name": "标普五百", "symbol": "^GSPC", "source": "yahoo"},
        {"id": "lbma-gold", "name": "LBMA 金价", "symbol": "LBMA-GOLD", "source": "gold"},
        {"id": "sse", "name": "上证指数", "symbol": "1.000001", "source": "sse"},
    ]

    yahoo_symbols = [target["symbol"] for target in targets if target["source"] == "yahoo"]
    yahoo_data: Dict[str, Dict[str, Any]] = {}
    if yahoo_symbols:
        try:
            logger.info(f"Fetching Yahoo quotes for: {yahoo_symbols}")
            yahoo_data = _fetch_yahoo_quotes(yahoo_symbols)
            logger.info(f"Yahoo data received: {list(yahoo_data.keys())}")
        except HTTPException as e:
            logger.error(f"Yahoo quotes failed: {e.detail}")
            yahoo_data = {}
        except Exception as e:
            logger.error(f"Yahoo quotes error: {type(e).__name__}: {e}")
            yahoo_data = {}

    quotes: List[IndexQuote] = []
    for target in targets:
        source = target["source"]
        if source == "yahoo":
            payload = yahoo_data.get(target["symbol"], {})
            if not payload:
                logger.warning(f"No Yahoo data for {target['symbol']}")
            quotes.append(
                IndexQuote(
                    id=target["id"],
                    name=target["name"],
                    symbol=target["symbol"],
                    last=_safe_float(payload.get("regularMarketPrice")),
                    change=_safe_float(payload.get("regularMarketChange")),
                    change_percent=_safe_float(payload.get("regularMarketChangePercent")),
                    currency=payload.get("currency", "USD"),
                    updated_at=_to_iso(payload.get("regularMarketTime")),
                )
            )
        elif source == "gold":
            try:
                logger.info("Fetching gold price...")
                gold = _fetch_gold_price()
                logger.info(f"Gold data received: last={gold.get('last')}")
            except HTTPException as e:
                logger.error(f"Gold price failed: {e.detail}")
                gold = {}
            except Exception as e:
                logger.error(f"Gold price error: {type(e).__name__}: {e}")
                gold = {}
            quotes.append(
                IndexQuote(
                    id=target["id"],
                    name=target["name"],
                    symbol=target["symbol"],
                    last=_safe_float(gold.get("last")),
                    change=_safe_float(gold.get("change")),
                    change_percent=_safe_float(gold.get("change_percent")),
                    currency=gold.get("currency"),
                    updated_at=gold.get("updated_at"),
                )
            )
        elif source == "sse":
            try:
                logger.info("Fetching SSE quote...")
                sse = _fetch_sse_quote()
                logger.info(f"SSE data received: last={sse.get('last')}")
            except HTTPException as e:
                logger.error(f"SSE quote failed: {e.detail}")
                sse = {}
            except Exception as e:
                logger.error(f"SSE quote error: {type(e).__name__}: {e}")
                sse = {}
            quotes.append(
                IndexQuote(
                    id=target["id"],
                    name=target["name"],
                    symbol=target["symbol"],
                    last=_safe_float(sse.get("last")),
                    change=_safe_float(sse.get("change")),
                    change_percent=_safe_float(sse.get("change_percent")),
                    currency=sse.get("currency"),
                    updated_at=sse.get("updated_at"),
                )
            )
    
    logger.info(f"Returning {len(quotes)} quotes")
    return quotes


@lru_cache(maxsize=1)
def service_metadata() -> Dict[str, Any]:
    return {
        "service": app.title,
        "version": app.version,
        "endpoints": ["/fund/{code}", "/fund/{code}/estimate", "/fund/qdii", "/market/indexes"],
    }


@app.get("/meta")
async def get_meta() -> Dict[str, Any]:
    return service_metadata()


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("akshare_service.main:app", host="127.0.0.1", port=8000, reload=True)
