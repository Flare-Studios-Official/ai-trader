"""
Database Models & SQLite / Supabase PostgreSQL Cloud Adapter
Seamlessly connects to Supabase Cloud PostgreSQL or local SQLite for persistent storage.
"""

from datetime import datetime
import os
from typing import Any, Dict
from sqlalchemy import create_engine, Column, Integer, Float, String, Boolean, DateTime, JSON, Text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/ai_trader.db")

# Format Render/Supabase postgresql:// URL if necessary
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class SignalLog(Base):
    __tablename__ = "ai_trader_signals"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(50), index=True)
    asset_type = Column(String(30), default="INDEX_F_AND_O")
    timeframe = Column(String(10), default="5m")
    timestamp = Column(String(50), index=True)
    stage1_signal = Column(String(20))
    stage1_confidence = Column(Integer)
    close_price = Column(Float)
    baseline = Column(Float)
    fuel_state = Column(String(50))
    rsi = Column(Float)
    chop_index = Column(Float)

    # Stage 2 AI Verifier
    ai_decision = Column(String(20))
    ai_score = Column(Float)
    ai_reason = Column(Text)
    ai_breakdown = Column(JSON, default={})

    # Stage 3 Risk Manager
    risk_status = Column(String(20))
    risk_reason = Column(Text)

    # Stage 4 Paper Execution
    executed = Column(Boolean, default=False)
    order_id = Column(String(50), nullable=True)
    fill_price = Column(Float, nullable=True)
    data_source = Column(String(100), default="DEMO_DATA")
    created_at = Column(DateTime, default=datetime.utcnow)


class TradeRecord(Base):
    __tablename__ = "ai_trader_trades"

    id = Column(Integer, primary_key=True, index=True)
    position_id = Column(String(50), unique=True, index=True)
    symbol = Column(String(50), index=True)
    asset_type = Column(String(30), default="INDEX_F_AND_O")
    contract_symbol = Column(String(100))
    side = Column(String(10))
    quantity = Column(Float)
    entry_price = Column(Float)
    exit_price = Column(Float, nullable=True)
    stop_loss = Column(Float)
    take_profit = Column(Float)
    status = Column(String(20))
    opened_at = Column(String(50))
    closed_at = Column(String(50), nullable=True)
    realized_pnl = Column(Float, default=0.0)
    charges_paid = Column(Float, default=0.0)
    exit_reason = Column(Text, nullable=True)
    decision_chain = Column(JSON, default={})
    data_source = Column(String(100), default="DEMO_DATA")
    created_at = Column(DateTime, default=datetime.utcnow)


class SystemSetting(Base):
    __tablename__ = "ai_trader_settings"

    key = Column(String(100), primary_key=True, index=True)
    value = Column(Text)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def init_db():
    os.makedirs("./data", exist_ok=True)
    Base.metadata.create_all(bind=engine)


init_db()
