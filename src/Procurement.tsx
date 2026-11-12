import { useEffect, useState } from 'react';
import { db, auth } from './firebase';
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { 
  Truck, 
  ShoppingBag, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Plus, 
  Search, 
  Building2, 
  DollarSign, 
  Package, 
  X,
  FileCheck
} from 'lucide-react';
import Modal from './Modal';

export default function Procurement() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'alerts' | 'suppliers'>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [siteId] = useState('site1');
  const [exchangeRate] = useState(2230);

  // New PO Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [orderSupplier, setOrderSupplier] = useState('Sanofi Distribution Afrique');
  const [orderQty, setOrderQty] = useState('50');
  const [orderUnitCostUSD, setOrderUnitCostUSD] = useState('3.50');

  useEffect(() => {
    // 1. Fetch products & detect low stocks
    const invRef = collection(db, 'sites', siteId, 'inventory');
    const unsubsInv = onSnapshot(invRef, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setProducts(all);
      setAlerts(all.filter((p: any) => (Number(p.stockLevel) || 0) < (Number(p.minStock) || 10)));
    });

    // 2. Fetch active and received orders
    const procRef = collection(db, 'sites', siteId, 'procurement');
    const qOrders = query(procRef, orderBy('createdAt', 'desc'));
    const unsubsOrders = onSnapshot(qOrders, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubsInv();
      unsubsOrders();
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
      console.warn('Audit error:', e);
    }
  };

  const openOrderForProduct = (prod: any) => {
    setSelectedProductId(prod.id);
    setOrderUnitCostUSD(String(prod.purchasePriceUSD || (prod.price ? (prod.price * 0.6).toFixed(2) : 2.50)));
    setOrderQty(String(Math.max(50, (Number(prod.minStock) || 10) * 3)));
    setIsModalOpen(true);
  };

  const handleCreateOrder = async () => {
    const prod = products.find(p => p.id === selectedProductId) || products[0];
    if (!prod) return;

    const qty = parseInt(orderQty, 10) || 50;
    const unitCost = parseFloat(orderUnitCostUSD) || 2.50;
    const totalUSD = qty * unitCost;
    const poNumber = `BC-${Date.now().toString().slice(-6)}`;

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
      status: 'COMMANDE', // COMMANDE -> RECEPTIONNE
      createdAt: serverTimestamp(),
      orderedBy: auth.currentUser?.email || 'Gestionnaire Achat'
    });

    await logAction(`Bon de Commande ${poNumber} créé pour ${qty}x ${prod.name} auprès de ${orderSupplier} ($${totalUSD.toFixed(2)})`);
    setIsModalOpen(false);
  };

  // Reception of the order: updates the stock level and marks status as received
  const handleReceiveOrder = async (order: any) => {
    try {
      // 1. Update PO Status
      await updateDoc(doc(db, 'sites', siteId, 'procurement', order.id), {
        status: 'RECEPTIONNE',
        receivedAt: serverTimestamp(),
        receivedBy: auth.currentUser?.email || 'Magasinier Pharmacie'
      });

      // 2. Increment Stock Level in inventory
      const prod = products.find(p => p.id === order.productId);
      if (prod) {
        const currentStock = Number(prod.stockLevel) || 0;
        const newStock = currentStock + (Number(order.quantity) || 0);

        await updateDoc(doc(db, 'sites', siteId, 'inventory', prod.id), {
          stockLevel: newStock,
          purchasePriceUSD: Number(order.unitCostUSD) || prod.purchasePriceUSD || 2.50,
          updatedAt: new Date().toISOString()
        });
      }

      await logAction(`Réception Marchandise : Commande ${order.poNumber} (${order.quantity} unités de ${order.productName}) intégrée au stock`);
      alert(`La commande ${order.poNumber} a été réceptionnée. Le stock de ${order.productName} a été crédité de +${order.quantity} unités.`);
    } catch (err: any) {
      console.error('Error receiving order:', err);
      alert(`Erreur lors de la réception : ${err?.message || 'Erreur inconnue'}`);
    }
  };

  const suppliersList = [
    { name: 'Sanofi Distribution Afrique', country: 'RDC / France', delay: '48h', rating: '98%', status: 'Agréé Ministère' },
    { name: 'Denk Pharma RDC SARL', country: 'Allemagne / Kinshasa', delay: '24h', rating: '99%', status: 'Fournisseur Certifié' },
    { name: 'Cipla Therapeutics Ltd', country: 'Inde / Lubumbashi', delay: '72h', rating: '96%', status: 'Fournisseur ACT Agréé' },
    { name: 'Novartis Santé Publique', country: 'Suisse / Kinshasa', delay: '48h', rating: '99%', status: 'Partenaire Stratégique' },
    { name: 'Innotech International', country: 'France', delay: '5 jours', rating: '95%', status: 'Laboratoire Officiel' }
  ];

  return (
    <div className="p-6 bg-[#070b14] text-slate-100 min-h-screen font-sans space-y-6 select-none">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            ACHATS, APPROVISIONNEMENT & GESTION DES FOURNISSEURS [PUMP]
          </h1>
          <p className="text-xs text-slate-400">
            Calcul du Coût Moyen Pondéré, bons de commande grossistes, réceptions de marchandises et réapprovisionnement automatique
          </p>
        </div>

        <div className="flex items-center gap-3">
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
              <Building2 size={14} /> Fournisseurs & Grossistes
            </button>
          </div>

          <button
            onClick={() => {
              if (products.length > 0) setSelectedProductId(products[0].id);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={15} /> + Nouveau Bon de Commande
          </button>
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
              {orders.filter(o => o.status !== 'RECEPTIONNE').length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              En attente d'entrée en stock
            </div>
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
            <div className="text-2xl font-mono font-extrabold text-amber-400">
              {alerts.length}
            </div>
            <div className="text-[11px] text-amber-400 mt-1">
              Besoin de réapprovisionnement immédiat
            </div>
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
              {Math.round(orders.reduce((sum, o) => sum + (Number(o.totalUSD) || 0), 0) * exchangeRate).toLocaleString()} FC
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <DollarSign size={22} />
          </div>
        </div>
      </div>

      {/* VIEW 1: ORDERS LIST (Achats & Bons de commande) */}
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
                  <th className="py-3 px-4 text-center">STATUT LIVRAISON</th>
                  <th className="py-3 px-4 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      <p className="text-sm font-semibold text-slate-400">Aucun bon de commande en cours</p>
                      <p className="text-xs">Cliquez sur « + Nouveau Bon de Commande » ou commandez directement depuis l'onglet Alertes.</p>
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
                          {ord.createdAt?.toDate ? ord.createdAt.toDate().toLocaleDateString() : 'Aujourd\'hui'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          {ord.supplier}
                        </td>
                        <td className="py-3 px-4 text-slate-200">
                          <span className="font-semibold text-white">{ord.productName}</span>
                          {ord.productCode && (
                            <span className="text-[10px] text-slate-400 font-mono ml-1.5">({ord.productCode})</span>
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
                              <Clock size={12} /> EXPÉDIÉ / EN TRANSIT
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {!isReceived ? (
                            <button
                              onClick={() => handleReceiveOrder(ord)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer text-[11px] font-bold flex items-center gap-1.5 mx-auto shadow-sm"
                            >
                              <Package size={14} /> Réceptionner au Stock
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-mono">Stock incrémenté</span>
                          )}
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

      {/* VIEW 2: ALERTS LIST (Articles nécessitant réapprovisionnement) */}
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
                  <th className="py-3 px-4 text-right">PRIX ACHAT ESTIMÉ</th>
                  <th className="py-3 px-4 text-center">ACTION COMMANDE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {alerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <CheckCircle size={32} className="text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-300">Tous les stocks sont à niveau nominal</p>
                      <p className="text-xs">Aucun médicament n'est actuellement en situation de rupture ou sous le seuil d'alerte.</p>
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
                        <td className="py-3 px-4 font-semibold text-white">
                          {al.name}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {al.category} · {al.formDosage || 'Comprimé'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                            isRupture ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
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

      {/* VIEW 3: SUPPLIERS CATALOG (Fournisseurs Référencés) */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliersList.map((sup, idx) => (
            <div key={idx} className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Building2 size={20} />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {sup.status}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">{sup.name}</h3>
                <p className="text-xs text-slate-400">{sup.country}</p>
              </div>
              <div className="pt-2 border-t border-slate-800/80 flex justify-between text-xs text-slate-400 font-mono">
                <span>Délai moyen : <strong className="text-slate-200">{sup.delay}</strong></span>
                <span>Fiabilité : <strong className="text-emerald-400">{sup.rating}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Purchase Order Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Créer un Bon de Commande Grossiste (PUMP)"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Médicament à Commander</label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                const p = products.find(prod => prod.id === e.target.value);
                if (p) {
                  setOrderUnitCostUSD(String(p.purchasePriceUSD || (p.price ? (p.price * 0.6).toFixed(2) : 2.50)));
                }
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              {products.map(p => (
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
              {suppliersList.map((s, i) => (
                <option key={i} value={s.name}>{s.name} ({s.country})</option>
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
              <label className="block text-slate-300 font-semibold mb-1">Coût Unitaire PUMP ($)</label>
              <input
                type="number"
                step="0.10"
                value={orderUnitCostUSD}
                onChange={(e) => setOrderUnitCostUSD(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Cost preview */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs flex justify-between items-center font-mono">
            <span className="text-slate-400">Montant Total Commande :</span>
            <div className="text-right">
              <span className="text-emerald-400 font-bold block text-sm">
                $ {((parseInt(orderQty, 10) || 0) * (parseFloat(orderUnitCostUSD) || 0)).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500">
                {Math.round(((parseInt(orderQty, 10) || 0) * (parseFloat(orderUnitCostUSD) || 0)) * exchangeRate).toLocaleString()} FC
              </span>
            </div>
          </div>

          <button
            onClick={handleCreateOrder}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <FileCheck size={16} /> Émettre le Bon de Commande Officiel
          </button>
        </div>
      </Modal>
    </div>
  );
}
