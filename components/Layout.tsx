
import React, { useState } from 'react';
import { 
  Menu, X, Sprout, ClipboardList, Package, ShoppingCart, LogOut, Settings, Users, Activity, Database, NotebookPen, Wifi, DollarSign, Truck
} from 'lucide-react';
import { User, Role } from '../types';
import { TRANSLATIONS } from '../constants';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  currentLang: 'en' | 'ms';
  setLang: (l: 'en' | 'ms') => void;
  activeTab: string;
  setActiveTab: (t: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ 
  user, onLogout, currentLang, setLang, activeTab, setActiveTab, children 
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const t = (key: string) => TRANSLATIONS[key][currentLang];

  const NavItem = ({ id, icon: Icon, label }: { id: string, icon: any, label: string }) => (
    <button
      onClick={() => { setActiveTab(id); setIsSidebarOpen(false); }}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
        activeTab === id 
          ? 'bg-primary-600 text-white' 
          : 'text-gray-300 hover:bg-soil-800'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-soil-900 text-white z-20 flex justify-between items-center p-4">
        <span className="font-bold text-lg">MyceliumNexus</span>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-10 w-64 bg-soil-900 text-white transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0
      `}>
        <div className="p-6 pt-20 md:pt-6">
          <h1 className="text-2xl font-bold text-primary-500 mb-1">MyceliumNexus</h1>
          <p className="text-xs text-gray-400 mb-8">{user.role} @ {user.entityId === 'ent_001' ? 'Green Spore Co-op' : 'Entity'}</p>
          
          <nav className="space-y-1">
            <NavItem id="dashboard" icon={Sprout} label={t('dashboard')} />
            <NavItem id="master" icon={Settings} label={t('masterData')} />
            <NavItem id="production" icon={ClipboardList} label={t('production')} />
            <NavItem id="batchLog" icon={NotebookPen} label={t('batchLog')} /> 
            <NavItem id="inventory" icon={Package} label={t('inventory')} />
            <NavItem id="procurement" icon={ShoppingCart} label={t('procurement')} />
            <NavItem id="environment" icon={Wifi} label={t('environment')} />
            <NavItem id="delivery" icon={Truck} label={t('delivery')} />
            
            {user.role === Role.ADMIN && (
              <>
                <NavItem id="finance" icon={DollarSign} label={t('finance')} />
                <div className="pt-4 pb-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Admin Zone
                </div>
                <NavItem id="people" icon={Users} label={t('people')} />
                <NavItem id="activity" icon={Activity} label={t('activity')} />
              </>
            )}
          </nav>
        </div>

        <div className="absolute bottom-0 w-full p-6 border-t border-soil-800">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-400">Language</span>
            <div className="flex space-x-2 text-xs">
              <button 
                onClick={() => setLang('en')} 
                className={`px-2 py-1 rounded ${currentLang === 'en' ? 'bg-primary-600' : 'bg-soil-800'}`}
              >EN</button>
              <button 
                onClick={() => setLang('ms')} 
                className={`px-2 py-1 rounded ${currentLang === 'ms' ? 'bg-primary-600' : 'bg-soil-800'}`}
              >MS</button>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center space-x-2 text-gray-400 hover:text-white">
            <LogOut size={16} />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 md:pt-0 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
