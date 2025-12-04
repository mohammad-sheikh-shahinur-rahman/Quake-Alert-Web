import React from 'react';
import { Map, List, ShieldAlert } from 'lucide-react';
import { ViewMode } from '../types';

interface NavBarProps {
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
}

const NavBar: React.FC<NavBarProps> = ({ currentView, setView }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-[1000] pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        {/* Curved Container Effect */}
        <div className="bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-700 backdrop-blur-lg bg-opacity-95 flex items-center justify-around px-2 py-3 relative overflow-visible">
          
          {/* Active Indicator Slide (Optional visual enhancement, kept simple for React) */}
          
          <button
            onClick={() => setView('list')}
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ${
              currentView === 'list' 
                ? 'bg-rose-500 -translate-y-4 shadow-lg shadow-rose-500/40 border-4 border-slate-100' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <List size={currentView === 'list' ? 24 : 20} />
            {currentView !== 'list' && <span className="text-[10px] mt-1">তালিকা</span>}
          </button>

          <button
            onClick={() => setView('map')}
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ${
              currentView === 'map' 
                ? 'bg-rose-500 -translate-y-4 shadow-lg shadow-rose-500/40 border-4 border-slate-100' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Map size={currentView === 'map' ? 24 : 20} />
            {currentView !== 'map' && <span className="text-[10px] mt-1">ম্যাপ</span>}
          </button>

          <button
            onClick={() => setView('safety')}
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ${
              currentView === 'safety' 
                ? 'bg-rose-500 -translate-y-4 shadow-lg shadow-rose-500/40 border-4 border-slate-100' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert size={currentView === 'safety' ? 24 : 20} />
            {currentView !== 'safety' && <span className="text-[10px] mt-1">সুরক্ষা</span>}
          </button>

        </div>
      </div>
    </div>
  );
};

export default NavBar;
