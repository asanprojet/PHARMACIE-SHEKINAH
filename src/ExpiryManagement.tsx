import { useEffect, useState } from 'react';
import { db } from './firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Clock,
  AlertTriangle,
  Plus,
  Search,
  ShieldAlert,
  CheckCircle,
  Trash2,
  Edit3,
} from 'lucide-react';
import Modal from './Modal';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { OperationType, handleFirestoreError, formatReadableError } from './firestoreUtils';

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
  const { authReady, firebaseUser, currentUser } = useAuth();
  const { showToast, confirmAction } = useToast();
  const siteId = currentUser?.siteId || 'site1';

  const [lots, setLots] = useState<LotRecord[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'EXP_30' | 'EXP_60' | 'EXP_90' | 'EXPIRED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<LotRecord | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newLotNumber, setNewLotNumber] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [newQuantity, setNewQuantity] = useState('50');
  const [newLocation, setNewLocation] = useState('Rayon A - Étagère 2');
  const [newStatus, setNewStatus] = useState<'DISPONIBLE' | 'QUARANTAINE' | 'DETRUIT'>('DISPONIBLE');

  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const lotsRef = collection(db, 'sites', siteId, 'lots');
    const qLots = query(lotsRef, orderBy('expiryDate', 'asc'));
    const unsubsLots = onSnapshot(
      qLots,
      (snap) => {
        setLots(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      },
      (err) => {
        showToast(formatReadableError(err), 'error');
        try {
          handleFirestoreError(err, OperationType.LIST, `sites/${siteId}/lots`);
        } catch {
          // logged
        }
      }
    );

    const invRef = collection(db, 'sites', siteId, 'inventory');
    const unsubsInv = onSnapshot(
      invRef,
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      },
      (err) => {
        showToast(formatReadableError(err), 'error');
        try {
          handleFirestoreError(err, OperationType.LIST, `sites/${siteId}/inventory`);
        } catch {
          // logged
        }
      }
    );

    return () => {
      unsubsLots();
      unsubsInv();
    };
  }, [authReady, firebaseUser, siteId, showToast]);

  const logAction = async (action: string) => {
    try {
      await addDoc(collection(db, 'sites', siteId, 'auditlogs'), {
        userId: currentUser?.email || firebaseUser?.email || 'Pharmacien',
        action,
        timestamp: serverTimestamp(),
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
    const newStatusVal = lot.quarantineStatus === 'QUARANTAINE' ? 'DISPONIBLE' : 'QUARANTAINE';
    const path = `sites/${siteId}/lots/${lot.id}`;
    try {
      await updateDoc(doc(db, 'sites', siteId, 'lots', lot.id), {
        quarantineStatus: newStatusVal,
        updatedAt: serverTimestamp(),
      });
      await logAction(`Gestion Lots: Lot ${lot.lotNumber || lot.id} (${lot.productName}) passé en statut ${newStatusVal}`);
      showToast(`Lot ${lot.lotNumber || lot.id} → ${newStatusVal}`, 'info');
    } catch (err) {
      showToast(formatReadableError(err), 'error');
      try {
        handleFirestoreError(err, OperationType.UPDATE, path);
      } catch {
        // logged
      }
    }
  };

  const openNewLotModal = () => {
    setEditingLot(null);
    setSelectedProductId(products.length > 0 ? products[0].id : '');
    setNewLotNumber(`LT-${new Date().getFullYear().toString().slice(-2)}${Date.now().toString().slice(-3)}`);
    setNewExpiryDate(new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0]);
    setNewQuantity('50');
    setNewLocation('Rayon A - Étagère 2');
    setNewStatus('DISPONIBLE');
    setIsModalOpen(true);
  };

  const openEditLotModal = (lot: LotRecord) => {
    setEditingLot(lot);
    setSelectedProductId(lot.productId || (products[0]?.id ?? ''));
    setNewLotNumber(lot.lotNumber || '');
    setNewExpiryDate(lot.expiryDate || '');
    setNewQuantity(String(lot.quantity ?? 0));
    setNewLocation(lot.storageLocation || 'Magasin Central');
    setNewStatus(lot.quarantineStatus || 'DISPONIBLE');
    setIsModalOpen(true);
  };

  const handleSaveLot = async () => {
    const prod = products.find((p) => p.id === selectedProductId) || products[0];
    if (!newLotNumber.trim() || !newExpiryDate) {
      showToast('Veuillez renseigner le numéro de lot et la date de péremption.', 'error');
      return;
    }
    if (!editingLot && !prod) {
      showToast('Veuillez créer au moins un médicament dans le catalogue Stock [F3].', 'error');
      return;
    }

    const qty = Math.max(0, parseInt(newQuantity, 10) || 0);
    setIsSubmitting(true);

    try {
      if (editingLot) {
        const path = `sites/${siteId}/lots/${editingLot.id}`;
        await updateDoc(doc(db, 'sites', siteId, 'lots', editingLot.id), {
          productId: prod ? prod.id : editingLot.productId,
          productName: prod ? prod.name : editingLot.productName,
          lotNumber: newLotNumber.trim().toUpperCase(),
          expiryDate: newExpiryDate,
          quantity: qty,
          storageLocation: newLocation.trim() || 'Magasin Central',
          quarantineStatus: newStatus,
          updatedAt: serverTimestamp(),
        });
        await logAction(
          `Modification Lot: ${newLotNumber.toUpperCase()} (${prod?.name || editingLot.productName}) - ${qty} u, Exp: ${newExpiryDate}, ${newStatus}`
        );
        showToast('Lot mis à jour.', 'success');
      } else {
        await addDoc(collection(db, 'sites', siteId, 'lots'), {
          productId: prod.id,
          productName: prod.name,
          lotNumber: newLotNumber.trim().toUpperCase(),
          expiryDate: newExpiryDate,
          quantity: qty,
          initialQuantity: qty,
          storageLocation: newLocation.trim() || 'Magasin Central',
          quarantineStatus: newStatus,
          createdAt: serverTimestamp(),
        });
        await logAction(`Création Lot: ${newLotNumber.toUpperCase()} pour ${prod.name} (${qty} unités, Exp: ${newExpiryDate})`);
        showToast(`Lot ${newLotNumber.toUpperCase()} enregistré.`, 'success');
      }

      setIsModalOpen(false);
      setEditingLot(null);
      setNewLotNumber('');
      setNewExpiryDate('');
    } catch (err) {
      showToast(formatReadableError(err), 'error');
      try {
        handleFirestoreError(
          err,
          editingLot ? OperationType.UPDATE : OperationType.CREATE,
          editingLot ? `sites/${siteId}/lots/${editingLot.id}` : `sites/${siteId}/lots`
        );
      } catch {
        // logged
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLot = async (lot: LotRecord) => {
    const confirmed = await confirmAction({
      title: 'Supprimer ce lot de traçabilité ?',
      message: `Voulez-vous supprimer le lot ${lot.lotNumber || lot.id} (${lot.productName}) ?`,
      confirmLabel: 'Supprimer le lot',
      danger: true,
    });
    if (!confirmed) return;

    const path = `sites/${siteId}/lots/${lot.id}`;
    try {
      await deleteDoc(doc(db, 'sites', siteId, 'lots', lot.id));
      await logAction(`Suppression Lot: ${lot.lotNumber || lot.id} (${lot.productName})`);
      showToast('Lot supprimé du registre.', 'info');
    } catch (err) {
      showToast(formatReadableError(err), 'error');
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch {
        // logged
      }
    }
  };

  const filteredLots = lots.filter((lot) => {
    const days = getDaysUntilExpiry(lot.expiryDate);
    const matchesSearch =
      lot.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.lotNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.storageLocation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.id?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesFilter = true;
    if (filterLevel === 'EXP_30') matchesFilter = days >= 0 && days <= 30;
    if (filterLevel === 'EXP_60') matchesFilter = days >= 0 && days <= 60;
    if (filterLevel === 'EXP_90') matchesFilter = days >= 0 && days <= 90;
    if (filterLevel === 'EXPIRED') matchesFilter = days < 0;

    return matchesSearch && matchesFilter;
  });

  const expiredCount = lots.filter((l) => getDaysUntilExpiry(l.expiryDate) < 0).length;
  const under30Count = lots.filter((l) => {
    const d = getDaysUntilExpiry(l.expiryDate);
    return d >= 0 && d <= 30;
  }).length;
  const under90Count = lots.filter((l) => {
    const d = getDaysUntilExpiry(l.expiryDate);
    return d >= 0 && d <= 90;
  }).length;

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
            onClick={openNewLotModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={15} /> Enregistrer un Nouveau Lot
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
                  const isDestroyed = lot.quarantineStatus === 'DETRUIT';

                  return (
                    <tr key={lot.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-400">{lot.lotNumber || lot.id}</td>
                      <td className="py-3 px-4 font-semibold text-white">{lot.productName || lot.productId}</td>
                      <td className="py-3 px-4 text-slate-400">{lot.storageLocation || 'Magasin Central'}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-white tabular-nums">
                        {lot.quantity} unités
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-200">{lot.expiryDate}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border ${sev.color}`}>
                          {sev.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isDestroyed ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            DÉTRUIT / RETIRÉ
                          </span>
                        ) : isQuarantine ? (
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
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleQuarantine(lot)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border ${
                              isQuarantine
                                ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white'
                                : 'bg-purple-600/20 border-purple-500/30 text-purple-300 hover:bg-purple-600 hover:text-white'
                            }`}
                          >
                            {isQuarantine ? 'Libérer' : 'Quarantaine'}
                          </button>
                          <button
                            onClick={() => openEditLotModal(lot)}
                            className="p-1.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-600 hover:text-white transition-colors cursor-pointer"
                            title="Modifier ce lot"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteLot(lot)}
                            className="p-1.5 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-lg hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                            title="Supprimer ce lot"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Create / Edit Lot */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLot(null);
        }}
        title={editingLot ? `Modifier Lot ${editingLot.lotNumber || editingLot.id}` : "Enregistrement d'un Nouveau Lot de Médicament"}
      >
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Médicament Associé</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Quantité (Unités)</label>
              <input
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Emplacement</label>
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Statut Lot</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="DISPONIBLE">DISPONIBLE</option>
                <option value="QUARANTAINE">QUARANTAINE</option>
                <option value="DETRUIT">DÉTRUIT</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSaveLot}
            disabled={isSubmitting}
            className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle size={16} />
            {isSubmitting
              ? 'Enregistrement...'
              : editingLot
              ? 'Enregistrer les Modifications du Lot'
              : 'Valider la Traçabilité du Lot'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
