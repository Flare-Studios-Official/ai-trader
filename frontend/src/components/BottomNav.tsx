import React from 'react';
import { MainTab } from '../types';
import { Home, CandlestickChart, Briefcase, ClipboardList, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  openPositionsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  openPositionsCount,
}) => {
  const items: Array<{ id: MainTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'charts', label: 'Charts', icon: <CandlestickChart className="w-5 h-5" /> },
    {
      id: 'positions',
      label: 'Positions',
      icon: <Briefcase className="w-5 h-5" />,
      badge: openPositionsCount > 0 ? openPositionsCount : undefined,
    },
    { id: 'orders', label: 'Orders', icon: <ClipboardList className="w-5 h-5" /> },
    { id: 'account', label: 'Account', icon: <User className="w-5 h-5" /> },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 shadow-nav">
      <div className="max-w-6xl mx-auto flex items-center justify-around px-1 py-1.5 sm:py-2">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-colors min-w-[60px] ${
                isActive ? 'text-[#3F5BD9]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 bg-[#3F5BD9] text-white text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] leading-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
