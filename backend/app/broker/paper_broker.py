"""
Cloud Paper Broker — Simulated Indian F&O & Crypto Trading Engine
Completely independent virtual broker for simulated execution.

Features:
- Validates and receives approved signals.
- Simulates realistic market orders and fills.
- Applies statutory Indian transaction charges (Brokerage, STT, Exchange, GST, SEBI, Stamp duty) for F&O.
- Applies standard crypto exchange fees (0.1% fee) for Bitcoin with zero Indian statutory taxes.
- Simulates realistic liquidity slippage.
- Tracks active virtual positions, trailing stops, and profit targets.
- Computes real-time realized and unrealized P&L.
- Enforces strict paper-trading isolation: ZERO routes to live order placement!
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import math
import uuid
from typing import Any, Dict, List, Optional, Tuple
from app.broker.instruments import FNOContract, InstrumentType, BlackScholesPricer
from app.market_data.base import AssetType


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


class PositionStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


@dataclass
class TransactionCharges:
    brokerage: float = 0.0
    stt: float = 0.0
    exchange_charges: float = 0.0
    gst: float = 0.0
    sebi_charges: float = 0.0
    stamp_duty: float = 0.0
    crypto_fee: float = 0.0
    total_charges: float = 0.0

    @classmethod
    def calculate(
        cls,
        turnover: float,
        is_buy: bool,
        asset_type: AssetType = AssetType.INDEX_F_AND_O,
        is_option: bool = True
    ) -> "TransactionCharges":
        if asset_type == AssetType.CRYPTO_SPOT:
            fee = turnover * 0.001
            return cls(crypto_fee=round(fee, 2), total_charges=round(fee, 2))

        brokerage = 20.0
        stt = (turnover * (0.001 if is_option else 0.0002)) if not is_buy else 0.0
        exchange = turnover * (0.0005 if is_option else 0.000019)
        gst = (brokerage + exchange) * 0.18
        sebi = turnover * (10.0 / 10000000.0)
        stamp = (turnover * 0.00003) if is_buy else 0.0
        total = brokerage + stt + exchange + gst + sebi + stamp
        return cls(
            brokerage=round(brokerage, 2),
            stt=round(stt, 2),
            exchange_charges=round(exchange, 2),
            gst=round(gst, 2),
            sebi_charges=round(sebi, 2),
            stamp_duty=round(stamp, 2),
            total_charges=round(total, 2)
        )


@dataclass
class PaperOrder:
    order_id: str
    symbol: str
    side: str
    quantity: float
    requested_price: float
    filled_price: float
    status: OrderStatus
    timestamp: str
    charges: TransactionCharges
    slippage: float
    asset_type: AssetType = AssetType.INDEX_F_AND_O
    reason: str = ""


@dataclass
class PaperPosition:
    position_id: str
    symbol: str
    contract: FNOContract
    side: str
    quantity: float
    entry_price: float
    current_price: float
    stop_loss: float
    take_profit: float
    status: PositionStatus
    opened_at: str
    closed_at: Optional[str] = None
    exit_price: Optional[float] = None
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    total_charges_paid: float = 0.0
    exit_reason: Optional[str] = None
    decision_chain: Dict[str, Any] = field(default_factory=dict)


class CloudPaperBroker:
    def __init__(self, initial_capital: float = 100000.0, slippage_pct: float = 0.0015):
        self.initial_capital = initial_capital
        self.available_balance = initial_capital
        self.slippage_pct = slippage_pct

        self.orders: List[PaperOrder] = []
        self.open_positions: Dict[str, PaperPosition] = {}
        self.trade_history: List[PaperPosition] = []
        self.total_realized_pnl: float = 0.0
        self.total_charges_paid: float = 0.0

    def get_portfolio_summary(self) -> Dict[str, Any]:
        unrealized = sum(p.unrealized_pnl for p in self.open_positions.values())
        invested = sum(
            (p.entry_price * p.quantity) * (85.0 if p.contract.asset_type == AssetType.CRYPTO_SPOT else 1.0)
            for p in self.open_positions.values()
        )
        return {
            "initial_capital": self.initial_capital,
            "available_balance": round(self.available_balance, 2),
            "invested_amount": round(invested, 2),
            "unrealized_pnl": round(unrealized, 2),
            "realized_pnl": round(self.total_realized_pnl, 2),
            "net_equity": round(self.available_balance + invested + unrealized, 2),
            "total_charges_paid": round(self.total_charges_paid, 2),
            "open_positions_count": len(self.open_positions),
            "total_trades_completed": len(self.trade_history)
        }

    def execute_virtual_order(
        self,
        contract: FNOContract,
        side: str,
        quantity: float,
        market_price: float,
        stop_loss: float,
        take_profit: float,
        decision_chain: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, Optional[PaperPosition], str]:
        slip_direction = 1 if side.upper() == "BUY" else -1
        slippage_amount = round(market_price * self.slippage_pct * slip_direction, 2)
        filled_price = max(0.01, round(market_price + slippage_amount, 2))
        
        usd_rate = 85.0 if contract.asset_type == AssetType.CRYPTO_SPOT else 1.0
        turnover = (filled_price * quantity) * usd_rate

        is_option = contract.instrument_type in [InstrumentType.INDEX_OPTION_CE, InstrumentType.INDEX_OPTION_PE]
        entry_charges = TransactionCharges.calculate(
            turnover=turnover,
            is_buy=(side.upper() == "BUY"),
            asset_type=contract.asset_type,
            is_option=is_option
        )

        required_capital = turnover + entry_charges.total_charges
        if side.upper() == "BUY" and self.available_balance < required_capital:
            reason = f"Insufficient virtual funds: Required ₹{required_capital:,.2f}, Available ₹{self.available_balance:,.2f}"
            order = PaperOrder(
                order_id=str(uuid.uuid4())[:8],
                symbol=contract.symbol,
                side=side,
                quantity=quantity,
                requested_price=market_price,
                filled_price=0.0,
                status=OrderStatus.REJECTED,
                timestamp=datetime.now().isoformat(),
                charges=entry_charges,
                slippage=0.0,
                asset_type=contract.asset_type,
                reason=reason
            )
            self.orders.append(order)
            return False, None, reason

        self.available_balance -= required_capital
        self.total_charges_paid += entry_charges.total_charges

        order_id = str(uuid.uuid4())[:8]
        order = PaperOrder(
            order_id=order_id,
            symbol=contract.symbol,
            side=side,
            quantity=quantity,
            requested_price=market_price,
            filled_price=filled_price,
            status=OrderStatus.FILLED,
            timestamp=datetime.now().isoformat(),
            charges=entry_charges,
            slippage=slippage_amount,
            asset_type=contract.asset_type,
            reason="Simulated Market Fill"
        )
        self.orders.append(order)

        pos_id = f"POS_{uuid.uuid4().hex[:6]}"
        position = PaperPosition(
            position_id=pos_id,
            symbol=contract.symbol,
            contract=contract,
            side=side,
            quantity=quantity,
            entry_price=filled_price,
            current_price=filled_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            status=PositionStatus.OPEN,
            opened_at=datetime.now().isoformat(),
            total_charges_paid=entry_charges.total_charges,
            decision_chain=decision_chain or {}
        )
        self.open_positions[contract.symbol] = position
        return True, position, f"Filled {quantity} of {contract.symbol} @ {filled_price} (Slip: {slippage_amount}, Chg: ₹{entry_charges.total_charges})"

    def update_position_price(self, symbol: str, current_market_price: float) -> Optional[PaperPosition]:
        pos = self.open_positions.get(symbol)
        if not pos or pos.status != PositionStatus.OPEN:
            return None

        pos.current_price = current_market_price
        usd_rate = 85.0 if pos.contract.asset_type == AssetType.CRYPTO_SPOT else 1.0

        if pos.side.upper() == "BUY":
            pos.unrealized_pnl = round(((pos.current_price - pos.entry_price) * pos.quantity) * usd_rate, 2)
            if pos.current_price <= pos.stop_loss:
                return self.close_position(symbol, pos.current_price, exit_reason="Stop-Loss Triggered")
            if pos.current_price >= pos.take_profit:
                return self.close_position(symbol, pos.current_price, exit_reason="Take-Profit Hit")
        else:
            pos.unrealized_pnl = round(((pos.entry_price - pos.current_price) * pos.quantity) * usd_rate, 2)
            if pos.current_price >= pos.stop_loss:
                return self.close_position(symbol, pos.current_price, exit_reason="Stop-Loss Triggered")
            if pos.current_price <= pos.take_profit:
                return self.close_position(symbol, pos.current_price, exit_reason="Take-Profit Hit")

        return None

    def close_position(self, symbol: str, exit_market_price: float, exit_reason: str = "Manual Exit") -> Optional[PaperPosition]:
        pos = self.open_positions.pop(symbol, None)
        if not pos:
            return None

        slip_direction = -1 if pos.side.upper() == "BUY" else 1
        slippage_amount = round(exit_market_price * self.slippage_pct * slip_direction, 2)
        filled_exit_price = max(0.01, round(exit_market_price + slippage_amount, 2))
        
        usd_rate = 85.0 if pos.contract.asset_type == AssetType.CRYPTO_SPOT else 1.0
        turnover = (filled_exit_price * pos.quantity) * usd_rate

        is_option = pos.contract.instrument_type in [InstrumentType.INDEX_OPTION_CE, InstrumentType.INDEX_OPTION_PE]
        exit_charges = TransactionCharges.calculate(
            turnover=turnover,
            is_buy=(pos.side.upper() != "BUY"),
            asset_type=pos.contract.asset_type,
            is_option=is_option
        )

        if pos.side.upper() == "BUY":
            gross_pnl = ((filled_exit_price - pos.entry_price) * pos.quantity) * usd_rate
        else:
            gross_pnl = ((pos.entry_price - filled_exit_price) * pos.quantity) * usd_rate

        net_pnl = round(gross_pnl - exit_charges.total_charges, 2)

        self.available_balance += (turnover - exit_charges.total_charges)
        self.total_charges_paid += exit_charges.total_charges
        self.total_realized_pnl += net_pnl

        pos.status = PositionStatus.CLOSED
        pos.closed_at = datetime.now().isoformat()
        pos.exit_price = filled_exit_price
        pos.realized_pnl = net_pnl
        pos.unrealized_pnl = 0.0
        pos.total_charges_paid += exit_charges.total_charges
        pos.exit_reason = exit_reason

        order = PaperOrder(
            order_id=str(uuid.uuid4())[:8],
            symbol=pos.symbol,
            side="SELL" if pos.side.upper() == "BUY" else "BUY",
            quantity=pos.quantity,
            requested_price=exit_market_price,
            filled_price=filled_exit_price,
            status=OrderStatus.FILLED,
            timestamp=datetime.now().isoformat(),
            charges=exit_charges,
            slippage=slippage_amount,
            asset_type=pos.contract.asset_type,
            reason=f"Exit: {exit_reason}"
        )
        self.orders.append(order)
        self.trade_history.append(pos)
        return pos
