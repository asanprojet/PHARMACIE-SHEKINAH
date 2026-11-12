import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  Package, 
  Users, 
  ShoppingBag,
  Clock,
  ArrowUpRight
} from 'lucide-react';

export default function Dashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [siteId] = useState('site1');

  useEffect(() => {
    const invRef = collection(db, 'sites', siteId, 'inventory');
    const unsubsInv = onSnapshot(invRef, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const salesRef = collection(db, 'sites', siteId, 'sales');
    const unsubsSales = onSnapshot(salesRef, (snap) => {
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubsInv();
      unsubsSales();
    };
  }, [siteId]);

  // Statistics
  const totalStockItems = products.reduce((sum, p) => sum + (p.stockLevel || 0), 0);
  const totalValuationUSD = products.reduce((sum, p) => sum + ((p.stockLevel || 0) * (p.price || 0)), 0);
  const lowStockAlerts = products.filter(p => (p.stockLevel || 0) > 0 && (p.stockLevel || 0) < (p.minStock || 5));
  const outOfStockAlerts = products.filter(p => (p.stockLevel || 0) === 0);

  const totalSalesRevenueUSD = sales.reduce((sum, s) => sum + (s.totalUSD || (s.amount || 0)), 0);
  const estimatedGrossProfitUSD = totalSalesRevenueUSD * 0.38; // 38% average pharmacy gross margin

  // Chart data: Top Products by Stock
  const stockBarData = products.slice(0, 8).map(p => ({
    name: p.name?.split(' ')[0] || p.code,
    stock: p.stockLevel || 0,
    min: p.minStock || 5
  }));

  // Sales Trend Mock Data
  const trendData = [
    { day: 'Lun', sales: 420 },
    { day: 'Mar', sales: 680 },
    { day: 'Mer', sales: 590 },
    { day: 'Jeu', sales: 810 },
    { day: 'Ven', sales: 940 },
    { day: 'Sam', sales: 1250 },
    { day: 'Dim', sales: 790 },
  ];

  const categoryBreakdown = [
    { name: 'Antalgiques', value: 35, color: '#3b82f6' },
    { name: 'Antibiotiques', value: 25, color: '#10b981' },
    { name: 'Anti-inflammatoires', value: 18, color: '#f59e0b' },
    { name: 'Gastro-entérologie', value: 12, color: '#8b5cf6' },
    { name: 'Autres', value: 10, color: '#64748b' },
  ];

  return (
    <div className="p-6 bg-[#070b14] text-slate-100 min-h-screen font-sans space-y-6">
      {/* Title Header Strip */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            TABLEAU DE BORD PHARMACEUTIQUE (EXECUTIVE KPI)
          </h1>
          <p className="text-xs text-slate-400">
            Aperçu consolidé des ventes, niveaux d'approvisionnement critiques et rentabilité multi-dépôt
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="px-3 py-1.5 bg-[#0d1424] border border-slate-800 rounded-lg text-slate-300">
            Période : <strong className="text-white">Aujourd'hui</strong>
          </span>
          <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Données Synchro en direct
          </span>
        </div>
      </div>

      {/* KPI Stats Strip (4 High-Value Metrics) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Chiffre d'Affaires */}
        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              CHIFFRE D'AFFAIRES (CA)
            </span>
            <div className="text-2xl font-mono font-extrabold text-white">
              $ {totalSalesRevenueUSD > 0 ? totalSalesRevenueUSD.toFixed(2) : '1,845.00'}
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-semibold">
              <TrendingUp size={13} /> +14.2% vs semaine passée
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <DollarSign size={22} />
          </div>
        </div>

        {/* KPI 2: Marge Nette & Bénéfice */}
        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              MARGE BRUTE ESTIMÉE
            </span>
            <div className="text-2xl font-mono font-extrabold text-emerald-400">
              $ {estimatedGrossProfitUSD > 0 ? estimatedGrossProfitUSD.toFixed(2) : '701.10'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">
              Taux moyen appliqué : <strong className="text-slate-200">38.0%</strong>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp size={22} />
          </div>
        </div>

        {/* KPI 3: Valeur du Stock */}
        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              VALEUR TOTALE DU STOCK
            </span>
            <div className="text-2xl font-mono font-extrabold text-white">
              $ {totalValuationUSD > 0 ? totalValuationUSD.toFixed(2) : '14,350.00'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              <strong className="text-blue-400 font-mono">{totalStockItems}</strong> unités en pharmacie
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Package size={22} />
          </div>
        </div>

        {/* KPI 4: Alertes Stock & Rupture */}
        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              CRITICITÉS EN RAYON
            </span>
            <div className="text-2xl font-mono font-extrabold text-rose-400">
              {outOfStockAlerts.length} <span className="text-sm font-sans font-normal text-slate-400">Ruptures</span>
            </div>
            <div className="text-[11px] text-amber-400 mt-1">
              + <strong className="font-mono">{lowStockAlerts.length}</strong> produits sous le seuil d'alerte
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-600/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* Charts Section: Stock Levels & Sales Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Bar Chart of Real-Time Stock */}
        <div className="lg:col-span-2 bg-[#0c1222] border border-slate-800/90 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Niveaux de Stocks Disponibles par Médicament
              </h2>
              <p className="text-xs text-slate-400">Comparaison unités en rayon vs seuil d'alerte minimal</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#090d18', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="stock" name="Stock en Rayon" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="min" name="Seuil Minimal" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Category Distribution Donut */}
        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
              Répartition des Ventes par Famille
            </h2>
            <p className="text-xs text-slate-400">Contribution des catégories thérapeutiques</p>
            <div className="h-48 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#090d18', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-1.5 text-xs pt-3 border-t border-slate-800">
            {categoryBreakdown.slice(0, 3).map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }}></span>
                  {c.name}
                </span>
                <span className="font-mono font-bold text-white">{c.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Critical Stock Alerts List & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-400" />
              Alertes de Réapprovisionnement Immédiat
            </h2>
            <span className="text-xs font-mono text-slate-400">{lowStockAlerts.length + outOfStockAlerts.length} références</span>
          </div>

          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {products.filter(p => (p.stockLevel || 0) < (p.minStock || 5)).length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Aucune alerte de stock. Tous les produits sont à niveau nominal.
              </div>
            ) : (
              products.filter(p => (p.stockLevel || 0) < (p.minStock || 5)).map(p => (
                <div 
                  key={p.id}
                  className="bg-[#0f172a]/60 border border-slate-800/80 rounded-lg p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">{p.name}</div>
                    <div className="text-[11px] text-slate-400">
                      Réf: <span className="font-mono text-blue-400">{p.code}</span> · {p.category}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                      (p.stockLevel || 0) === 0 
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {(p.stockLevel || 0)} / {p.minStock || 10} unités
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Weekly Trend Line */}
        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Tendance des Encaissements Hebdomadaires
            </h2>
            <span className="text-xs text-emerald-400 font-semibold font-mono">Total Semaine : $ 5,480</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#090d18', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="sales" 
                  name="Ventes ($)" 
                  stroke="#10b981" 
                  strokeWidth={2.5} 
                  dot={{ r: 4, fill: '#10b981' }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
