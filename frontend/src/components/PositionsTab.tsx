import React from 'react';
import { Briefcase, ArrowUpRight, ArrowDownRight, XCircle } from 'lucide-react';
import { OpenPosition } from '../types';

interface PositionsTabProps {
  positions: OpenPosition[];
  onClosePosition: (symbol: string) => Promise<void>;
  maxPositions: number;
}

export const PositionsTab: React.FC<PositionsTabProps> = ({
  positions,
  onClosePosition,
  maxPositions
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <Briefcase className="w-5 h-5 text-blue-400" />
            <span>Active Paper Portfolio & Open Positions</span>
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Strict risk limit enforced: Maximum {maxPositions} active position allowed at any time.
          </p>
        </div>
        <span className="text-xs bg-brand-surface text-brand-muted px-3 py-1 rounded-lg border border-brand-border">
          Active: {positions.length} / {maxPositions}
        </span>
      </div>

      {positions.length === 0 ? (
        <div className="bg-brand-surface rounded-xl p-12 border border-brand-border text-center text-brand-muted">
          No open positions. Capital is 100% in cash waiting for an approved Stage 1 + Stage 2 + Stage 3 signal.
        </div>
      ) : (
        <div className="space-y-3">
          {positions.map((pos) => {
            const isProfit = pos.unrealized_pnl >= 0;
            return (
              <div
                key={pos.position_id}
                className="bg-brand-surface rounded-xl p-5 border border-brand-border shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center space-x-3">
                    <span className="text-base font-bold text-white">{pos.symbol}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                      pos.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {pos.side}
                    </span>
                    <span className="text-xs text-brand-muted bg-brand-card px-2 py-0.5 rounded border border-brand-border">
                      {pos.quantity} Qty
                    </span>
                    <span className="text-xs text-brand-muted font-mono">{pos.position_id}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3 text-xs">
                    <div>
                      <span className="text-[10px] text-brand-muted uppercase block">Entry Price (with Slip)</span>
                      <strong className="text-white">₹{pos.entry_price.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-muted uppercase block">Current Market Price</span>
                      <strong className="text-white">₹{pos.current_price.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-muted uppercase block">ATR Stop-Loss</span>
                      <strong className="text-red-400">₹{pos.stop_loss.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-muted uppercase block">ATR Take-Profit</span>
                      <strong className="text-emerald-400">₹{pos.take_profit.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4 w-full md:w-auto justify-between md:justify-end">
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-brand-muted font-semibold block">Unrealized MTM</span>
                    <span className={`text-2xl font-black ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isProfit ? '+' : ''}₹{pos.unrealized_pnl.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => onClosePosition(pos.symbol)}
                    className="px-3.5 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-xs font-bold transition-all shadow-sm"
                  >
                    Close Position
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
