import { useEffect, useState } from 'react';
import { db, auth } from './firebase';
import {
  collection,
  onSnapshot,
  doc,
  writeBatch,
  increment,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import {
  ShoppingCart,
  Search,
  Trash2,
  Plus,
  Minus,
  Receipt,
  User,
  Barcode,
  Printer,
  X,
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

export default function Sales() {
  const { firebaseUser, authReady, currentUser } = useAuth();
  const { showToast } = useToast();

  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [clientType, setClientType] = useState('CLIENT COMPTOIR / ANONYME');
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');
  const [paymentMethod, setPaymentMethod] = useState<'ESPECES' | 'AIRTEL' | 'ORANGE' | 'MPESA' | 'CARTE'>('ESPECES');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [siteId] = useState('site1');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastTicket, setLastTicket] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [exchangeRate, setExchangeRate] = useState<number>(2230);

  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const inventoryRef = collection(db, 'sites', siteId, 'inventory');
    const unsubscribe = onSnapshot(
      inventoryRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(data);
      },
      (error) => {
        console.error('Sales inventory snapshot error:', error);
        showToast(formatReadableError(error), 'error');
      }
    );

    // Load configured exchange rate if saved
    getDoc(doc(db, 'settings', 'config'))
      .then((snap) => {
        if (snap.exists() && snap.data()?.financial?.exchangeRateUSDToCDF) {
          setExchangeRate(Number(snap.data().financial.exchangeRateUSDToCDF) || 2230);
        }
      })
      .catch(() => {});

    return unsubscribe;
  }, [siteId, authReady, firebaseUser, showToast]);

  const addToCart = (product: any) => {
    const availableStock = Number(product.stockLevel) || 0;
    if (availableStock <= 0) {
      showToast(`"${product.name}" est en rupture de stock.`, 'error');
      return;
    }

    const existingIndex = cart.findIndex((item) => item.id === product.id);
    if (existingIndex > -1) {
      if (cart[existingIndex].qty >= availableStock) {
        showToast(`Stock maximum atteint (${availableStock} unités).`, 'info');
        return;
      }
      const updated = [...cart];
      updated[existingIndex].qty += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          id: product.id,
          code: product.code || 'MED-00',
          name: product.name || 'Médicament',
          brand: product.brand || 'Générique',
          category: product.category || 'Pharmacie',
          price: Number(product.price) || 0,
          stockLevel: availableStock,
          qty: 1,
        },
      ]);
    }
  };

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = barcodeInput.trim().toLowerCase();
    if (!code) return;
    const match = products.find(
      (p) =>
        p.barcode?.toLowerCase() === code ||
        p.code?.toLowerCase() === code
    );
    if (match) {
      addToCart(match);
      setBarcodeInput('');
      showToast(`${match.name} ajouté au panier.`);
    } else {
      showToast(`Aucun médicament trouvé pour le code "${barcodeInput}".`, 'error');
    }
  };

  const updateCartQty = (id: string, delta: number) => {
    const prod = products.find((p) => p.id === id);
    const maxStock = Number(prod?.stockLevel ?? 999);
    const updated = cart
      .map((item) => {
        if (item.id === id) {
          const newQty = item.qty + delta;
          if (newQty > maxStock) {
            showToast(`Stock disponible limité à ${maxStock} unités.`, 'info');
            return item;
          }
          return newQty > 0 ? { ...item, qty: newQty } : null;
        }
        return item;
      })
      .filter(Boolean);
    setCart(updated as any[]);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const clearCart = () => setCart([]);

  // Robust Numeric Financial Calculations
  const rawTotalUSD = cart.reduce((sum, item) => {
    const pPrice = Number(item.price) || 0;
    const pQty = Number(item.qty) || 1;
    return sum + pPrice * pQty;
  }, 0);

  const safeDiscount = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const discountAmountUSD = (rawTotalUSD * safeDiscount) / 100;
  const netTotalUSD = Math.max(0, rawTotalUSD - discountAmountUSD);
  const netTotalCDF = Math.round(netTotalUSD * exchangeRate);

  const parsedReceived =
    parseFloat(amountReceived) || (currency === 'USD' ? netTotalUSD : netTotalCDF);
  const changeGiven =
    currency === 'USD'
      ? Math.max(0, parsedReceived - netTotalUSD)
      : Math.max(0, parsedReceived - netTotalCDF);

  const finalizeSale = async () => {
    if (cart.length === 0 || isProcessing) return;
    if (!auth.currentUser) {
      showToast('Session Firebase requise pour valider une vente.', 'error');
      return;
    }

    setIsProcessing(true);
    const salesPath = `sites/${siteId}/sales`;

    try {
      const batch = writeBatch(db);
      const salesRef = collection(db, 'sites', siteId, 'sales');
      const auditRef = collection(db, 'sites', siteId, 'auditlogs');
      const ticketId = `TCK-${Date.now().toString().slice(-6)}`;
      const cashierName =
        currentUser?.displayName || auth.currentUser?.email || 'Caissier Titulaire';

      for (const item of cart) {
        const itemPrice = Number(item.price) || 0;
        const itemQty = Number(item.qty) || 1;
        const lineSubtotal = itemPrice * itemQty;
        const lineDiscounted = lineSubtotal * (1 - safeDiscount / 100);

        const newSaleDoc = doc(salesRef);
        batch.set(newSaleDoc, {
          ticketId,
          productId: item.id,
          productCode: item.code || '',
          name: item.name,
          quantity: itemQty,
          unitPriceUSD: itemPrice,
          discountPercent: safeDiscount,
          totalUSD: Number(lineDiscounted.toFixed(2)),
          paymentMethod,
          currency,
          client: clientType,
          cashier: cashierName,
          timestamp: serverTimestamp(),
        });

        // Atomic decrement on Firestore inventory
        const productRef = doc(db, 'sites', siteId, 'inventory', item.id);
        batch.update(productRef, {
          stockLevel: increment(-itemQty),
          updatedAt: new Date().toISOString(),
        });
      }

      // If credit or insurance client, also create a credit dossier automatically
      if (clientType.includes('CREDIT') || clientType.includes('ASSURANCE')) {
        const creditRef = doc(collection(db, 'sites', siteId, 'credits'));
        batch.set(creditRef, {
          code: `CRD-${Date.now().toString().slice(-6)}`,
          clientName: clientType,
          amountUSD: Number(netTotalUSD.toFixed(2)),
          amountCDF: netTotalCDF,
          status: 'EN_ATTENTE',
          dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000)
            .toISOString()
            .split('T')[0],
          reason: `Facture Caisse ${ticketId}`,
          createdAt: serverTimestamp(),
        });
      }

      // Tamper-proof audit log
      const newAuditDoc = doc(auditRef);
      batch.set(newAuditDoc, {
        userId: auth.currentUser.email || cashierName,
        action: `Vente ${ticketId} : ${cart.length} ligne(s) pour $${netTotalUSD.toFixed(
          2
        )} (${netTotalCDF.toLocaleString()} FC) en ${paymentMethod}`,
        timestamp: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, salesPath);
      }

      const receiptRecord = {
        id: ticketId,
        items: [...cart],
        rawTotalUSD,
        discountPercent: safeDiscount,
        totalUSD: netTotalUSD,
        totalCDF: netTotalCDF,
        paymentMethod,
        currency,
        client: clientType,
        cashier: cashierName,
        received: parsedReceived,
        change: changeGiven,
        date: new Date().toLocaleString(),
      };

      setLastTicket(receiptRecord);
      setIsReceiptModalOpen(true);
      setCart([]);
      setAmountReceived('');
      setDiscountPercent(0);
      showToast(`Vente ${ticketId} enregistrée et stocks mis à jour.`);
    } catch (err) {
      showToast(formatReadableError(err), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSeed = async () => {
    try {
      await seedDatabase(siteId);
      showToast('Catalogue de démonstration chargé.');
    } catch (err) {
      showToast(formatReadableError(err), 'error');
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode?.includes(searchTerm)
  );

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-130px)] bg-[#070b14] text-slate-100 font-sans select-none">
      {/* Left Column: Product Selection Grid */}
      <div className="flex-1 flex flex-col p-5 border-r border-slate-800/80 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <div className="flex items-center bg-[#0d1322] border border-slate-800 rounded-xl px-4 py-2.5 focus-within:border-blue-500">
            <Barcode size={18} className="text-slate-400 mr-2.5 shrink-0" />
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeScan}
              placeholder="Scanner code-barres ou code MED... [Entrée]"
              className="bg-transparent text-sm w-full text-slate-100 focus:outline-none placeholder-slate-500 font-mono"
            />
          </div>
          <div className="flex items-center bg-[#0d1322] border border-slate-800 rounded-xl px-4 py-2.5 focus-within:border-blue-500">
            <Search size={18} className="text-slate-400 mr-2.5 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher désignation, DCI, forme..."
              className="bg-transparent text-sm w-full text-slate-100 focus:outline-none placeholder-slate-500"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5 flex-1 content-start">
          {filtered.length === 0 ? (
            <div className="col-span-2 py-16 text-center text-slate-500">
              <p className="font-semibold text-slate-400">Aucun produit disponible</p>
              <button
                onClick={handleSeed}
                className="mt-3 text-xs px-3 py-1.5 bg-blue-600/30 text-blue-400 border border-blue-500/40 rounded-lg hover:bg-blue-600/50 cursor-pointer"
              >
                Générer les 12 médicaments de démonstration
              </button>
            </div>
          ) : (
            filtered.map((p) => {
              const stock = Number(p.stockLevel) || 0;
              const isRupture = stock <= 0;
              const isAlerte = stock > 0 && stock < (Number(p.minStock) || 5);
              const priceUSD = Number(p.price) || 0;

              return (
                <div
                  key={p.id}
                  className={`bg-[#0c1222] border rounded-xl p-4 flex flex-col justify-between transition-all ${
                    isRupture
                      ? 'border-rose-900/40 opacity-75'
                      : 'border-slate-800/90 hover:border-slate-700 hover:shadow-lg'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[11px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {p.code || 'MED-00'}
                      </span>
                      {isRupture ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          RUPTURE
                        </span>
                      ) : isAlerte ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          ALERTE ({stock})
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          STOCK: {stock}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-white line-clamp-1 leading-snug">{p.name}</h3>
                    <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      {p.brand || 'Sanofi'} · {p.category || 'Antalgique'}
                    </div>
                  </div>

                  <div className="flex items-end justify-between mt-3 pt-3 border-t border-slate-800/60">
                    <div>
                      <div className="text-base font-mono font-bold text-blue-400 leading-tight">
                        $ {priceUSD.toFixed(2)}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {Math.round(priceUSD * exchangeRate).toLocaleString()} FC
                      </div>
                    </div>
                    <button
                      onClick={() => addToCart(p)}
                      disabled={isRupture}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus size={14} /> Ajouter
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: POS Cart & Checkout Panel */}
      <div className="w-full lg:w-[440px] bg-[#090d18] flex flex-col p-5 border-l border-slate-800/80 shrink-0">
        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            PANIER ({cart.reduce((a, b) => a + (Number(b.qty) || 0), 0)} ARTICLES)
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={13} /> Vider
            </button>
          )}
        </div>

        <div className="mb-4">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            CLIENT COMPTOIR / FACTURATION
          </span>
          <div className="flex items-center bg-[#0d1322] border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-200">
            <User size={15} className="text-slate-400 mr-2 shrink-0" />
            <select
              value={clientType}
              onChange={(e) => setClientType(e.target.value)}
              className="bg-transparent w-full text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="CLIENT COMPTOIR / ANONYME">CLIENT COMPTOIR (Espèces / Direct)</option>
              <option value="ASSURANCE ASCOMA (80% PRIS EN CHARGE)">ASSURANCE ASCOMA (80%)</option>
              <option value="ENTREPRISE CONVENTIONNÉE (CREDIT)">ENTREPRISE MINIÈRE (Crédit)</option>
              <option value="PATIENT CHRONIQUE (FIDÉLITÉ GOLD)">PATIENT CHRONIQUE (Fidélité)</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1 min-h-[140px] max-h-[220px]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-8">
              <ShoppingCart size={32} className="text-slate-700 mb-2 stroke-1" />
              <p className="text-xs">Le panier est vide.</p>
              <p className="text-[11px] text-slate-600">Scannez ou cliquez sur « Ajouter »</p>
            </div>
          ) : (
            cart.map((item) => {
              const itemPrice = Number(item.price) || 0;
              const itemQty = Number(item.qty) || 1;
              const lineTotal = itemPrice * itemQty;

              return (
                <div
                  key={item.id}
                  className="bg-[#0d1424] border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div className="flex-1 mr-2">
                    <div className="font-semibold text-white line-clamp-1">{item.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      $ {itemPrice.toFixed(2)} × {itemQty} ={' '}
                      <span className="text-blue-400 font-bold">$ {lineTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => updateCartQty(item.id, -1)}
                      className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 cursor-pointer"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center font-mono font-bold text-white text-xs">{itemQty}</span>
                    <button
                      onClick={() => updateCartQty(item.id, 1)}
                      className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 cursor-pointer"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="ml-1 text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-800/90 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DEVISE VENTE</span>
              <div className="flex bg-[#0d1322] border border-slate-800 rounded-lg p-1">
                <button
                  onClick={() => setCurrency('USD')}
                  className={`flex-1 py-1 text-[11px] font-bold rounded cursor-pointer ${
                    currency === 'USD' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  USD ($)
                </button>
                <button
                  onClick={() => setCurrency('CDF')}
                  className={`flex-1 py-1 text-[11px] font-bold rounded cursor-pointer ${
                    currency === 'CDF' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  CDF (FC)
                </button>
              </div>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MODE DE PAIEMENT</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-[#0d1322] border border-slate-800 rounded-lg py-1.5 px-2 text-[11px] font-semibold text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="ESPECES">Espèces (Cash)</option>
                <option value="AIRTEL">Airtel Money</option>
                <option value="ORANGE">Orange Money</option>
                <option value="MPESA">M-Pesa</option>
                <option value="CARTE">Visa / Mastercard</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">REMISE (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) =>
                  setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))
                }
                className="w-full bg-[#0d1322] border border-slate-800 rounded-lg py-1.5 px-3 text-white font-mono text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">MONTANT REÇU</span>
                <button
                  onClick={() =>
                    setAmountReceived(String(currency === 'USD' ? netTotalUSD.toFixed(2) : netTotalCDF))
                  }
                  className="text-[9px] text-blue-400 hover:underline cursor-pointer"
                >
                  [Exact]
                </button>
              </div>
              <input
                type="number"
                placeholder={String(currency === 'USD' ? netTotalUSD.toFixed(2) : netTotalCDF)}
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                className="w-full bg-[#0d1322] border border-slate-800 rounded-lg py-1.5 px-3 text-white font-mono text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {amountReceived && (
            <div className="flex justify-between items-center px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[11px] font-mono">
              <span className="text-slate-300">Rendu Monnaie :</span>
              <span className="font-bold text-emerald-400">
                {currency === 'USD'
                  ? `$ ${changeGiven.toFixed(2)}`
                  : `${Math.round(changeGiven).toLocaleString()} FC`}
              </span>
            </div>
          )}

          <div className="py-2.5 px-3.5 bg-[#0e1627] rounded-xl border border-blue-500/30 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                NET À PAYER :
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Taux : 1 USD = {exchangeRate} FC
              </span>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-extrabold text-white tracking-tight leading-none">
                $ {netTotalUSD.toFixed(2)}
              </div>
              <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                {netTotalCDF.toLocaleString()} FC
              </div>
            </div>
          </div>

          <button
            onClick={finalizeSale}
            disabled={cart.length === 0 || isProcessing}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800/80 disabled:text-slate-600 font-bold text-sm text-white shadow-lg shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Receipt size={18} />
            {isProcessing ? 'Enregistrement de la vente...' : 'Valider la Vente et Imprimer Ticket'}
          </button>
        </div>
      </div>

      {/* Official Printable Thermal Receipt Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="Ticket de Caisse Encaissé (Imprimante Thermique)"
        maxWidth="max-w-sm"
      >
        {lastTicket && (
          <div className="space-y-4 font-mono text-xs text-slate-300">
            <div className="text-center pb-3 border-b border-dashed border-slate-700 space-y-1">
              <div className="font-extrabold text-white text-sm">SHEKINAH PHARMA</div>
              <div className="text-[11px] text-slate-400">Pharmacie Centrale - Kinshasa</div>
              <div className="text-[10px] text-slate-500">
                Ticket #{lastTicket.id} · {lastTicket.date}
              </div>
              <div className="text-[10px] text-slate-400">Opérateur : {lastTicket.cashier}</div>
            </div>

            <div className="space-y-1.5 py-2 border-b border-dashed border-slate-700">
              <div className="text-[10px] text-slate-500 uppercase font-sans font-bold mb-1">
                Articles Délivrés :
              </div>
              {lastTicket.items.map((it: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span className="line-clamp-1 flex-1 mr-2">
                    {it.name} (×{it.qty})
                  </span>
                  <span className="font-bold text-white shrink-0">
                    $ {(it.price * it.qty).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1 pt-1 text-xs">
              <div className="flex justify-between">
                <span>Total Brut :</span>
                <span>$ {lastTicket.rawTotalUSD.toFixed(2)}</span>
              </div>
              {lastTicket.discountPercent > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Remise accordée :</span>
                  <span>-{lastTicket.discountPercent}%</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-slate-800">
                <span>NET PAYÉ (USD) :</span>
                <span>$ {lastTicket.totalUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-emerald-400">
                <span>NET PAYÉ (CDF) :</span>
                <span>{lastTicket.totalCDF.toLocaleString()} FC</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px] pt-1">
                <span>Règlement :</span>
                <span>{lastTicket.paymentMethod}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer size={16} /> Imprimer Ticket
              </button>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
