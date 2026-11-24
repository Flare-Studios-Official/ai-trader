import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Radio,
  Brain,
  GitBranch,
  Layers,
  Briefcase,
  History,
  Sliders,
  Coins,
  LineChart
} from 'lucide-react';

export type TabType =
  | 'overview'
  | 'charts'
  | 'bitcoin'
  | 'market_watch'
  | 'v12_signals'
  | 'ai_monitor'
  | 'decision_chain'
  | 'options_scanner'
  | 'positions'
  | 'history'
  | 'settings';

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  openPositionsCount: number;
  recentSignalsCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  openPositionsCount,
  recentSignalsCount
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'charts', label: 'Live Charts', icon: LineChart, highlight: true, badge: 'TV' },
    { id: 'bitcoin', label: 'Bitcoin (24/7)', icon: Coins },
    { id: 'market_watch', label: 'Indian F&O', icon: TrendingUp },
    { id: 'v12_signals', label: 'V12 Signals', icon: Radio, count: recentSignalsCount },
    { id: 'ai_monitor', label: 'AI Verifier', icon: Brain },
    { id: 'decision_chain', label: 'Decision Chain', icon: GitBranch },
    { id: 'options_scanner', label: 'Options Chain', icon: Layers },
    { id: 'positions', label: 'Positions', icon: Briefcase, count: openPositionsCount },
    { id: 'history', label: 'Trade History', icon: History },
    { id: 'settings', label: 'Risk & Settings', icon: Sliders },
  ];

  return (
    <nav className="bg-brand-surface/90 border-b border-brand-border backdrop-blur-sm sticky top-[95px] z-20 overflow-x-auto no-scrollbar shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center space-x-1 px-4 py-1.5 min-w-max">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id as TabType)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                  : tab.highlight
                  ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                  : 'text-brand-muted hover:text-gray-200 hover:bg-brand-card/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {(tab as any).badge && (
                <span className="text-[9px] bg-blue-500/30 text-blue-300 font-extrabold px-1 py-0.2 rounded border border-blue-400/40">
                  {(tab as any).badge}
                </span>
              )}
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-blue-500 text-white' : 'bg-brand-card text-brand-muted border border-brand-border'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
