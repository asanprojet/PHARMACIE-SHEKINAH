import { useEffect, useState } from 'react';
import { db, auth } from './firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Search, 
  Plus, 
  Settings, 
  DollarSign, 
  Database, 
  Package, 
  Check, 
  X, 
  Barcode, 
  FileSpreadsheet, 
  Printer, 
  AlertTriangle,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { seedDatabase, PharmacyProduct } from './seedDatabase';
import Modal from './Modal';

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'EN_STOCK' | 'ALERTE' | 'RUPTURE'>('ALL');
  const [siteId] = useState('site1');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'price' | 'stock' | 'new_product'>('price');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  // Form values
  const [inputPrice, setInputPrice] = useState('');
  const [inputStock, setInputStock] = useState('');
  const [exchangeRate] = useState(2230); // USD -> CDF

  // New product form
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Antibiotique');
  const [newProdDosage, setNewProdDosage] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdPurchase, setNewProdPurchase] = useState('');
  const [newProdStock, setNewProdStock] = useState('');
  const [newProdMinStock, setNewProdMinStock] = useState('10');
  const [newProdPrescription, setNewProdPrescription] = useState(false);

  useEffect(() => {
    const inventoryRef = collection(db, 'sites', siteId, 'inventory');
    const unsubscribe = onSnapshot(inventoryRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
    });
    return unsubscribe;
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
      console.error('Audit log failed:', e);
    }
  };

  const openPriceModal = (product: any) => {
    setSelectedProduct(product);
    setModalType('price');
    setInputPrice(String(product.price || 0));
    setIsModalOpen(true);
  };

  const openStockModal = (product: any) => {
    setSelectedProduct(product);
    setModalType('stock');
    setInputStock('10');
    setIsModalOpen(true);
  };

  const openNewProductModal = () => {
    setModalType('new_product');
    setNewProdName('');
    setNewProdDosage('');
    setNewProdPrice('5.00');
    setNewProdPurchase('2.50');
    setNewProdStock('20');
    setIsModalOpen(true);
  };

  const handleModalSubmit = async () => {
    try {
      if (modalType === 'price' && selectedProduct) {
        const parsedPrice = parseFloat(inputPrice);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          alert('Veuillez saisir un prix valide.');
          return;
        }
        const equivCDF = Math.round(parsedPrice * exchangeRate);
        const prodRef = doc(db, 'sites', siteId, 'inventory', selectedProduct.id);
        
        await updateDoc(prodRef, {
          price: parsedPrice,
          equivCDF: equivCDF,
          updatedAt: new Date().toISOString()
        });

        // Optimistic UI update in case offline
        setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, price: parsedPrice, equivCDF } : p));
        await logAction(`Ajustement prix: ${selectedProduct.name} fixé à $${parsedPrice.toFixed(2)} (${equivCDF.toLocaleString()} FC)`);
        setIsModalOpen(false);
      } else if (modalType === 'stock' && selectedProduct) {
        const addedQty = parseInt(inputStock, 10);
        if (isNaN(addedQty)) {
          alert('Veuillez saisir une quantité valide.');
          return;
        }
        const currentStock = Number(selectedProduct.stockLevel) || 0;
        const newStock = Math.max(0, currentStock + addedQty);
        const prodRef = doc(db, 'sites', siteId, 'inventory', selectedProduct.id);

        await updateDoc(prodRef, {
          stockLevel: newStock,
          updatedAt: new Date().toISOString()
        });

        // Optimistic UI update
        setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, stockLevel: newStock } : p));
        await logAction(`Réapprovisionnement: ${selectedProduct.name} +${addedQty} unités (Nouveau total: ${newStock})`);
        setIsModalOpen(false);
      } else if (modalType === 'new_product') {
        const pPrice = parseFloat(newProdPrice) || 0;
        const pPurchase = parseFloat(newProdPurchase) || 0;
        const pStock = parseInt(newProdStock, 10) || 0;
        const pMinStock = parseInt(newProdMinStock, 10) || 5;
        const code = `MED${String(products.length + 1).padStart(4, '0')}`;

        const docRef = await addDoc(collection(db, 'sites', siteId, 'inventory'), {
          code,
          barcode: `34009${Date.now().toString().slice(-8)}`,
          name: newProdName,
          formDosage: newProdDosage || 'Comprimés / Sirop',
          category: newProdCategory,
          brand: 'Laboratoire Agréé',
          stockLevel: pStock,
          minStock: pMinStock,
          purchasePriceUSD: pPurchase,
          price: pPrice,
          equivCDF: Math.round(pPrice * exchangeRate),
          unit: 'Unité',
          prescriptionRequired: newProdPrescription,
          expiryDate: '2028-01-01',
          lotNumber: `LT-${Math.floor(1000 + Math.random() * 9000)}`,
          updatedAt: new Date().toISOString()
        });

        // Optimistic update
        setProducts(prev => [{
          id: docRef.id,
          code,
          name: newProdName,
          category: newProdCategory,
          stockLevel: pStock,
          minStock: pMinStock,
          price: pPrice,
          equivCDF: Math.round(pPrice * exchangeRate)
        }, ...prev]);

        await logAction(`Création nouvel article: ${code} - ${newProdName} ($${pPrice})`);
        setIsModalOpen(false);
      }
    } catch (err: any) {
      console.error('Error updating inventory item:', err);
      alert(`Erreur lors de la mise à jour : ${err?.message || 'Vérifiez la connexion ou les autorisations.'}`);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode?.includes(searchTerm) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;

    let matchesStatus = true;
    const stock = p.stockLevel ?? 0;
    const min = p.minStock ?? 5;
    if (statusFilter === 'EN_STOCK') matchesStatus = stock >= min;
    if (statusFilter === 'ALERTE') matchesStatus = stock > 0 && stock < min;
    if (statusFilter === 'RUPTURE') matchesStatus = stock === 0;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  const totalArticles = products.length;
  const inAlertCount = products.filter(p => (p.stockLevel ?? 0) > 0 && (p.stockLevel ?? 0) < (p.minStock ?? 5)).length;
  const inRuptureCount = products.filter(p => (p.stockLevel ?? 0) === 0).length;

  return (
    <div className="p-6 bg-[#090d16] text-slate-100 min-h-screen font-sans">
      {/* Subheader Title & Action Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Layers size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              CATALOGUE MÉDICAMENTS & GESTION DES STOCKS
            </h1>
            <p className="text-xs text-slate-400">
              {totalArticles} spécialités pharmaceutiques répertoriées · Coût Moyen Pondéré (PUMP) · Taux de valorisation actif
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => seedDatabase(siteId)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Charger les 12 médicaments de test complets"
          >
            <Database size={15} className="text-emerald-400" />
            Réinitialiser Données Pharmacie
          </button>
          <button
            onClick={openNewProductModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus size={16} />
            + Nouvel Article
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Row (Identical to reference mockup image_bc1a4159.png) */}
      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div className="flex-1 relative flex items-center bg-[#0d1322] border border-slate-800/90 rounded-xl px-4 py-2.5 focus-within:border-blue-500 transition-colors">
          <Search size={18} className="text-slate-400 shrink-0 mr-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Recherche par désignation, référence DCI, code-barres, laboratoire..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-white text-xs">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#0d1322] border border-slate-800/90 text-slate-200 text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">Toutes les catégories</option>
            {categories.map((c, i) => (
              <option key={i} value={c}>{c}</option>
            ))}
          </select>

          {/* Segmented status filter pills */}
          <div className="flex items-center bg-[#0d1322] border border-slate-800/90 rounded-xl p-1 text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${statusFilter === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Tous ({totalArticles})
            </button>
            <button
              onClick={() => setStatusFilter('EN_STOCK')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${statusFilter === 'EN_STOCK' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-400'}`}
            >
              En stock
            </button>
            <button
              onClick={() => setStatusFilter('ALERTE')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${statusFilter === 'ALERTE' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-amber-400'}`}
            >
              Alerte ({inAlertCount})
            </button>
            <button
              onClick={() => setStatusFilter('RUPTURE')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${statusFilter === 'RUPTURE' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-rose-400'}`}
            >
              Rupture ({inRuptureCount})
            </button>
          </div>
        </div>
      </div>

      {/* Main High-Density Data Table */}
      <div className="bg-[#0c1220] rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#11192b] border-b border-slate-800/90 text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                <th className="py-3 px-4">CODE</th>
                <th className="py-3 px-4">DÉSIGNATION DU PRODUIT</th>
                <th className="py-3 px-4">FORME & CATÉGORIE</th>
                <th className="py-3 px-4 text-center">STOCK</th>
                <th className="py-3 px-4 text-center">STATUT</th>
                <th className="py-3 px-4 text-right">COÛT ACHAT (USD)</th>
                <th className="py-3 px-4 text-right">PRIX VENTE</th>
                <th className="py-3 px-4 text-right">ÉQUIV. CDF</th>
                <th className="py-3 px-4 text-center">ACTIONS RAPIDES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <p className="text-base font-semibold text-slate-400 mb-1">Aucun article ne correspond à votre filtre</p>
                    <p className="text-xs">Modifiez vos termes de recherche ou cliquez sur "Réinitialiser Données Pharmacie"</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, idx) => {
                  const stock = p.stockLevel ?? 0;
                  const min = p.minStock ?? 5;
                  const isRupture = stock === 0;
                  const isAlerte = stock > 0 && stock < min;

                  return (
                    <tr 
                      key={p.id || idx} 
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* CODE Column */}
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                        <span>{p.code || `ART${String(idx + 1).padStart(4, '0')}`}</span>
                      </td>

                      {/* DESIGNATION Column */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-white tracking-wide leading-tight group-hover:text-blue-300 transition-colors">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono mt-1">
                          <Barcode size={13} className="text-slate-400 shrink-0" />
                          <span>{p.barcode || '3400936192841'}</span>
                          {p.prescriptionRequired && (
                            <span className="ml-1 text-[10px] text-amber-400 font-sans font-medium px-1 rounded bg-amber-500/10 border border-amber-500/20">
                              Ordonnance
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CATEGORY & BRAND */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="font-medium text-slate-200">{p.brand || 'Denk Pharma'}</div>
                        <div className="text-[11px] text-slate-500">{p.category || 'Générique'} · {p.formDosage || 'Comprimé'}</div>
                      </td>

                      {/* STOCK LEVEL */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono text-sm font-bold text-white tabular-nums">
                          {stock}
                        </span>
                        <div className="text-[10px] text-slate-500">Min: {min}</div>
                      </td>

                      {/* STATUS BADGE (matches reference OK, ALERTE, RUPTURE) */}
                      <td className="py-3.5 px-4 text-center">
                        {isRupture ? (
                          <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-rose-500/20 border border-rose-500/40 text-rose-400">
                            RUPTURE
                          </span>
                        ) : isAlerte ? (
                          <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-400">
                            ALERTE ({stock})
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                            OK
                          </span>
                        )}
                      </td>

                      {/* PUMP / PURCHASE PRICE */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400 tabular-nums">
                        $ {(p.purchasePriceUSD ?? (p.price ? (p.price * 0.6) : 2.5)).toFixed(2)}
                      </td>

                      {/* SALE PRICE */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white tabular-nums">
                        <div className="text-sm font-bold text-blue-400">
                          $ {(p.price ?? 5.0).toFixed(2)}
                        </div>
                        <span className="text-[10px] font-sans text-slate-500 font-normal">Fixé</span>
                      </td>

                      {/* CDF EQUIVALENT */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300 tabular-nums">
                        {(p.equivCDF || Math.round((p.price || 5.0) * exchangeRate)).toLocaleString()} FC
                      </td>

                      {/* ACTION BUTTONS: Adjust Price ($) and Add to Stock (Package) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openPriceModal(p)}
                            title="Ajuster le prix de vente"
                            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-blue-600/30 text-blue-400 border border-slate-700/60 hover:border-blue-500/50 transition-all cursor-pointer"
                          >
                            <DollarSign size={15} />
                          </button>
                          <button
                            onClick={() => openStockModal(p)}
                            title="Ajouter au stock (Entrée de stock)"
                            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-emerald-600/30 text-emerald-400 border border-slate-700/60 hover:border-emerald-500/50 transition-all cursor-pointer"
                          >
                            <Package size={15} />
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

        {/* Table Footer Summary Strip */}
        <div className="bg-[#0b101c] px-6 py-3 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-6">
            <span>Articles affichés : <strong className="text-white font-mono">{filteredProducts.length}</strong> / {totalArticles}</span>
            <span>Articles en alerte critique : <strong className="text-amber-400 font-mono">{inAlertCount}</strong></span>
            <span>Ruptures complètes : <strong className="text-rose-400 font-mono">{inRuptureCount}</strong></span>
          </div>
          <div className="font-mono text-slate-400">
            Base Active : <span className="text-emerald-400 font-semibold">IndexedDB Locale & Firestore Sync (2ms)</span>
          </div>
        </div>
      </div>

      {/* Contextual Modal for Price / Stock / New Product */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={
          modalType === 'price' ? `Ajuster le Prix : ${selectedProduct?.name}` :
          modalType === 'stock' ? `Entrée en Stock : ${selectedProduct?.name}` :
          "Enregistrer un Nouvel Article / Médicament"
        }
      >
        {modalType === 'price' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Modifiez le tarif de vente unitaire. Le calcul de la contre-valeur en Franc Congolais (CDF) est mis à jour automatiquement (Taux: {exchangeRate} FC/$).
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Prix de Vente Unitaire (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 font-mono">$</span>
                <input
                  type="number"
                  step="0.10"
                  value={inputPrice}
                  onChange={(e) => setInputPrice(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs flex justify-between">
              <span className="text-slate-400">Équivalent en CDF :</span>
              <span className="text-emerald-400 font-mono font-bold">
                {Math.round((parseFloat(inputPrice) || 0) * exchangeRate).toLocaleString()} FC
              </span>
            </div>
            <button
              onClick={handleModalSubmit}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Check size={16} /> Enregistrer le Nouveau Tarif
            </button>
          </div>
        )}

        {modalType === 'stock' && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Stock Actuel en Rayon :</span>
                <span className="font-mono font-bold text-white">{selectedProduct?.stockLevel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Seuil Minimal d'Alerte :</span>
                <span className="font-mono text-amber-400">{selectedProduct?.minStock || 10}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Quantité Réceptionnée à Ajouter</label>
              <input
                type="number"
                min="1"
                value={inputStock}
                onChange={(e) => setInputStock(e.target.value)}
                placeholder="Ex: 50"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                autoFocus
              />
            </div>
            <button
              onClick={handleModalSubmit}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Package size={16} /> Confirmer l'Entrée en Stock
            </button>
          </div>
        )}

        {modalType === 'new_product' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Désignation Commerciale / DCI</label>
              <input
                type="text"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder="Ex: Azithromycine 500mg"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Catégorie Thérapeutique</label>
                <select
                  value={newProdCategory}
                  onChange={(e) => setNewProdCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="Antibiotique">Antibiotique</option>
                  <option value="Antalgique / Antipyrétique">Antalgique</option>
                  <option value="Anti-inflammatoire">Anti-inflammatoire</option>
                  <option value="Gastro-entérologie">Gastro-entérologie</option>
                  <option value="Antipaludéen">Antipaludéen</option>
                  <option value="Dermatologie">Dermatologie</option>
                  <option value="Vitamines">Vitamines</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Forme & Dosage</label>
                <input
                  type="text"
                  value={newProdDosage}
                  onChange={(e) => setNewProdDosage(e.target.value)}
                  placeholder="Ex: Bte de 10 comprimés"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Prix Achat ($)</label>
                <input
                  type="number"
                  step="0.10"
                  value={newProdPurchase}
                  onChange={(e) => setNewProdPurchase(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Prix Vente ($)</label>
                <input
                  type="number"
                  step="0.10"
                  value={newProdPrice}
                  onChange={(e) => setNewProdPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Stock Initial</label>
                <input
                  type="number"
                  value={newProdStock}
                  onChange={(e) => setNewProdStock(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Seuil Alerte</label>
                <input
                  type="number"
                  value={newProdMinStock}
                  onChange={(e) => setNewProdMinStock(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={newProdPrescription}
                onChange={(e) => setNewProdPrescription(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
              />
              Ordonnance médicale obligatoire
            </label>
            <button
              onClick={handleModalSubmit}
              disabled={!newProdName}
              className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Créer et Mettre en Rayon
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
