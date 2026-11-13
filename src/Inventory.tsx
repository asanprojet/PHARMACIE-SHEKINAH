import { useEffect, useState } from 'react';
import { db, auth } from './firebase';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Search,
  Plus,
  DollarSign,
  Database,
  Package,
  Check,
  X,
  Barcode,
  Layers,
  Edit3,
  Trash2,
} from 'lucide-react';
import { seedDatabase } from './seedDatabase';
import Modal from './Modal';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import {
  OperationType,
  handleFirestoreError,
  formatReadableError,
} from './firestoreUtils';

export default function Inventory() {
  const { firebaseUser, authReady } = useAuth();
  const { showToast, confirmAction } = useToast();

  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'EN_STOCK' | 'ALERTE' | 'RUPTURE'>('ALL');
  const [siteId] = useState('site1');
  const [exchangeRate] = useState(2230);
  const [isSaving, setIsSaving] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'price' | 'stock' | 'new_product' | 'edit_product'>('price');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Quick Price / Stock forms
  const [inputPrice, setInputPrice] = useState('');
  const [inputStock, setInputStock] = useState('');
  const [stockMode, setStockMode] = useState<'add' | 'set'>('add');

  // Full Create / Edit Product form
  const [formCode, setFormCode] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Antibiotique');
  const [formDosage, setFormDosage] = useState('');
  const [formBrand, setFormBrand] = useState('Laboratoire Agréé');
  const [formPrice, setFormPrice] = useState('');
  const [formPurchase, setFormPurchase] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formMinStock, setFormMinStock] = useState('10');
  const [formUnit, setFormUnit] = useState('Boîte');
  const [formExpiry, setFormExpiry] = useState('2028-01-01');
  const [formLot, setFormLot] = useState('');
  const [formPrescription, setFormPrescription] = useState(false);

  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    const path = `sites/${siteId}/inventory`;
    const inventoryRef = collection(db, 'sites', siteId, 'inventory');
    const unsubscribe = onSnapshot(
      inventoryRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(data);
      },
      (error) => {
        console.error('Inventory snapshot error:', error);
        showToast(formatReadableError(error), 'error');
      }
    );
    return unsubscribe;
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
      console.warn('Audit log skipped:', e);
    }
  };

  const openPriceModal = (product: any) => {
    setSelectedProduct(product);
    setModalType('price');
    setInputPrice(String(product.price ?? 0));
    setIsModalOpen(true);
  };

  const openStockModal = (product: any) => {
    setSelectedProduct(product);
    setModalType('stock');
    setStockMode('add');
    setInputStock('10');
    setIsModalOpen(true);
  };

  const openNewProductModal = () => {
    setSelectedProduct(null);
    setModalType('new_product');
    const nextNum = products.length + 1;
    setFormCode(`MED${String(nextNum).padStart(4, '0')}`);
    setFormBarcode(`34009${Date.now().toString().slice(-8)}`);
    setFormName('');
    setFormCategory('Antibiotique');
    setFormDosage('Comprimés / Gélules');
    setFormBrand('Laboratoire Agréé');
    setFormPrice('5.00');
    setFormPurchase('2.50');
    setFormStock('20');
    setFormMinStock('10');
    setFormUnit('Boîte');
    setFormExpiry('2028-06-30');
    setFormLot(`LT-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormPrescription(false);
    setIsModalOpen(true);
  };

  const openEditProductModal = (product: any) => {
    setSelectedProduct(product);
    setModalType('edit_product');
    setFormCode(product.code || '');
    setFormBarcode(product.barcode || '');
    setFormName(product.name || '');
    setFormCategory(product.category || 'Antibiotique');
    setFormDosage(product.formDosage || '');
    setFormBrand(product.brand || '');
    setFormPrice(String(product.price ?? 0));
    setFormPurchase(String(product.purchasePriceUSD ?? 0));
    setFormStock(String(product.stockLevel ?? 0));
    setFormMinStock(String(product.minStock ?? 5));
    setFormUnit(product.unit || 'Boîte');
    setFormExpiry(product.expiryDate || '2028-01-01');
    setFormLot(product.lotNumber || '');
    setFormPrescription(Boolean(product.prescriptionRequired));
    setIsModalOpen(true);
  };

  const handleModalSubmit = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (modalType === 'price' && selectedProduct) {
        const parsedPrice = parseFloat(inputPrice);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          showToast('Veuillez saisir un prix valide.', 'error');
          return;
        }
        const equivCDF = Math.round(parsedPrice * exchangeRate);
        const path = `sites/${siteId}/inventory/${selectedProduct.id}`;
        try {
          await updateDoc(doc(db, 'sites', siteId, 'inventory', selectedProduct.id), {
            price: parsedPrice,
            equivCDF,
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }

        await logAction(
          `Ajustement prix: ${selectedProduct.name} fixé à $${parsedPrice.toFixed(2)} (${equivCDF.toLocaleString()} FC)`
        );
        showToast(`Tarif de ${selectedProduct.name} mis à jour ($${parsedPrice.toFixed(2)}).`);
        setIsModalOpen(false);
      } else if (modalType === 'stock' && selectedProduct) {
        const qtyVal = parseInt(inputStock, 10);
        if (isNaN(qtyVal) || qtyVal < 0) {
          showToast('Veuillez saisir une quantité valide.', 'error');
          return;
        }
        const currentStock = Number(selectedProduct.stockLevel) || 0;
        const newStock = stockMode === 'add' ? currentStock + qtyVal : Math.max(0, qtyVal);
        const path = `sites/${siteId}/inventory/${selectedProduct.id}`;

        try {
          await updateDoc(doc(db, 'sites', siteId, 'inventory', selectedProduct.id), {
            stockLevel: newStock,
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }

        await logAction(
          `Ajustement stock: ${selectedProduct.name} (${currentStock} → ${newStock} unités)`
        );
        showToast(`Stock mis à jour : ${newStock} unités disponibles.`);
        setIsModalOpen(false);
      } else if (modalType === 'new_product') {
        if (!formName.trim()) {
          showToast('La désignation du produit est obligatoire.', 'error');
          return;
        }
        const pPrice = parseFloat(formPrice) || 0;
        const pPurchase = parseFloat(formPurchase) || 0;
        const pStock = parseInt(formStock, 10) || 0;
        const pMinStock = parseInt(formMinStock, 10) || 5;
        const code = formCode.trim() || `MED${Date.now().toString().slice(-4)}`;
        const lotNo = formLot.trim() || `LT-${Math.floor(1000 + Math.random() * 9000)}`;
        const invPath = `sites/${siteId}/inventory`;

        let createdId = '';
        try {
          const docRef = await addDoc(collection(db, 'sites', siteId, 'inventory'), {
            code,
            barcode: formBarcode.trim() || `34009${Date.now().toString().slice(-8)}`,
            name: formName.trim(),
            formDosage: formDosage.trim() || 'Comprimés / Sirop',
            category: formCategory,
            brand: formBrand.trim() || 'Laboratoire Agréé',
            stockLevel: pStock,
            minStock: pMinStock,
            purchasePriceUSD: pPurchase,
            price: pPrice,
            equivCDF: Math.round(pPrice * exchangeRate),
            unit: formUnit.trim() || 'Unité',
            prescriptionRequired: formPrescription,
            expiryDate: formExpiry || '2028-01-01',
            lotNumber: lotNo,
            updatedAt: new Date().toISOString(),
          });
          createdId = docRef.id;

          // Create corresponding FEFO lot
          await addDoc(collection(db, 'sites', siteId, 'lots'), {
            productId: createdId,
            productCode: code,
            productName: formName.trim(),
            lotNumber: lotNo.toUpperCase(),
            expiryDate: formExpiry || '2028-01-01',
            quantity: pStock,
            initialQuantity: pStock,
            storageLocation: 'Rayon Principal',
            quarantineStatus: 'DISPONIBLE',
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, invPath);
        }

        await logAction(`Création nouvel article: ${code} - ${formName.trim()} ($${pPrice.toFixed(2)})`);
        showToast(`Article "${formName.trim()}" ajouté au catalogue avec succès.`);
        setIsModalOpen(false);
      } else if (modalType === 'edit_product' && selectedProduct) {
        if (!formName.trim()) {
          showToast('La désignation du produit est obligatoire.', 'error');
          return;
        }
        const pPrice = parseFloat(formPrice) || 0;
        const pPurchase = parseFloat(formPurchase) || 0;
        const pStock = parseInt(formStock, 10) || 0;
        const pMinStock = parseInt(formMinStock, 10) || 5;
        const path = `sites/${siteId}/inventory/${selectedProduct.id}`;

        try {
          await updateDoc(doc(db, 'sites', siteId, 'inventory', selectedProduct.id), {
            code: formCode.trim(),
            barcode: formBarcode.trim(),
            name: formName.trim(),
            formDosage: formDosage.trim(),
            category: formCategory,
            brand: formBrand.trim(),
            stockLevel: Math.max(0, pStock),
            minStock: Math.max(0, pMinStock),
            purchasePriceUSD: Math.max(0, pPurchase),
            price: Math.max(0, pPrice),
            equivCDF: Math.round(Math.max(0, pPrice) * exchangeRate),
            unit: formUnit.trim() || 'Unité',
            prescriptionRequired: formPrescription,
            expiryDate: formExpiry,
            lotNumber: formLot.trim(),
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }

        await logAction(`Modification fiche article: ${formCode} - ${formName.trim()}`);
        showToast(`Article "${formName.trim()}" mis à jour.`);
        setIsModalOpen(false);
      }
    } catch (err) {
      showToast(formatReadableError(err), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (product: any) => {
    const confirmed = await confirmAction({
      title: 'Supprimer cet article du catalogue ?',
      message: `Vous êtes sur le point de supprimer "${product.name}" (${product.code}). Cette action est irréversible.`,
      confirmLabel: 'Supprimer définitivement',
      danger: true,
    });
    if (!confirmed) return;

    const path = `sites/${siteId}/inventory/${product.id}`;
    try {
      await deleteDoc(doc(db, 'sites', siteId, 'inventory', product.id));
      await logAction(`Suppression article catalogue: ${product.code || product.id} - ${product.name}`);
      showToast(`Article "${product.name}" supprimé.`, 'info');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch (wrapped) {
        showToast(formatReadableError(wrapped), 'error');
      }
    }
  };

  const handleSeed = async () => {
    try {
      await seedDatabase(siteId);
      showToast('Les 12 spécialités pharmaceutiques et fournisseurs ont été chargés.');
    } catch (err) {
      showToast(formatReadableError(err), 'error');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode?.includes(searchTerm) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;

    let matchesStatus = true;
    const stock = Number(p.stockLevel ?? 0);
    const min = Number(p.minStock ?? 5);
    if (statusFilter === 'EN_STOCK') matchesStatus = stock >= min;
    if (statusFilter === 'ALERTE') matchesStatus = stock > 0 && stock < min;
    if (statusFilter === 'RUPTURE') matchesStatus = stock === 0;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
  const totalArticles = products.length;
  const inAlertCount = products.filter((p) => {
    const s = Number(p.stockLevel ?? 0);
    const m = Number(p.minStock ?? 5);
    return s > 0 && s < m;
  }).length;
  const inRuptureCount = products.filter((p) => Number(p.stockLevel ?? 0) === 0).length;

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
              {totalArticles} spécialités pharmaceutiques répertoriées · Coût Moyen Pondéré (PUMP) · CRUD Temps Réel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSeed}
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
            Nouvel Article
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Row */}
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
            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-white text-xs cursor-pointer">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
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
                <th className="py-3 px-4 text-right">PUMP ACHAT</th>
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
                    <p className="text-xs">Modifiez vos termes de recherche ou cliquez sur « Réinitialiser Données Pharmacie »</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, idx) => {
                  const stock = Number(p.stockLevel ?? 0);
                  const min = Number(p.minStock ?? 5);
                  const isRupture = stock === 0;
                  const isAlerte = stock > 0 && stock < min;
                  const salePrice = Number(p.price ?? 0);
                  const pumpPrice = Number(p.purchasePriceUSD ?? salePrice * 0.6);

                  return (
                    <tr key={p.id || idx} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                        <span>{p.code || `ART${String(idx + 1).padStart(4, '0')}`}</span>
                      </td>

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

                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="font-medium text-slate-200">{p.brand || 'Denk Pharma'}</div>
                        <div className="text-[11px] text-slate-500">{p.category || 'Générique'} · {p.formDosage || 'Comprimé'}</div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono text-sm font-bold text-white tabular-nums">{stock}</span>
                        <div className="text-[10px] text-slate-500">Min: {min}</div>
                      </td>

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

                      <td className="py-3.5 px-4 text-right font-mono text-slate-400 tabular-nums">
                        $ {pumpPrice.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white tabular-nums">
                        <div className="text-sm font-bold text-blue-400">$ {salePrice.toFixed(2)}</div>
                        <span className="text-[10px] font-sans text-slate-500 font-normal">Fixé</span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-slate-300 tabular-nums">
                        {(p.equivCDF || Math.round(salePrice * exchangeRate)).toLocaleString()} FC
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openPriceModal(p)}
                            title="Ajuster le prix de vente"
                            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-blue-600/30 text-blue-400 border border-slate-700/60 hover:border-blue-500/50 transition-all cursor-pointer"
                          >
                            <DollarSign size={14} />
                          </button>
                          <button
                            onClick={() => openStockModal(p)}
                            title="Ajuster / Ajouter au stock"
                            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-emerald-600/30 text-emerald-400 border border-slate-700/60 hover:border-emerald-500/50 transition-all cursor-pointer"
                          >
                            <Package size={14} />
                          </button>
                          <button
                            onClick={() => openEditProductModal(p)}
                            title="Modifier la fiche complète"
                            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-amber-600/30 text-amber-400 border border-slate-700/60 hover:border-amber-500/50 transition-all cursor-pointer"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            title="Supprimer cet article"
                            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-600/30 text-rose-400 border border-slate-700/60 hover:border-rose-500/50 transition-all cursor-pointer"
                          >
                            <Trash2 size={14} />
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
            Base Active : <span className="text-emerald-400 font-semibold">Firestore Cloud + IndexedDB</span>
          </div>
        </div>
      </div>

      {/* Contextual Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth={modalType === 'new_product' || modalType === 'edit_product' ? 'max-w-lg' : 'max-w-md'}
        title={
          modalType === 'price'
            ? `Ajuster le Prix : ${selectedProduct?.name}`
            : modalType === 'stock'
            ? `Mouvement de Stock : ${selectedProduct?.name}`
            : modalType === 'edit_product'
            ? `Modifier Fiche Article : ${selectedProduct?.code}`
            : 'Enregistrer un Nouvel Article / Médicament'
        }
      >
        {modalType === 'price' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Modifiez le tarif de vente unitaire. La contre-valeur en CDF est recalculée automatiquement (Taux: {exchangeRate} FC/$).
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Prix de Vente Unitaire (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 font-mono">$</span>
                <input
                  type="number"
                  step="0.10"
                  min="0"
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
              disabled={isSaving}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Check size={16} /> {isSaving ? 'Enregistrement...' : 'Enregistrer le Nouveau Tarif'}
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

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setStockMode('add')}
                className={`py-2 rounded-lg font-semibold border cursor-pointer ${
                  stockMode === 'add'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                + Ajouter au Stock
              </button>
              <button
                type="button"
                onClick={() => {
                  setStockMode('set');
                  setInputStock(String(selectedProduct?.stockLevel ?? 0));
                }}
                className={`py-2 rounded-lg font-semibold border cursor-pointer ${
                  stockMode === 'set'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                = Inventaire Exact
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {stockMode === 'add' ? 'Quantité Réceptionnée à Ajouter' : 'Nouvelle Quantité Exacte en Rayon'}
              </label>
              <input
                type="number"
                min="0"
                value={inputStock}
                onChange={(e) => setInputStock(e.target.value)}
                placeholder="Ex: 50"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                autoFocus
              />
            </div>
            <button
              onClick={handleModalSubmit}
              disabled={isSaving}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Package size={16} /> {isSaving ? 'Mise à jour...' : 'Confirmer le Mouvement de Stock'}
            </button>
          </div>
        )}

        {(modalType === 'new_product' || modalType === 'edit_product') && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Code Interne</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-300 mb-1">Code-Barres (EAN13)</label>
                <input
                  type="text"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Désignation Commerciale / DCI</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Azithromycine 500mg"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Catégorie Thérapeutique</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="Antibiotique">Antibiotique</option>
                  <option value="Antalgique / Antipyrétique">Antalgique / Antipyrétique</option>
                  <option value="Anti-inflammatoire">Anti-inflammatoire</option>
                  <option value="Gastro-entérologie">Gastro-entérologie</option>
                  <option value="Antipaludéen ACT">Antipaludéen ACT</option>
                  <option value="Dermatologie">Dermatologie</option>
                  <option value="Vitamines & Minéraux">Vitamines & Minéraux</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-300 mb-1">Laboratoire / Marque</label>
                <input
                  type="text"
                  value={formBrand}
                  onChange={(e) => setFormBrand(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Forme & Dosage</label>
                <input
                  type="text"
                  value={formDosage}
                  onChange={(e) => setFormDosage(e.target.value)}
                  placeholder="Ex: Bte de 10 comprimés"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-300 mb-1">Unité de Vente</label>
                <input
                  type="text"
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  placeholder="Boîte / Flacon"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Prix Achat PUMP ($)</label>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  value={formPurchase}
                  onChange={(e) => setFormPurchase(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-300 mb-1">Prix Vente ($)</label>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Stock Actuel</label>
                <input
                  type="number"
                  min="0"
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-300 mb-1">Seuil Alerte</label>
                <input
                  type="number"
                  min="0"
                  value={formMinStock}
                  onChange={(e) => setFormMinStock(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">N° de Lot Initial</label>
                <input
                  type="text"
                  value={formLot}
                  onChange={(e) => setFormLot(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none uppercase"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-300 mb-1">Date d'Expiration</label>
                <input
                  type="date"
                  value={formExpiry}
                  onChange={(e) => setFormExpiry(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={formPrescription}
                onChange={(e) => setFormPrescription(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
              />
              Ordonnance médicale obligatoire
            </label>

            <button
              onClick={handleModalSubmit}
              disabled={!formName.trim() || isSaving}
              className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {modalType === 'edit_product' ? <Check size={16} /> : <Plus size={16} />}
              {isSaving
                ? 'Enregistrement...'
                : modalType === 'edit_product'
                ? 'Enregistrer les Modifications'
                : 'Créer et Mettre en Rayon'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
