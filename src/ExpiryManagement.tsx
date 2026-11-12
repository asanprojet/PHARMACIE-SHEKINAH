import { useEffect, useState } from 'react';
import { db, auth } from './firebase';
import { collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Clock, 
  AlertTriangle, 
  Calendar, 
  Plus, 
  Search, 
  Filter, 
  ShieldAlert, 
  CheckCircle, 
  Trash2, 
  Layers,
  ArrowRight
} from 'lucide-react';
import Modal from './Modal';

interface LotRecord {
  id: string;
  productId: string;
  productName: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  initialQuantity?: number;
  quarantineStatus?: 'DISPONIBLE' | 'QUARANTAINE' | 'DETRUIT';
  manufacturer?: string;
  storageLocation?: string;
}

export default function ExpiryManagement() {
  const [lots, setLots] = useState<LotRecord[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'EXP_30' | 'EXP_60' | 'EXP_90' | 'EXPIRED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [siteId] = useState('site1');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newLotNumber, setNewLotNumber] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [newQuantity, setNewQuantity] = useState('50');
  const [newLocation, setNewLocation] = useState('Rayon A - Étagère 2');

  useEffect(() => {
    // 1. Fetch lots
    const lotsRef = collection(db, 'sites', siteId, 'lots');
    const qLots = query(lotsRef, orderBy('expiryDate', 'asc'));
    const unsubsLots = onSnapshot(qLots, (snap) => {
      setLots(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });

    // 2. Fetch inventory for references
    const invRef = collection(db, 'sites', siteId, 'inventory');
    const unsubsInv = onSnapshot(invRef, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });

    return () => {
      unsubsLots();
      unsubsInv();
    };
  }, [siteId]);

  const logAction = async (action: string) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'sites', siteId, 'auditlogs'), {
        userId: auth.currentUser.email || auth.currentUser.uid,
        action,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.warn('Audit log error:', e);
    }
  };

  const getDaysUntilExpiry = (expiryDate: string): number => {
    if (!expiryDate) return 999;
    const expiry = new Date(expiryDate);
    const now = new Date();
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getExpirySeverity = (days: number) => {
    if (days < 0) return { label: 'PÉRIMÉ (RETRAIT)', color: 'bg-rose-600/20 text-rose-400 border-rose-500/40', badge: 'CRITIQUE' };
    if (days <= 30) return { label: `J-${days} (30 JOURS)`, color: 'bg-rose-500/20 text-rose-300 border-rose-500/30', badge: 'URGENT' };
    if (days <= 60) return { label: `J-${days} (60 JOURS)`, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', badge: 'ALERTE' };
    if (days <= 90) return { label: `J-${days} (90 JOURS)`, color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', badge: 'ATTENTION' };
    return { label: `Conforme (${days} j)`, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', badge: 'OK' };
  };

  const handleQuarantine = async (lot: LotRecord) => {
    const newStatus = lot.quarantineStatus === 'QUARANTAINE' ? 'DISPONIBLE' : 'QUARANTAINE';
    await updateDoc(doc(db, 'sites', siteId, 'lots', lot.id), {
      quarantineStatus: newStatus,
      updatedAt: serverTimestamp()
    });
    await logAction(`Gestion Lots: Lot ${lot.lotNumber || lot.id} (${lot.productName}) passé en statut ${newStatus}`);
  };

  const handleCreateLot = async () => {
    const prod = products.find(p => p.id === selectedProductId) || products[0];
    if (!prod || !newLotNumber || !newExpiryDate) {
      alert('Veuillez renseigner le numéro de lot et la date de péremption.');
      return;
    }

    const qty = parseInt(newQuantity, 10) || 50;

    await addDoc(collection(db, 'sites', siteId, 'lots'), {
      productId: prod.id,
      productName: prod.name,
      lotNumber: newLotNumber.toUpperCase(),
      expiryDate: newExpiryDate,
      quantity: qty,
      initialQuantity: qty,
      storageLocation: newLocation,
      quarantineStatus: 'DISPONIBLE',
      createdAt: serverTimestamp()
    });

    await logAction(`Création Lot: ${newLotNumber} pour ${prod.name} (${qty} unités, Exp: ${newExpiryDate})`);
    setIsModalOpen(false);
    setNewLotNumber('');
    setNewExpiryDate('');
  };

  const filteredLots = lots.filter(lot => {
    const days = getDaysUntilExpiry(lot.expiryDate);
    const matchesSearch = 
      lot.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.lotNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.id?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesFilter = true;
    if (filterLevel === 'EXP_30') matchesFilter = days >= 0 && days <= 30;
    if (filterLevel === 'EXP_60') matchesFilter = days >= 0 && days <= 60;
    if (filterLevel === 'EXP_90') matchesFilter = days >= 0 && days <= 90;
    if (filterLevel === 'EXPIRED') matchesFilter = days < 0;

    return matchesSearch && matchesFilter;
  });

  const expiredCount = lots.filter(l => getDaysUntilExpiry(l.expiryDate) < 0).length;
  const under30Count = lots.filter(l => { const d = getDaysUntilExpiry(l.expiryDate); return d >= 0 && d <= 30; }).length;
  const under90Count = lots.filter(l => { const d = getDaysUntilExpiry(l.expiryDate); return d >= 0 && d <= 90; }).length;

  return (
    <div className="p-6 bg-[#070b14] text-slate-100 min-h-screen font-sans space-y-6 select-none">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            CONTRÔLE DE PÉREMPTION & TRAÇABILITÉ DES LOTS (GMP/BPF)
          </h1>
          <p className="text-xs text-slate-400">
            Surveillance continue des dates limites d'utilisation (DLUO/DLP), mise en quarantaine et retraits officiels
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (products.length > 0) setSelectedProductId(products[0].id);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={15} /> + Enregistrer un Nouveau Lot
          </button>
        </div>
      </div>

      {/* KPI Severity Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              LOTS PÉRIMÉS (RETRAIT)
            </span>
            <div className="text-2xl font-mono font-extrabold text-rose-500">{expiredCount}</div>
            <div className="text-[11px] text-rose-400 mt-1">À détruire ou retourner</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-600/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <ShieldAlert size={22} />
          </div>
        </div>

        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              EXPIRATION &le; 30 JOURS
            </span>
            <div className="text-2xl font-mono font-extrabold text-rose-400">{under30Count}</div>
            <div className="text-[11px] text-slate-400 mt-1">Dispensation prioritaire (FEFO)</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              EXPIRATION &le; 90 JOURS
            </span>
            <div className="text-2xl font-mono font-extrabold text-amber-400">{under90Count}</div>
            <div className="text-[11px] text-amber-400 mt-1">Alerte gestionnaire achat</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              TOTAL LOTS TRAÇABLES
            </span>
            <div className="text-2xl font-mono font-extrabold text-emerald-400">{lots.length}</div>
            <div className="text-[11px] text-slate-400 mt-1">Conformité FEFO active</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle size={22} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex items-center bg-[#0d1322] border border-slate-800 rounded-xl px-4 py-2.5 focus-within:border-blue-500">
          <Search size={18} className="text-slate-400 mr-2.5 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par numéro de lot (LT-...), produit ou emplacement..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center bg-[#0d1322] border border-slate-800 rounded-xl p-1 text-xs font-semibold">
          <button
            onClick={() => setFilterLevel('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filterLevel === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Tous les lots ({lots.length})
          </button>
          <button
            onClick={() => setFilterLevel('EXP_30')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filterLevel === 'EXP_30' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-rose-400'}`}
          >
            &le; 30 Jours
          </button>
          <button
            onClick={() => setFilterLevel('EXP_90')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filterLevel === 'EXP_90' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-amber-400'}`}
          >
            &le; 90 Jours
          </button>
          <button
            onClick={() => setFilterLevel('EXPIRED')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filterLevel === 'EXPIRED' ? 'bg-red-800 text-white' : 'text-slate-400 hover:text-red-400'}`}
          >
            Périmés ({expiredCount})
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#0c1220] rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#11192b] border-b border-slate-800/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">N° DE LOT</th>
                <th className="py-3 px-4">SPÉCIALITÉ MÉDICALE</th>
                <th className="py-3 px-4">EMPLACEMENT EN OFFICINE</th>
                <th className="py-3 px-4 text-center">QUANTITÉ RESTANTE</th>
                <th className="py-3 px-4">DATE D'EXPIRATION</th>
                <th className="py-3 px-4 text-center">STATUT PÉREMPTION</th>
                <th className="py-3 px-4 text-center">ÉTAT LOT</th>
                <th className="py-3 px-4 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLots.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <CheckCircle size={32} className="text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-300">Aucun lot ne correspond au filtre sélectionné</p>
                  </td>
                </tr>
              ) : (
                filteredLots.map((lot) => {
                  const days = getDaysUntilExpiry(lot.expiryDate);
                  const sev = getExpirySeverity(days);
                  const isQuarantine = lot.quarantineStatus === 'QUARANTAINE';

                  return (
                    <tr key={lot.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-400">
                        {lot.lotNumber || lot.id}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {lot.productName || lot.productId}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {lot.storageLocation || 'Magasin Central'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-white tabular-nums">
                        {lot.quantity} unités
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-200">
                        {lot.expiryDate}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border ${sev.color}`}>
                          {sev.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isQuarantine ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            EN QUARANTAINE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            DISPONIBLE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleQuarantine(lot)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border ${
                            isQuarantine 
                              ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white'
                              : 'bg-rose-600/20 border-rose-500/30 text-rose-400 hover:bg-rose-600 hover:text-white'
                          }`}
                        >
                          {isQuarantine ? 'Libérer Quarantaine' : 'Mettre en Quarantaine'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal New Lot */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Enregistrement d'un Nouveau Lot de Médicament"
      >
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Médicament Associé</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Numéro de Lot Fabricant</label>
              <input
                type="text"
                placeholder="Ex: LT-2026A"
                value={newLotNumber}
                onChange={(e) => setNewLotNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none uppercase"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Date d'Expiration (DLUO)</label>
              <input
                type="date"
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Quantité Reçue (Unités)</label>
              <input
                type="number"
                min="1"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Emplacement Rayonnage</label>
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleCreateLot}
            className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle size={16} /> Valider la Traçabilité du Lot
          </button>
        </div>
      </Modal>
    </div>
  );
}
