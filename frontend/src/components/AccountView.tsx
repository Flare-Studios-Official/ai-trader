import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  ChevronRight,
  FileText,
  Receipt,
  History,
  TrendingUp,
  Wallet,
  AlertOctagon,
  Save,
  RotateCcw,
} from 'lucide-react';
import { MainTab, OrdersSubTab, OverviewResponse } from '../types';
import { manageFunds, toggleKillSwitch, updateAccountSettings } from '../services/api';
import { formatInr, formatIstDateTime } from '../utils/format';

interface AccountViewProps {
  overview: OverviewResponse;
  onRefreshOverview: () => void;
  onOpenReport: (tab: OrdersSubTab) => void;
  onNavigateTab: (tab: MainTab) => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  overview,
  onRefreshOverview,
  onOpenReport,
  onNavigateTab,
}) => {
  const { account, portfolio } = overview;

  const normalizeMode = (m?: string): 'REALTIME_PAPER' | 'PREVIOUS_MARKET' | 'REALTIME_REAL' => {
    if (m === 'PREVIOUS_MARKET') return 'PREVIOUS_MARKET';
    if (m === 'REALTIME_REAL' || m === 'REAL_LOCKED') return 'REALTIME_REAL';
    return 'REALTIME_PAPER';
  };

  const [allocMode, setAllocMode] = useState(account.capital_allocation_mode);
  const [customAlloc, setCustomAlloc] = useState(String(account.custom_allocation_amount || 33333));
  const [tradingMode, setTradingMode] = useState<'REALTIME_PAPER' | 'PREVIOUS_MARKET' | 'REALTIME_REAL'>(
    normalizeMode(account.trading_mode)
  );
  const [riskPct, setRiskPct] = useState(String(account.risk_per_trade_pct));
  const [maxOpenPos, setMaxOpenPos] = useState(String(account.max_open_positions));
  const [maxTradesDay, setMaxTradesDay] = useState(String(account.max_trades_per_day));
  const [maxDailyLoss, setMaxDailyLoss] = useState(String(account.max_daily_loss_amount));
  const [dailyTarget, setDailyTarget] = useState(String(account.daily_profit_target));
  const [indianMinTarget, setIndianMinTarget] = useState(String(account.indian_min_target_inr));
  const [indianMaxLoss, setIndianMaxLoss] = useState(String(account.indian_max_loss_inr));
  const [btcSlPct, setBtcSlPct] = useState(String(account.stop_loss_pct));
  const [btcTpPct, setBtcTpPct] = useState(String(account.target_profit_pct));
  const [maxCapPct, setMaxCapPct] = useState(String(account.max_capital_used_pct));

  const [fundsModal, setFundsModal] = useState<'ADD' | 'WITHDRAW' | null>(null);
  const [fundAmount, setFundAmount] = useState('25000');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    setAllocMode(account.capital_allocation_mode);
    setCustomAlloc(String(account.custom_allocation_amount));
    setTradingMode(normalizeMode(account.trading_mode));
    setRiskPct(String(account.risk_per_trade_pct));
    setMaxOpenPos(String(account.max_open_positions));
    setMaxTradesDay(String(account.max_trades_per_day));
    setMaxDailyLoss(String(account.max_daily_loss_amount));
    setDailyTarget(String(account.daily_profit_target));
    setIndianMinTarget(String(account.indian_min_target_inr));
    setIndianMaxLoss(String(account.indian_max_loss_inr));
    setBtcSlPct(String(account.stop_loss_pct));
    setBtcTpPct(String(account.target_profit_pct));
    setMaxCapPct(String(account.max_capital_used_pct));
  }, [account.updated_at]);

  const saveControls = async (overrideMode?: 'REALTIME_PAPER' | 'PREVIOUS_MARKET' | 'REALTIME_REAL') => {
    setSaving(true);
    setNotice(null);
    const chosenMode = overrideMode || tradingMode;
    if (chosenMode === 'REALTIME_REAL') {
      setNotice({ ok: false, msg: 'Realtime Real Trading is disabled (Coming Soon). Paper trading only.' });
      setSaving(false);
      return;
    }
    try {
      await updateAccountSettings({
        trading_mode: chosenMode,
        capital_allocation_mode: allocMode,
        custom_allocation_amount: Number(customAlloc) || 33333,
        risk_per_trade_pct: Number(riskPct) || 1,
        max_open_positions: Number(maxOpenPos) || 2,
        max_trades_per_day: Number(maxTradesDay) || 10,
        max_daily_loss_amount: Number(maxDailyLoss) || 1500,
        daily_profit_target: Number(dailyTarget) || 3000,
        indian_min_target_inr: Number(indianMinTarget) || 500,
        indian_max_loss_inr: Number(indianMaxLoss) || 700,
        stop_loss_pct: Number(btcSlPct) || 0.5,
        target_profit_pct: Number(btcTpPct) || 0.5,
        max_capital_used_pct: Number(maxCapPct) || 100,
      });
      setNotice({ ok: true, msg: 'Trading & risk controls saved permanently to cloud.' });
      onRefreshOverview();
    } catch (e: any) {
      setNotice({ ok: false, msg: e?.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleFundAction = async (action: 'ADD' | 'WITHDRAW' | 'RESET') => {
    setSaving(true);
    setNotice(null);
    try {
      await manageFunds(action, action === 'RESET' ? 100000 : Number(fundAmount));
      setFundsModal(null);
      setNotice({
        ok: true,
        msg:
          action === 'RESET'
            ? 'Virtual account reset cleanly to ₹1,00,000.'
            : `Virtual funds updated (${action}).`,
      });
      onRefreshOverview();
    } catch (e: any) {
      setNotice({ ok: false, msg: e?.message || 'Fund operation failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleKillSwitch = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await toggleKillSwitch(!account.kill_switch_active);
      setNotice({
        ok: true,
        msg: account.kill_switch_active
          ? 'Kill Switch reset cleanly.'
          : 'Emergency Kill Switch activated! All open positions closed and Auto Trade stopped.',
      });
      onRefreshOverview();
    } catch (e: any) {
      setNotice({ ok: false, msg: e?.message || 'Kill Switch request failed' });
    } finally {
      setSaving(false);
    }
  };

  const allocPreview = account.allocated_budget_preview ?? Math.round((portfolio.available_balance / 3) * 100) / 100;

  return (
    <div className="space-y-4 pb-6">
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">Your Account</h1>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Trading Balance (Virtual Portfolio)</div>
            <div className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">
              {formatInr(portfolio.portfolio_value)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Last updated at {formatIstDateTime(account.updated_at)} • Cloud Synced
            </div>
          </div>
          <button
            onClick={() => handleFundAction('RESET')}
            title="Reset Virtual Capital to ₹1,00,000"
            className="text-xs font-semibold text-slate-500 hover:text-[#3F5BD9] flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              setFundAmount('25000');
              setFundsModal('WITHDRAW');
            }}
            className="py-2.5 rounded-xl border border-[#3F5BD9] text-[#3F5BD9] hover:bg-blue-50 font-bold text-xs tracking-wide uppercase transition-colors"
          >
            WITHDRAW
          </button>
          <button
            onClick={() => {
              setFundAmount('25000');
              setFundsModal('ADD');
            }}
            className="py-2.5 rounded-xl bg-[#3F5BD9] hover:bg-[#2D46B8] text-white font-bold text-xs tracking-wide uppercase transition-colors"
          >
            ADD FUNDS
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[11px] font-bold text-[#3F5BD9] uppercase">Allocated Per Trade</div>
            <div className="text-sm font-bold text-slate-900 mt-1 tabular-nums">{formatInr(allocPreview)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Active rule: {allocMode.replace('_', ' ')}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[11px] font-bold text-slate-600 uppercase">Idle Virtual Balance</div>
            <div className="text-sm font-bold text-slate-900 mt-1 tabular-nums">
              {formatInr(portfolio.available_balance)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Invested: {formatInr(portfolio.invested_amount)}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Trading Mode</h2>
            <p className="text-xs text-slate-500">Enforced by cloud backend • Strict Paper Trading Only</p>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" /> Zero Real Money
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            onClick={() => {
              setTradingMode('PREVIOUS_MARKET');
              saveControls('PREVIOUS_MARKET');
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              tradingMode === 'PREVIOUS_MARKET'
                ? 'bg-indigo-50/80 border-indigo-600 ring-1 ring-indigo-600'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>1. Previous Market Trading</span>
              {tradingMode === 'PREVIOUS_MARKET' && <span className="text-[10px] text-indigo-700 font-extrabold">ACTIVE</span>}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Replay today&apos;s or any past Indian/Bitcoin session chronologically after market hours.
            </p>
            {tradingMode === 'PREVIOUS_MARKET' && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateTab('charts');
                }}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:underline"
              >
                Open Historical Replay in Charts <ChevronRight className="w-3.5 h-3.5" />
              </div>
            )}
          </button>

          <button
            onClick={() => {
              setTradingMode('REALTIME_PAPER');
              saveControls('REALTIME_PAPER');
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              tradingMode === 'REALTIME_PAPER'
                ? 'bg-blue-50/70 border-[#3F5BD9] ring-1 ring-[#3F5BD9]'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>2. Realtime Paper Trading</span>
              {tradingMode === 'REALTIME_PAPER' && <span className="text-[10px] text-[#3F5BD9] font-extrabold">ACTIVE</span>}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Default live mode: real-time Angel One &amp; Coinbase prices, 24/7 cloud worker, virtual funds.
            </p>
          </button>

          <button
            type="button"
            disabled
            aria-disabled="true"
            className="p-3 rounded-xl border border-slate-200 bg-slate-100/80 text-left opacity-75 cursor-not-allowed"
          >
            <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-500" /> 3. Realtime Real Trading
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                COMING SOON
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Disabled placeholder. No real broker orders or real funds can ever be placed.
            </p>
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Capital Allocation &amp; Risk Controls</h2>
          <p className="text-xs text-slate-500">Enforced strictly by the 24/7 cloud trading worker</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">Capital Per Trade</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { id: 'ONE_THIRD', label: '1/3 Balance' },
                { id: 'TWO_THIRDS', label: '2/3 Balance' },
                { id: 'FULL', label: 'Full (100%)' },
                { id: 'CUSTOM', label: 'Custom ₹' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setAllocMode(opt.id)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-colors ${
                  allocMode === opt.id
                    ? 'bg-[#3F5BD9] border-[#3F5BD9] text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {allocMode === 'CUSTOM' && (
            <div className="mt-2.5">
              <label className="text-[11px] font-medium text-slate-600">Custom Trade Allocation (₹)</label>
              <input
                type="number"
                value={customAlloc}
                onChange={(e) => setCustomAlloc(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#3F5BD9]"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Risk / Trade (%)</label>
            <input
              type="number"
              step="0.1"
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-900"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Max Open Positions</label>
            <input
              type="number"
              value={maxOpenPos}
              onChange={(e) => setMaxOpenPos(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-900"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Max Trades / Day</label>
            <input
              type="number"
              value={maxTradesDay}
              onChange={(e) => setMaxTradesDay(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-900"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Max Daily Loss (₹)</label>
            <input
              type="number"
              value={maxDailyLoss}
              onChange={(e) => setMaxDailyLoss(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-900"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Daily Profit Target (₹)</label>
            <input
              type="number"
              value={dailyTarget}
              onChange={(e) => setDailyTarget(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-900"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Max Capital Cap (%)</label>
            <input
              type="number"
              value={maxCapPct}
              onChange={(e) => setMaxCapPct(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-900"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Indian Min Target (₹)</label>
            <input
              type="number"
              value={indianMinTarget}
              onChange={(e) => setIndianMinTarget(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-900"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Indian Max Loss (₹)</label>
            <input
              type="number"
              value={indianMaxLoss}
              onChange={(e) => setIndianMaxLoss(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-900"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Bitcoin SL % / TP %</label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <input
                type="number"
                step="0.1"
                value={btcSlPct}
                onChange={(e) => setBtcSlPct(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-2 py-2 font-semibold text-slate-900"
              />
              <input
                type="number"
                step="0.1"
                value={btcTpPct}
                onChange={(e) => setBtcTpPct(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-2 py-2 font-semibold text-slate-900"
              />
            </div>
          </div>
        </div>

        {notice && (
          <div
            className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
              notice.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {notice.msg}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            disabled={saving}
            onClick={() => saveControls()}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#3F5BD9] hover:bg-[#2D46B8] text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Controls'}
          </button>

          <button
            disabled={saving}
            onClick={handleKillSwitch}
            className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              account.kill_switch_active
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            {account.kill_switch_active ? 'Reset Kill Switch' : 'Kill Switch'}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Reports and Statements</h2>
          <p className="text-[11px] text-slate-500">All your paper trades, charges and ledger in one place</p>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            {
              title: 'Statement (Ledger)',
              desc: 'Complete virtual cash entries, exits & charges',
              icon: <FileText className="w-4 h-4 text-slate-600" />,
              action: () => {
                onOpenReport('ledger');
                onNavigateTab('orders');
              },
            },
            {
              title: 'Trades and Charges',
              desc: 'Simulated statutory F&O taxes & brokerage',
              icon: <Receipt className="w-4 h-4 text-slate-600" />,
              action: () => {
                onOpenReport('trades');
                onNavigateTab('orders');
              },
            },
            {
              title: 'AI Decisions Audit',
              desc: 'V12 signals & AI 6-factor scoring logs',
              icon: <History className="w-4 h-4 text-slate-600" />,
              action: () => {
                onOpenReport('ai_signals');
                onNavigateTab('orders');
              },
            },
            {
              title: 'Profit and Loss',
              desc: `Net P&L: ${formatInr(portfolio.overall_pnl, true)}`,
              icon: <TrendingUp className="w-4 h-4 text-slate-600" />,
              action: () => {
                onOpenReport('trades');
                onNavigateTab('orders');
              },
            },
            {
              title: 'Fund Transactions',
              desc: 'Virtual capital additions & resets',
              icon: <Wallet className="w-4 h-4 text-slate-600" />,
              action: () => {
                onOpenReport('ledger');
                onNavigateTab('orders');
              },
            },
          ].map((row) => (
            <button
              key={row.title}
              onClick={row.action}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  {row.icon}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">{row.title}</div>
                  <div className="text-[11px] text-slate-500">{row.desc}</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          ))}
        </div>
      </section>

      {fundsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {fundsModal === 'ADD' ? 'Add Virtual Funds' : 'Withdraw Virtual Funds'}
            </h3>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Amount (₹)</label>
              <input
                type="number"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-[#3F5BD9]"
              />
              <div className="flex gap-2">
                {['10000', '25000', '50000', '100000'].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setFundAmount(amt)}
                    className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-[11px] font-semibold text-slate-700"
                  >
                    +{(Number(amt) / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setFundsModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                onClick={() => handleFundAction(fundsModal)}
                className="flex-1 py-2.5 rounded-xl bg-[#3F5BD9] text-white text-xs font-bold disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
