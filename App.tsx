import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { MasterData } from './components/MasterData';
import { Production } from './components/Production';
import { Inventory } from './components/Inventory';
import { Procurement } from './components/Procurement';
import { PeopleManagement } from './components/PeopleManagement';
import { ActivityLog } from './components/ActivityLog';
import { DataManagement } from './components/DataManagement';
import { BatchLog } from './components/BatchLog'; 
import { EnvironmentControl } from './components/EnvironmentControl'; 
import { FinanceSales } from './components/FinanceSales'; 
import { OrderDelivery } from './components/OrderDelivery';
import { StorageService } from './services/storageService';
import { User, Role } from './types';
import { ArrowLeft, Database, AlertCircle, Warehouse, UserPlus, LogIn, Truck } from 'lucide-react';

type AuthView = 'init' | 'login' | 'register_user' | 'create_workspace';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AuthView>('init');
  
  // Data Sync Trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Create Workspace State
  const [wsName, setWsName] = useState('');
  const [wsPass, setWsPass] = useState('');

  // Register User State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regFarmName, setRegFarmName] = useState('');
  const [regFarmPass, setRegFarmPass] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [lang, setLang] = useState<'en' | 'ms'>('en');

  // Initialize Sync Listeners when User logs in
  useEffect(() => {
    if (user && user.entityId) {
      StorageService.initializeSync(user.entityId);
      
      // Subscribe to local storage updates (from sync) to trigger re-renders
      const unsubscribe = StorageService.subscribe(() => {
        setRefreshTrigger(prev => prev + 1);
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    // Check User Session safely
    try {
        const storedUser = localStorage.getItem('mn_session');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
            setView('login'); 
        } else {
            setView('login');
        }
    } catch (e) {
        console.warn("Session storage access denied");
        setView('login');
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
    StorageService.disconnectFarm(); 
    setView('login');
  };

  const handleCreateWorkspace = async () => {
      setError('');
      setLoading(true);
      try {
          if (!wsName || !wsPass) throw new Error("All fields required");
          await StorageService.createWorkspace({
              entityName: wsName,
              accessPassword: wsPass
          });
          alert("Workspace Created Successfully! Please register your Admin account now.");
          setRegFarmName(wsName);
          setRegFarmPass(wsPass);
          setView('register_user');
      } catch (e: any) {
          setError(e.message);
      } finally {
          setLoading(false);
      }
  };

  const handleRegisterUser = async () => {
      setError('');
      setLoading(true);
      try {
          if (!regName || !regEmail || !regPass || !regFarmName || !regFarmPass) {
              throw new Error("All fields are required.");
          }
          const newUser = await StorageService.registerUser({
              name: regName,
              email: regEmail,
              password: regPass,
              farmName: regFarmName,
              farmPassword: regFarmPass
          });
          setUser(newUser);
      } catch (e: any) {
          setError(e.message);
      } finally {
          setLoading(false);
      }
  };

  const handleLogin = async () => {
      setError('');
      setLoading(true);
      try {
          const u = await StorageService.login(loginEmail, loginPass);
          if (u) {
              setUser(u);
          } else {
              setError("Invalid email or password.");
          }
      } catch (e: any) {
          setError(e.message);
      } finally {
          setLoading(false);
      }
  };

  if (user) {
    const renderContent = () => {
      // We pass 'key={refreshTrigger}' to force re-render when data syncs
      // This is a simple way to ensure components reflect the latest 'getAll' data
      // without rewriting every component to use internal subscriptions.
      const commonProps = { user, key: refreshTrigger };

      switch (activeTab) {
        case 'dashboard': return <div className="text-center p-10"><h2 className="text-2xl font-bold">Welcome, {user.name}</h2><p>Connected to: {StorageService.getConnectedFarmName()}</p><p className="text-xs text-green-600 mt-2">● Cloud Sync Active</p></div>;
        case 'master': return <MasterData {...commonProps} refreshTrigger={refreshTrigger} />;
        case 'production': return <Production {...commonProps} />;
        case 'batchLog': return <BatchLog {...commonProps} />; 
        case 'inventory': return <Inventory {...commonProps} />;
        case 'procurement': return <Procurement {...commonProps} />;
        case 'environment': return <EnvironmentControl {...commonProps} />; 
        case 'delivery': return <OrderDelivery {...commonProps} />;
        case 'finance': return user.role === Role.ADMIN ? <FinanceSales {...commonProps} /> : <div className="p-10 text-center text-red-500">Access Denied</div>;
        case 'people': return user.role === Role.ADMIN ? <PeopleManagement {...commonProps} /> : <div className="p-10 text-center text-red-500">Access Denied</div>;
        case 'activity': return user.role === Role.ADMIN ? <ActivityLog {...commonProps} /> : <div className="p-10 text-center text-red-500">Access Denied</div>;
        case 'connection': return user.role === Role.ADMIN ? <DataManagement {...commonProps} /> : <div className="p-10 text-center text-red-500">Access Denied</div>;
        default: return null;
      }
    };
    
    return (
      <Layout 
        user={user} 
        onLogout={handleLogout} 
        currentLang={lang} 
        setLang={setLang} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
      >
        {renderContent()}
      </Layout>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden relative">
        <div className="bg-soil-900 p-8 text-center relative">
             <h1 className="text-3xl font-bold text-white mb-2">MyceliumNexus</h1>
             <p className="text-primary-100">Integrated Farming System</p>
        </div>
        
        <div className="p-8">
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4 flex items-center gap-2"><AlertCircle size={16}/>{error}</div>}

            {view === 'login' && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><LogIn size={20}/> Sign In</h2>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Email</label>
                        <input type="email" className="w-full border rounded p-2" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Password</label>
                        <input type="password" className="w-full border rounded p-2" value={loginPass} onChange={e => setLoginPass(e.target.value)} />
                    </div>
                    
                    <button onClick={handleLogin} disabled={loading} className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 disabled:opacity-50">
                        {loading ? 'Logging in...' : 'Sign In'}
                    </button>
                    
                    <div className="pt-4 border-t flex flex-col gap-2 text-center">
                        <p className="text-sm text-gray-500">New here?</p>
                        <button onClick={() => setView('register_user')} className="text-sm text-blue-600 font-semibold hover:underline">Register New User</button>
                        <span className="text-xs text-gray-400">- or -</span>
                        <button onClick={() => setView('create_workspace')} className="text-sm text-primary-600 font-semibold hover:underline">Create New Farm Workspace</button>
                    </div>
                </div>
            )}

            {view === 'register_user' && (
                <div className="space-y-3 h-[60vh] overflow-y-auto pr-2">
                    <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => setView('login')} className="text-gray-400 hover:text-gray-600"><ArrowLeft/></button>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><UserPlus size={20}/> Join Farm</h2>
                    </div>
                    
                    <div className="p-3 bg-gray-50 rounded border border-gray-100 space-y-2">
                        <h4 className="text-xs font-bold text-gray-500 uppercase">1. User Details</h4>
                        <input type="text" placeholder="Full Name" className="w-full border rounded p-2 text-sm" value={regName} onChange={e => setRegName(e.target.value)} />
                        <input type="email" placeholder="Email Address" className="w-full border rounded p-2 text-sm" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                        <input type="password" placeholder="Password" className="w-full border rounded p-2 text-sm" value={regPass} onChange={e => setRegPass(e.target.value)} />
                    </div>

                    <div className="p-3 bg-blue-50 rounded border border-blue-100 space-y-2">
                        <h4 className="text-xs font-bold text-blue-800 uppercase">2. Farm Credentials</h4>
                        <p className="text-xs text-blue-600 mb-1">Enter the name and password of the Farm you are joining.</p>
                        <input type="text" placeholder="Farm Workspace Name" className="w-full border rounded p-2 text-sm" value={regFarmName} onChange={e => setRegFarmName(e.target.value)} />
                        <input type="password" placeholder="Farm Access Password" className="w-full border rounded p-2 text-sm" value={regFarmPass} onChange={e => setRegFarmPass(e.target.value)} />
                    </div>

                    <button onClick={handleRegisterUser} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
                        {loading ? 'Processing...' : 'Register & Join'}
                    </button>
                </div>
            )}

             {view === 'create_workspace' && (
                <div className="space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => setView('login')} className="text-gray-400 hover:text-gray-600"><ArrowLeft/></button>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Warehouse size={20}/> New Workspace</h2>
                    </div>
                    
                    <div className="bg-orange-50 text-orange-800 p-3 rounded text-xs">
                        This creates a new blank database in the Cloud.
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Farm Name (Unique)</label>
                        <input type="text" className="w-full border rounded p-2" value={wsName} onChange={e => setWsName(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Access Password</label>
                        <input type="password" className="w-full border rounded p-2" placeholder="Shared password for staff" value={wsPass} onChange={e => setWsPass(e.target.value)} />
                    </div>
                    
                    <button onClick={handleCreateWorkspace} disabled={loading} className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 disabled:opacity-50">
                        {loading ? 'Creating...' : 'Create Workspace'}
                    </button>
                </div>
            )}

        </div>
      </div>
    </div>
  );
}