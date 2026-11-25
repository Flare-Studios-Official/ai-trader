import React, { useEffect, useState, useCallback } from 'react';
import {
  AISignalRecord,
  ChartTabSpec,
  MainTab,
  OrdersSubTab,
  OverviewResponse,
  PositionsSubTab,
  SearchInstrumentItem,
} from './types';
import { fetchOverview, toggleAutoTrade } from './services/api';
import { TopHeader } from './components/TopHeader';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { ChartsView } from './components/ChartsView';
import { PositionsView } from './components/PositionsView';
import { OrdersView } from './components/OrdersView';
import { AccountView } from './components/AccountView';
import { AutoTradeModal } from './components/AutoTradeModal';
import { InstrumentSearchModal } from './components/InstrumentSearchModal';
import { DecisionChainModal } from './components/DecisionChainModal';

const INITIAL_CHART_TABS: ChartTabSpec[] = [
  { id: 'NIFTY', symbol: 'NIFTY', label: 'NIFTY', exchange: 'NSE', token: '99926000' },
  { id: 'BANKNIFTY', symbol: 'BANKNIFTY', label: 'BANKNIFTY', exchange: 'NSE', token: '99926009' },
  { id: 'SENSEX', symbol: 'SENSEX', label: 'SENSEX', exchange: 'BSE', token: '99919000' },
  { id: 'BITCOIN', symbol: 'BITCOIN', label: 'BITCOIN', exchange: 'CRYPTO', token: 'BTCUSDT', subLabel: '24/7' },
];

export function App() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [positionsSubTab, setPositionsSubTab] = useState<PositionsSubTab>('positions');
  const [ordersSubTab, setOrdersSubTab] = useState<OrdersSubTab>('trades');
  const [chainUnderlying, setChainUnderlying] = useState<string>('NIFTY');

  const [chartTabs, setChartTabs] = useState<ChartTabSpec[]>(INITIAL_CHART_TABS);
  const [activeChartId, setActiveChartId] = useState<string>('NIFTY');

  const [showAutoTradeModal, setShowAutoTradeModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [inspectedSignal, setInspectedSignal] = useState<AISignalRecord | null>(null);

  const activeChartTab = chartTabs.find((t) => t.id === activeChartId) || chartTabs[0];

  const refreshOverview = useCallback(async () => {
    try {
      const data = await fetchOverview(activeChartTab?.symbol);
      setOverview(data);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Unable to connect to cloud trading engine');
    }
  }, [activeChartTab?.symbol]);

  useEffect(() => {
    refreshOverview();
    const iv = setInterval(refreshOverview, 2000);
    return () => clearInterval(iv);
  }, [refreshOverview]);

  const openSymbolChart = (symbol: string, exchange: string, token: string, label?: string) => {
    const id = symbol;
    setChartTabs((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      return [...prev, { id, symbol, label: label || symbol.replace('-EQ', ''), exchange, token }];
    });
    setActiveChartId(id);
    setActiveTab('charts');
  };

  const handleCloseChartTab = (id: string) => {
    setChartTabs((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((t) => t.id !== id);
      if (activeChartId === id) {
        setActiveChartId(next[0].id);
      }
      return next;
    });
  };

  const handleSearchSelectChart = (item: SearchInstrumentItem) => {
    openSymbolChart(item.symbol, item.exchange, item.token, item.symbol.replace('-EQ', ''));
  };

  const handleSearchSelectAutoTrade = async (symbol: string) => {
    await toggleAutoTrade(true, symbol);
    await refreshOverview();
  };

  const handleToggleAutoTrade = async (active: boolean, instrument: string) => {
    await toggleAutoTrade(active, instrument);
    await refreshOverview();
  };

  if (!overview) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 max-w-sm w-full text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#3F5BD9] text-white font-bold flex items-center justify-center mx-auto">
            AI
          </div>
          {loadError ? (
            <>
              <div className="text-sm font-bold text-slate-900">Connection Notice</div>
              <p className="text-xs text-slate-500">{loadError}</p>
              <button
                onClick={refreshOverview}
                className="w-full py-2 rounded-xl bg-[#3F5BD9] text-white text-xs font-bold"
              >
                Retry Cloud Sync
              </button>
            </>
          ) : (
            <div className="text-xs font-semibold text-slate-500 animate-pulse">
              Connecting to Cloud Trading Engine...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900 pb-20">
      <TopHeader
        account={overview.account}
        quotes={overview.quotes}
        indexMeta={overview.indexMeta}
        indianSession={overview.sessions.indian}
        angelConnected={overview.angelConnected}
        onOpenSearch={() => setShowSearchModal(true)}
        onOpenAutoTradeModal={() => setShowAutoTradeModal(true)}
        onSelectSymbolForChart={openSymbolChart}
        onGoAccount={() => setActiveTab('account')}
      />

      <main className="max-w-6xl mx-auto px-3 sm:px-5 pt-4">
        {activeTab === 'home' && (
          <HomeView
            overview={overview}
            onNavigateTab={setActiveTab}
            onOpenAutoTradeModal={() => setShowAutoTradeModal(true)}
            onSelectSymbolForChart={openSymbolChart}
          />
        )}

        {activeTab === 'charts' && (
          <ChartsView
            overview={overview}
            tabs={chartTabs}
            activeTabId={activeChartId}
            onSelectChartTab={setActiveChartId}
            onCloseChartTab={handleCloseChartTab}
            onOpenSearch={() => setShowSearchModal(true)}
            onNavigateTab={setActiveTab}
            onGoOptionChain={(u) => {
              setChainUnderlying(u);
              setPositionsSubTab('chain');
              setActiveTab('positions');
            }}
            onToggleAutoTradeModal={() => setShowAutoTradeModal(true)}
            onRefreshOverview={refreshOverview}
          />
        )}

        {activeTab === 'positions' && (
          <PositionsView
            overview={overview}
            subTab={positionsSubTab}
            chainUnderlying={chainUnderlying}
            onChangeSubTab={setPositionsSubTab}
            onChangeChainUnderlying={setChainUnderlying}
            onNavigateTab={setActiveTab}
            onSelectSymbolForChart={openSymbolChart}
            onInspectSignal={setInspectedSignal}
            onRefreshOverview={refreshOverview}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersView
            overview={overview}
            subTab={ordersSubTab}
            onChangeSubTab={setOrdersSubTab}
            onInspectSignal={setInspectedSignal}
          />
        )}

        {activeTab === 'account' && (
          <AccountView
            overview={overview}
            onRefreshOverview={refreshOverview}
            onOpenReport={setOrdersSubTab}
            onNavigateTab={setActiveTab}
          />
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        openPositionsCount={overview.openPositions.length}
      />

      <AutoTradeModal
        isOpen={showAutoTradeModal}
        onClose={() => setShowAutoTradeModal(false)}
        account={overview.account}
        indianSession={overview.sessions.indian}
        indexMeta={overview.indexMeta}
        onToggle={handleToggleAutoTrade}
        onOpenSearch={() => setShowSearchModal(true)}
      />

      <InstrumentSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectForChart={handleSearchSelectChart}
        onSelectForAutoTrade={handleSearchSelectAutoTrade}
      />

      <DecisionChainModal
        signal={inspectedSignal}
        onClose={() => setInspectedSignal(null)}
      />
    </div>
  );
}

export default App;
