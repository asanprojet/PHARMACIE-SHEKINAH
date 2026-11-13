import { useEffect, useState } from 'react';
import { db, auth } from './firebase';
import {
  collection,
  onSnapshot,
  query,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  writeBatch,
  increment,
} from 'firebase/firestore';
import {
  Truck,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Building2,
  DollarSign,
  Package,
  FileCheck,
  Edit3,
  Trash2,
} from 'lucide-react';
import Modal from './Modal';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import {
  OperationType,
  handleFirestoreError,
  formatReadableError,
} from './firestoreUtils';

export default function Procurement() {
  const { firebaseUser, authReady } = useAuth();
  const { showToast, confirmAction } = useToast();

  const [alerts, setAlerts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'alerts' | 'suppliers'>('orders');
  const [siteId] = useState('site1');
  const [exchangeRate] = useState(2230);
  const [isSaving, setIsSaving] = useState(false);

  // PO Create/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [orderSupplier, setOrderSupplier] = useState('Sanofi Distribution Afrique');
  const [orderQty, setOrderQty] = useState('50');
  const [orderUnitCostUSD, setOrderUnitCostUSD] = useState('3.50');

  // Supplier Create/Edit Modal
  const [isSupModalOpen, setIsSupModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [supName, setSupName] = useState('');
  const [supCountry, setSupCountry] = useState('RDC / Kinshasa');
  const [supPhone, setSupPhone] = useState('+243 ');
  const [supDelay, setSupDelay] = useState('48h');
  const [supRating, setSupRating] = useState('98%');
  const [supStatus, setSupStatus] = useState('Agréé Ministère');

  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const invRef = collection(db, 'sites', siteId, 'inventory');
    const unsubsInv = onSnapshot(
      invRef,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setProducts(all);
        setAlerts(
          all.filter(
            (p: any) => (Number(p.stockLevel) || 0) < (Number(p.minStock) || 10)
          )
        );
      },
      (error) => {
        console.error('Procurement inventory error:', error);
        showToast(formatReadableError(error), 'error');
      }
    );

    const procRef = collection(db, 'sites', siteId, 'procurement');
    const qOrders = query(procRef, orderBy('createdAt', 'desc'));
    const unsubsOrders = onSnapshot(
      qOrders,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.error('Procurement orders error:', error);
        showToast(formatReadableError(error), 'error');
      }
    );

    const supRef = collection(db, 'sites', siteId, 'suppliers');
    const unsubsSup = onSnapshot(
      supRef,
      (snap) => {
        setSuppliers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.error('Suppliers error:', error);
      }
    );

    return () => {
      unsubsInv();
      unsubsOrders();
      unsubsSup();
    };
  }, [siteId, authReady, firebaseUser, showToast]);

  const logAction = async (action: string) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'sites', siteId, 'auditlogs'), {
        userId: auth.currentUser.email || auth.currentUser.uid,
        action,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Audit error:', e);
    }
  };

  const defaultSuppliersList = [
    { id: 'def-1', name: 'Sanofi Distribution Afrique', country: 'RDC / France', phone: '+243 81 400 1122', delay: '48h', rating: '98%', status: 'Agréé Ministère' },
    { id: 'def-2', name: 'Denk Pharma RDC SARL', country: 'Allemagne / Kinshasa', phone: '+243 99 700 2233', delay: '24h', rating: '99%', status: 'Fournisseur Certifié' },
    { id: 'def-3', name: 'Cipla Therapeutics Ltd', country: 'Inde / Lubumbashi', phone: '+243 82 500 3344', delay: '72h', rating: '96%', status: 'Fournisseur ACT Agréé' },
    { id: 'def-4', name: 'Novartis Santé Publique', country: 'Suisse / Kinshasa', phone: '+243 84 600 4455', delay: '48h', rating: '99%', status: 'Partenaire Stratégique' },
    { id: 'def-5', name: 'Innotech International', country: 'France', phone: '+33 1 46 15 29 00', delay: '5 jours', rating: '95%', status: 'Laboratoire Officiel' },
  ];

  const activeSuppliers = suppliers.length > 0 ? suppliers : defaultSuppliersList;

  const openOrderForProduct = (prod: any) => {
    setEditingOrder(null);
    setSelectedProductId(prod.id);
    setOrderUnitCostUSD(
      String(
        prod.purchasePriceUSD ||
          (prod.price ? (Number(prod.price) * 0.6).toFixed(2) : '2.50')
      )
    );
    setOrderQty(String(Math.max(50, (Number(prod.minStock) || 10) * 3)));
    setOrderSupplier(activeSuppliers[0]?.name || 'Sanofi Distribution Afrique');
    setIsModalOpen(true);
  };

  const openEditOrder = (ord: any) => {
    setEditingOrder(ord);
    setSelectedProductId(ord.productId);
    setOrderSupplier(ord.supplier || activeSuppliers[0]?.name || '');
    setOrderQty(String(ord.quantity || 50));
    setOrderUnitCostUSD(String(ord.unitCostUSD || 2.5));
    setIsModalOpen(true);
  };

  const handleSaveOrder = async () => {
    if (isSaving) return;
    const prod = products.find((p) => p.id === selectedProductId) || products[0];
    if (!prod) {
      showToast('Aucun article disponible dans le catalogue pour commander.', 'error');
      return;
    }

    const qty = parseInt(orderQty, 10);
    const unitCost = parseFloat(orderUnitCostUSD);
    if (isNaN(qty) || qty <= 0 || isNaN(unitCost) || unitCost < 0) {
      showToast('Quantité ou coût unitaire invalide.', 'error');
      return;
    }

    const totalUSD = Number((qty * unitCost).toFixed(2));
    setIsSaving(true);

    try {
      if (editingOrder) {
        const path = `sites/${siteId}/procurement/${editingOrder.id}`;
        try {
          await updateDoc(doc(db, 'sites', siteId, 'procurement', editingOrder.id), {
            productId: prod.id,
            productCode: prod.code || '',
            productName: prod.name,
            supplier: orderSupplier,
            quantity: qty,
            unitCostUSD: unitCost,
            totalUSD,
            totalCDF: Math.round(totalUSD * exchangeRate),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
        await logAction(`Modification Bon de Commande ${editingOrder.poNumber} (${qty}x ${prod.name})`);
        showToast(`Bon de commande ${editingOrder.poNumber} mis à jour.`);
      } else {
        const poNumber = `BC-${Date.now().toString().slice(-6)}`;
        const path = `sites/${siteId}/procurement`;
        try {
          await addDoc(collection(db, 'sites', siteId, 'procurement'), {
            poNumber,
            productId: prod.id,
            productCode: prod.code || '',
            productName: prod.name,
            supplier: orderSupplier,
            quantity: qty,
            unitCostUSD: unitCost,
            totalUSD,
            totalCDF: Math.round(totalUSD * exchangeRate),
            status: 'COMMANDE',
            createdAt: serverTimestamp(),
            orderedBy: auth.currentUser?.email || 'Gestionnaire Achat',
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }

        await logAction(
          `Bon de Commande ${poNumber} créé pour ${qty}x ${prod.name} auprès de ${orderSupplier} ($${totalUSD.toFixed(2)})`
        );
        showToast(`Bon de commande ${poNumber} émis avec succès.`);
      }
      setIsModalOpen(false);
      setEditingOrder(null);
    } catch (err) {
      showToast(formatReadableError(err), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReceiveOrder = async (order: any) => {
    const path = `sites/${siteId}/procurement/${order.id}`;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'sites', siteId, 'procurement', order.id), {
        status: 'RECEPTIONNE',
        receivedAt: serverTimestamp(),
        receivedBy: auth.currentUser?.email || 'Magasinier Pharmacie',
      });

      const prod = products.find((p) => p.id === order.productId);
      const recvQty = Number(order.quantity) || 0;
      const recvCost = Number(order.unitCostUSD) || 0;

      if (prod) {
        const oldStock = Math.max(0, Number(prod.stockLevel) || 0);
        const oldPump = Number(prod.purchasePriceUSD) || recvCost;
        const newPump =
          oldStock + recvQty > 0
            ? Number(((oldStock * oldPump + recvQty * recvCost) / (oldStock + recvQty)).toFixed(2))
            : recvCost;

        batch.update(doc(db, 'sites', siteId, 'inventory', prod.id), {
          stockLevel: increment(recvQty),
          purchasePriceUSD: newPump,
          updatedAt: new Date().toISOString(),
        });
      }

      // Create traceable lot on reception
      const newLotRef = doc(collection(db, 'sites', siteId, 'lots'));
      batch.set(newLotRef, {
        productId: order.productId,
        productCode: order.productCode || '',
        productName: order.productName,
        lotNumber: `LOT-${order.poNumber || Date.now().toString().slice(-5)}`,
        expiryDate: new Date(Date.now() + 730 * 24 * 3600 * 1000).toISOString().split('T')[0],
        quantity: recvQty,
        initialQuantity: recvQty,
        storageLocation: 'Réception Entrepôt',
        quarantineStatus: 'DISPONIBLE',
        createdAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }

      await logAction(
        `Réception Marchandise : Commande ${order.poNumber} (+${recvQty} unités de ${order.productName}) intégrée au stock & PUMP recalculé`
      );
      showToast(
        `Commande ${order.poNumber} réceptionnée : +${recvQty} unités ajoutées au stock.`
      );
    } catch (err) {
      showToast(formatReadableError(err), 'error');
    }
  };

  const handleDeleteOrder = async (order: any) => {
    const confirmed = await confirmAction({
      title: `Supprimer le bon de commande ${order.poNumber} ?`,
      message: `Cette action supprimera définitivement l'ordre d'achat pour ${order.productName}.`,
      confirmLabel: 'Supprimer la commande',
      danger: true,
    });
    if (!confirmed) return;

    const path = `sites/${siteId}/procurement/${order.id}`;
    try {
      await deleteDoc(doc(db, 'sites', siteId, 'procurement', order.id));
      await logAction(`Suppression Bon de Commande ${order.poNumber}`);
      showToast(`Bon de commande ${order.poNumber} supprimé.`, 'info');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch (wrapped) {
        showToast(formatReadableError(wrapped), 'error');
      }
    }
  };

  // Suppliers CRUD
  const openNewSupplier = () => {
    setEditingSupplier(null);
    setSupName('');
    setSupCountry('RDC / Kinshasa');
    setSupPhone('+243 ');
    setSupDelay('48h');
    setSupRating('98%');
    setSupStatus('Agréé Ministère');
    setIsSupModalOpen(true);
  };

  const openEditSupplier = (sup: any) => {
    setEditingSupplier(sup);
    setSupName(sup.name || '');
    setSupCountry(sup.country || '');
    setSupPhone(sup.phone || '');
    setSupDelay(sup.delay || '48h');
    setSupRating(sup.rating || '98%');
    setSupStatus(sup.status || 'Agréé Ministère');
    setIsSupModalOpen(true);
  };

  const handleSaveSupplier = async () => {
    if (!supName.trim()) {
      showToast('Le nom du fournisseur est obligatoire.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      if (editingSupplier && !String(editingSupplier.id).startsWith('def-')) {
        const path = `sites/${siteId}/suppliers/${editingSupplier.id}`;
        try {
          await updateDoc(doc(db, 'sites', siteId, 'suppliers', editingSupplier.id), {
            name: supName.trim(),
            country: supCountry.trim(),
            phone: supPhone.trim(),
            delay: supDelay.trim(),
            rating: supRating.trim(),
            status: supStatus.trim(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
        showToast(`Fournisseur "${supName.trim()}" mis à jour.`);
      } else {
        const path = `sites/${siteId}/suppliers`;
        try {
          await addDoc(collection(db, 'sites', siteId, 'suppliers'), {
            name: supName.trim(),
            country: supCountry.trim(),
            phone: supPhone.trim(),
            delay: supDelay.trim(),
            rating: supRating.trim(),
            status: supStatus.trim(),
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
        await logAction(`Ajout Fournisseur Grossiste: ${supName.trim()}`);
        showToast(`Fournisseur "${supName.trim()}" enregistré.`);
      }
      setIsSupModalOpen(false);
    } catch (err) {
      showToast(formatReadableError(err), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSupplier = async (sup: any) => {
    if (String(sup.id).startsWith('def-')) {
      showToast('Initialisez d\'abord les données pharmacie pour personnaliser la liste.', 'info');
      return;
    }
    const confirmed = await confirmAction({
      title: `Supprimer le fournisseur "${sup.name}" ?`,
      message: 'Ce fournisseur sera retiré de votre annuaire grossiste.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;

    const path = `sites/${siteId}/suppliers/${sup.id}`;
    try {
      await deleteDoc(doc(db, 'sites', siteId, 'suppliers', sup.id));
      await logAction(`Suppression Fournisseur: ${sup.name}`);
      showToast(`Fournisseur "${sup.name}" supprimé.`, 'info');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch (wrapped) {
        showToast(formatReadableError(wrapped), 'error');
      }
    }
  };

  return (
    <div className="p-6 bg-[#070b14] text-slate-100 min-h-screen font-sans space-y-6 select-none">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            ACHATS, APPROVISIONNEMENT & GESTION DES FOURNISSEURS [PUMP]
          </h1>
          <p className="text-xs text-slate-400">
            Calcul du Coût Moyen Pondéré, bons de commande grossistes, réceptions avec création automatique de lots
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-[#0c1220] border border-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'orders' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Truck size={14} /> Commandes Achats ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'alerts' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle size={14} /> Alertes Ruptures ({alerts.length})
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'suppliers' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 size={14} /> Fournisseurs ({activeSuppliers.length})
            </button>
          </div>

          {activeTab === 'suppliers' ? (
            <button
              onClick={openNewSupplier}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={15} /> Nouveau Fournisseur
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingOrder(null);
                if (products.length > 0) {
                  openOrderForProduct(products[0]);
                } else {
                  showToast('Ajoutez d\'abord un médicament dans le catalogue [F3].', 'info');
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={15} /> Nouveau Bon de Commande
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              COMMANDES EN COURS DE LIVRAISON
            </span>
            <div className="text-2xl font-mono font-extrabold text-blue-400">
              {orders.filter((o) => o.status !== 'RECEPTIONNE').length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">En attente d'entrée en stock</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              MÉDICAMENTS EN ALERTE CRITIQUE
            </span>
            <div className="text-2xl font-mono font-extrabold text-amber-400">{alerts.length}</div>
            <div className="text-[11px] text-amber-400 mt-1">Besoin de réapprovisionnement immédiat</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              VOLUME TOTAL ACHAT ENGAGÉ
            </span>
            <div className="text-2xl font-mono font-extrabold text-emerald-400">
              $ {orders.reduce((sum, o) => sum + (Number(o.totalUSD) || 0), 0).toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">
              {Math.round(
                orders.reduce((sum, o) => sum + (Number(o.totalUSD) || 0), 0) * exchangeRate
              ).toLocaleString()}{' '}
              FC
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <DollarSign size={22} />
          </div>
        </div>
      </div>

      {/* VIEW 1: ORDERS LIST */}
      {activeTab === 'orders' && (
        <div className="bg-[#0c1220] rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#11192b] border-b border-slate-800/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">N° COMMANDE</th>
                  <th className="py-3 px-4">DATE D'ÉMISSION</th>
                  <th className="py-3 px-4">FOURNISSEUR GROSSISTE</th>
                  <th className="py-3 px-4">MÉDICAMENT COMMANDÉ</th>
                  <th className="py-3 px-4 text-center">QUANTITÉ</th>
                  <th className="py-3 px-4 text-right">P.U ACHAT</th>
                  <th className="py-3 px-4 text-right">MONTANT TOTAL</th>
                  <th className="py-3 px-4 text-center">STATUT</th>
                  <th className="py-3 px-4 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      <p className="text-sm font-semibold text-slate-400">Aucun bon de commande enregistré</p>
                      <p className="text-xs">Cliquez sur « Nouveau Bon de Commande » ou commandez depuis l'onglet Alertes.</p>
                    </td>
                  </tr>
                ) : (
                  orders.map((ord) => {
                    const isReceived = ord.status === 'RECEPTIONNE';
                    return (
                      <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">
                          {ord.poNumber || `BC-${ord.id.slice(-6)}`}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {ord.createdAt?.toDate ? ord.createdAt.toDate().toLocaleDateString() : "Aujourd'hui"}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">{ord.supplier}</td>
                        <td className="py-3 px-4 text-slate-200">
                          <span className="font-semibold text-white">{ord.productName}</span>
                          {ord.productCode && (
                            <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                              ({ord.productCode})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-white tabular-nums">
                          {ord.quantity} unités
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400 tabular-nums">
                          $ {(Number(ord.unitCostUSD) || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 tabular-nums">
                          $ {(Number(ord.totalUSD) || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isReceived ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle size={12} /> RÉCEPTIONNÉ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              <Clock size={12} /> EN TRANSIT
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!isReceived && (
                              <>
                                <button
                                  onClick={() => handleReceiveOrder(ord)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer text-[11px] font-bold flex items-center gap-1 shadow-sm"
                                  title="Réceptionner au stock et calculer PUMP"
                                >
                                  <Package size={13} /> Réceptionner
                                </button>
                                <button
                                  onClick={() => openEditOrder(ord)}
                                  className="p-1.5 bg-slate-800 hover:bg-amber-600/30 text-amber-400 border border-slate-700 rounded-lg cursor-pointer"
                                  title="Modifier la commande"
                                >
                                  <Edit3 size={13} />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteOrder(ord)}
                              className="p-1.5 bg-slate-800 hover:bg-rose-600/30 text-rose-400 border border-slate-700 rounded-lg cursor-pointer"
                              title="Supprimer la commande"
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
      )}

      {/* VIEW 2: ALERTS LIST */}
      {activeTab === 'alerts' && (
        <div className="bg-[#0c1220] rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#11192b] border-b border-slate-800/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">CODE</th>
                  <th className="py-3 px-4">MÉDICAMENT EN DÉFICIT</th>
                  <th className="py-3 px-4">CATÉGORIE / FORME</th>
                  <th className="py-3 px-4 text-center">STOCK ACTUEL</th>
                  <th className="py-3 px-4 text-center">SEUIL MINIMAL</th>
                  <th className="py-3 px-4 text-right">PUMP ESTIMÉ</th>
                  <th className="py-3 px-4 text-center">ACTION COMMANDE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {alerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <CheckCircle size={32} className="text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-300">Tous les stocks sont à niveau nominal</p>
                    </td>
                  </tr>
                ) : (
                  alerts.map((al) => {
                    const isRupture = (Number(al.stockLevel) || 0) === 0;
                    return (
                      <tr key={al.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">
                          {al.code || 'MED-00'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">{al.name}</td>
                        <td className="py-3 px-4 text-slate-400">
                          {al.category} · {al.formDosage || 'Comprimé'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                              isRupture
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {al.stockLevel} unités
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold text-slate-300">
                          {al.minStock || 10} unités
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">
                          $ {(al.purchasePriceUSD || (al.price ? al.price * 0.6 : 2.5)).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => openOrderForProduct(al)}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 mx-auto"
                          >
                            <Truck size={14} /> Passer Commande Grossiste
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
      )}

      {/* VIEW 3: SUPPLIERS CATALOG (FULL CRUD) */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeSuppliers.map((sup) => (
            <div
              key={sup.id}
              className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-5 space-y-3 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Building2 size={20} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {sup.status}
                  </span>
                  <button
                    onClick={() => openEditSupplier(sup)}
                    className="p-1.5 bg-slate-800 hover:bg-amber-600/30 text-amber-400 rounded-lg cursor-pointer"
                    title="Modifier"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteSupplier(sup)}
                    className="p-1.5 bg-slate-800 hover:bg-rose-600/30 text-rose-400 rounded-lg cursor-pointer"
                    title="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">{sup.name}</h3>
                <p className="text-xs text-slate-400">{sup.country} {sup.phone ? `· ${sup.phone}` : ''}</p>
              </div>
              <div className="pt-2 border-t border-slate-800/80 flex justify-between text-xs text-slate-400 font-mono">
                <span>Délai moyen : <strong className="text-slate-200">{sup.delay}</strong></span>
                <span>Fiabilité : <strong className="text-emerald-400">{sup.rating}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingOrder
            ? `Modifier Bon de Commande ${editingOrder.poNumber}`
            : 'Créer un Bon de Commande Grossiste (PUMP)'
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Médicament à Commander</label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                const p = products.find((prod) => prod.id === e.target.value);
                if (p) {
                  setOrderUnitCostUSD(
                    String(p.purchasePriceUSD || (p.price ? (p.price * 0.6).toFixed(2) : 2.5))
                  );
                }
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name} (Stock actuel: {p.stockLevel})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Laboratoire / Fournisseur Grossiste</label>
            <select
              value={orderSupplier}
              onChange={(e) => setOrderSupplier(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              {activeSuppliers.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} ({s.country})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Quantité (Unités)</label>
              <input
                type="number"
                min="1"
                value={orderQty}
                onChange={(e) => setOrderQty(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Coût Unitaire Achat ($)</label>
              <input
                type="number"
                step="0.10"
                min="0"
                value={orderUnitCostUSD}
                onChange={(e) => setOrderUnitCostUSD(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs flex justify-between items-center font-mono">
            <span className="text-slate-400">Montant Total Commande :</span>
            <div className="text-right">
              <span className="text-emerald-400 font-bold block text-sm">
                $ {((parseInt(orderQty, 10) || 0) * (parseFloat(orderUnitCostUSD) || 0)).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500">
                {Math.round(
                  (parseInt(orderQty, 10) || 0) * (parseFloat(orderUnitCostUSD) || 0) * exchangeRate
                ).toLocaleString()}{' '}
                FC
              </span>
            </div>
          </div>

          <button
            onClick={handleSaveOrder}
            disabled={isSaving}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <FileCheck size={16} />
            {isSaving
              ? 'Enregistrement...'
              : editingOrder
              ? 'Mettre à jour le Bon de Commande'
              : 'Émettre le Bon de Commande Officiel'}
          </button>
        </div>
      </Modal>

      {/* Supplier Create / Edit Modal */}
      <Modal
        isOpen={isSupModalOpen}
        onClose={() => setIsSupModalOpen(false)}
        title={editingSupplier ? `Modifier Fournisseur : ${editingSupplier.name}` : 'Ajouter un Fournisseur Grossiste'}
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nom du Laboratoire / Grossiste</label>
            <input
              type="text"
              value={supName}
              onChange={(e) => setSupName(e.target.value)}
              placeholder="Ex: Pharma-Distribution RDC"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Pays / Ville</label>
              <input
                type="text"
                value={supCountry}
                onChange={(e) => setSupCountry(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Téléphone</label>
              <input
                type="text"
                value={supPhone}
                onChange={(e) => setSupPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Délai Moyen</label>
              <input
                type="text"
                value={supDelay}
                onChange={(e) => setSupDelay(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Fiabilité</label>
              <input
                type="text"
                value={supRating}
                onChange={(e) => setSupRating(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Agrément</label>
              <input
                type="text"
                value={supStatus}
                onChange={(e) => setSupStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <button
            onClick={handleSaveSupplier}
            disabled={isSaving}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-lg transition-colors cursor-pointer"
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer le Fournisseur'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
