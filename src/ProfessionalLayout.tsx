import { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Package, 
  ShoppingBag, 
  FileText, 
  CreditCard, 
  Clock, 
  Layers, 
  BarChart3, 
  UploadCloud, 
  Settings as SettingsIcon, 
  LogOut, 
  ShieldCheck, 
  DollarSign, 
  Cpu, 
  Wifi, 
  Store
} from 'lucide-react';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';

import Sales from './Sales';
import Inventory from './Inventory';
import Dashboard from './Dashboard';
import Procurement from './Procurement';
import ExpiryManagement from './ExpiryManagement';
import AuditTrail from './AuditTrail';
import InvoicesAndCredits from './InvoicesAndCredits';
import PatientsAndPrescriptions from './PatientsAndPrescriptions';
import Settings from './Settings';

import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

export default function ProfessionalLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'purchases' | 'invoices' | 'credits' | 'patients' | 'dashboard' | 'expiry' | 'audit' | 'settings'>('sales');
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [exchangeRate] = useState(2230);
  const [alertCount, setAlertCount] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to active inventory alerts for badge count
  useEffect(() => {
    const invRef = collection(db, 'sites', 'site1', 'inventory');
    const unsubscribe = onSnapshot(invRef, (snap) => {
      const count = snap.docs.filter(d => {
        const data = d.data();
        return (data.stockLevel || 0) < (data.minStock || 5);
      }).length;
      setAlertCount(count);
    });
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); setActiveTab('sales'); }
      else if (e.key === 'F3') { e.preventDefault(); setActiveTab('inventory'); }
      else if (e.key === 'F4') { e.preventDefault(); setActiveTab('purchases'); }
      else if (e.key === 'F5') { e.preventDefault(); setActiveTab('invoices'); }
      else if (e.key === 'F6') { e.preventDefault(); setActiveTab('credits'); }
      else if (e.key === 'F7') { e.preventDefault(); setActiveTab('patients'); }
      else if (e.key === 'F8') { e.preventDefault(); setActiveTab('dashboard'); }
      else if (e.key === 'F9') { e.preventDefault(); setActiveTab('expiry'); }
      else if (e.key === 'F10') { e.preventDefault(); setActiveTab('audit'); }
      else if (e.key === 'F11') { e.preventDefault(); setActiveTab('settings'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    { id: 'sales', label: 'Caisse Rapide', shortcut: 'F2', icon: ShoppingCart },
    { id: 'inventory', label: 'Stock & Articles', shortcut: 'F3', icon: Package, badge: alertCount },
    { id: 'purchases', label: 'Achats (PUMP)', shortcut: 'F4', icon: ShoppingBag },
    { id: 'invoices', label: 'Factures Ventes', shortcut: 'F5', icon: FileText },
    { id: 'credits', label: 'Crédits Clients', shortcut: 'F6', icon: CreditCard },
    { id: 'patients', label: 'Patients & Ordonnances', shortcut: 'F7', icon: Layers },
    { id: 'dashboard', label: 'Tableau de Bord', shortcut: 'F8', icon: BarChart3 },
    { id: 'expiry', label: 'Péremptions (Lots)', shortcut: 'F9', icon: Clock },
    { id: 'audit', label: 'Traçabilité (Audit)', shortcut: 'F10', icon: ShieldCheck },
    { id: 'settings', label: 'Paramètres ERP', shortcut: 'F11', icon: SettingsIcon },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. TOP HEADER (Identical to reference screenshot image_6dac0453.png & image_bc1a4159.png) */}
      <header className="h-[70px] bg-[#090d18] border-b border-slate-800/90 px-4 md:px-6 flex items-center justify-between shrink-0 z-20">
        {/* Left: Brand Identity & Location */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
            <Store size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-base tracking-tight">
                PHARMAFLOW GROUP SARL
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 tracking-wider">
                KINSHASA / CENTRALE
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Av. du Commerce N° 124, Gombe · Lubumbashi, RDC</span>
            </div>
          </div>
        </div>

        {/* Center: System Status Widgets (Base SQLite/Firestore, 100% Hors Ligne, Clock, Currency Taux du Jour) */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Base Status */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1627] border border-slate-800 rounded-lg text-xs font-mono text-slate-300">
            <Cpu size={14} className="text-blue-400" />
            <span>Base : <strong className="text-emerald-400 font-semibold">IndexedDB+Cloud</strong> (2ms)</span>
          </div>

          {/* Offline/Online Readiness */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-xs font-bold text-emerald-400">
            <Wifi size={14} />
            <span>100% Hors Ligne Actif</span>
          </div>

          {/* Clock */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1627] border border-slate-800 rounded-lg text-xs font-mono text-slate-200">
            <Clock size={14} className="text-slate-400" />
            <span>{currentTime}</span>
          </div>

          {/* Taux du Jour */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0f172a] border border-blue-500/30 rounded-lg text-xs">
            <span className="w-5 h-5 rounded bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-[10px] font-mono">$</span>
            <div className="text-[11px] leading-tight font-mono">
              <span className="text-slate-400 block text-[9px] uppercase">TAUX DU JOUR</span>
              <span className="font-bold text-white">1 USD = <span className="text-emerald-400">2 230 CDF</span></span>
            </div>
          </div>
        </div>

        {/* Right: Authenticated User Pill & Logout Button */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
              👑
            </div>
            <div className="text-left text-xs leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white">Architecte Système</span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ARCHITECTE
                </span>
              </div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                <ShieldCheck size={11} /> Sécurisé · Accès Illimité à Vie
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Déconnexion sécurisée"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </header>

      {/* 2. NAVIGATION BAR (Directly matching the horizontal menu ribbon from reference screenshots) */}
      <nav className="h-[52px] bg-[#0c1220] border-b border-slate-800/90 px-4 md:px-6 flex items-center gap-1.5 overflow-x-auto shrink-0 z-10 scrollbar-none">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon size={15} className={isActive ? 'text-white' : 'text-slate-400'} />
              <span>{item.label}</span>

              {/* Alert Badge count for inventory/procurement */}
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-rose-500 text-white' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {item.badge}
                </span>
              )}

              {/* Keyboard Shortcut key label [F2], [F3], etc. */}
              {item.shortcut && (
                <span className={`text-[9px] font-mono px-1 py-0.2 rounded font-normal ml-0.5 ${
                  isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-400'
                }`}>
                  {item.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 3. ACTIVE VIEWPORT */}
      <main className="flex-1 overflow-y-auto bg-[#070b14] relative">
        {activeTab === 'sales' && <Sales />}
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'purchases' && <Procurement />}
        {(activeTab === 'invoices' || activeTab === 'credits') && <InvoicesAndCredits />}
        {activeTab === 'patients' && <PatientsAndPrescriptions />}
        {activeTab === 'expiry' && <ExpiryManagement />}
        {activeTab === 'audit' && <AuditTrail />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
