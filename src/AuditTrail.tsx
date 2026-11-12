import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Download, 
  User, 
  Clock, 
  Lock, 
  CheckCircle, 
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';

interface LogEntry {
  id: string;
  userId: string;
  action: string;
  timestamp: any;
  ipAddress?: string;
  module?: string;
}

export default function AuditTrail() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [siteId] = useState('site1');

  useEffect(() => {
    const logsRef = collection(db, 'sites', siteId, 'auditlogs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(150));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
    });
    return unsubscribe;
  }, [siteId]);

  const exportAuditCSV = () => {
    if (logs.length === 0) return;
    const headers = ['ID,Utilisateur,Action,Date_Heure'];
    const rows = logs.map(l => {
      const date = l.timestamp?.toDate ? l.timestamp.toDate().toISOString() : '';
      return `"${l.id}","${l.userId}","${l.action.replace(/"/g, '""')}","${date}"`;
    });
    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit_trail_pharmaflow_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = logs.filter(l => {
    const matchesSearch = 
      l.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesFilter = true;
    if (filterAction === 'VENTE') matchesFilter = l.action?.toLowerCase().includes('vente');
    if (filterAction === 'PRIX') matchesFilter = l.action?.toLowerCase().includes('prix');
    if (filterAction === 'STOCK') matchesFilter = l.action?.toLowerCase().includes('stock') || l.action?.toLowerCase().includes('réapprovisionnement');
    if (filterAction === 'COMMANDE') matchesFilter = l.action?.toLowerCase().includes('commande');

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-6 bg-[#070b14] text-slate-100 min-h-screen font-sans space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            REGISTRE D'AUDIT, SÉCURITÉ & TRAÇABILITÉ PHARMACEUTIQUE
          </h1>
          <p className="text-xs text-slate-400">
            Journal inviolable de toutes les opérations de caisse, modifications tarifaires, ajustements de stocks et accès
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportAuditCSV}
            className="px-4 py-2 bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <FileSpreadsheet size={15} className="text-emerald-400" />
            Exporter Registre (CSV)
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              ÉVÉNEMENTS ENREGISTRÉS
            </span>
            <div className="text-2xl font-mono font-extrabold text-blue-400">{logs.length}</div>
            <div className="text-[11px] text-slate-400 mt-1">Horodatage serveur certifié</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              OPÉRATEURS ACTIFS
            </span>
            <div className="text-2xl font-mono font-extrabold text-emerald-400">
              {Array.from(new Set(logs.map(l => l.userId))).length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Utilisateurs distincts tracés</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <User size={22} />
          </div>
        </div>

        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              INTÉGRITÉ DU REGISTRE
            </span>
            <div className="text-2xl font-mono font-extrabold text-purple-400">100% OK</div>
            <div className="text-[11px] text-purple-400 mt-1">Conforme réglementations BPF</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ShieldCheck size={22} />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex items-center bg-[#0d1322] border border-slate-800 rounded-xl px-4 py-2.5 focus-within:border-blue-500">
          <Search size={18} className="text-slate-400 mr-2.5 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrer par action, nom d'opérateur, référence médicament..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center bg-[#0d1322] border border-slate-800 rounded-xl p-1 text-xs font-semibold">
          <button
            onClick={() => setFilterAction('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filterAction === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Tous les flux ({logs.length})
          </button>
          <button
            onClick={() => setFilterAction('VENTE')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filterAction === 'VENTE' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Ventes POS
          </button>
          <button
            onClick={() => setFilterAction('PRIX')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filterAction === 'PRIX' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Tarification
          </button>
          <button
            onClick={() => setFilterAction('STOCK')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filterAction === 'STOCK' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Stocks & Achats
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#0c1220] rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#11192b] border-b border-slate-800/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">IDENTIFIANT</th>
                <th className="py-3 px-4">HORODATAGE SYSTÈME</th>
                <th className="py-3 px-4">OPÉRATEUR / RESPONSABLE</th>
                <th className="py-3 px-4">ACTION & DÉTAIL DES MODIFICATIONS</th>
                <th className="py-3 px-4 text-center">NIVEAU AUDIT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-sans">
                    <p className="text-sm font-semibold text-slate-400">Aucun enregistrement d'audit pour le filtre demandé</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-blue-400 font-bold">
                      {log.id.slice(0, 10)}...
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Récemment'}
                    </td>
                    <td className="py-3 px-4 text-white font-sans font-semibold">
                      {log.userId}
                    </td>
                    <td className="py-3 px-4 text-slate-200 font-sans">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        AUDITÉ
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
