import { useEffect, useState } from 'react';
import { db, auth } from './firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  FileText, 
  Search, 
  Printer, 
  Download, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  DollarSign, 
  Calendar, 
  X,
  CreditCard,
  UserCheck
} from 'lucide-react';
import Modal from './Modal';

export default function InvoicesAndCredits() {
  const [sales, setSales] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'credits'>('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [siteId] = useState('site1');
  const [exchangeRate] = useState(2230);

  // New credit modal state
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [creditClient, setCreditClient] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDueDate, setCreditDueDate] = useState('');
  const [creditReason, setCreditReason] = useState('Traitement chronique / Ordonnance');

  useEffect(() => {
    // 1. Fetch Sales (Factures)
    const salesRef = collection(db, 'sites', siteId, 'sales');
    const qSales = query(salesRef, orderBy('timestamp', 'desc'));
    const unsubsSales = onSnapshot(qSales, (snap) => {
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Fetch Credits
    const creditsRef = collection(db, 'sites', siteId, 'credits');
    const unsubsCredits = onSnapshot(creditsRef, (snap) => {
      setCredits(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubsSales();
      unsubsCredits();
    };
  }, [siteId]);

  const viewInvoiceDetail = (sale: any) => {
    setSelectedInvoice(sale);
    setIsInvoiceModalOpen(true);
  };

  const handleCreateCredit = async () => {
    if (!creditClient || !creditAmount) return;
    const amountUSD = parseFloat(creditAmount) || 0;
    const refCode = `CRD-${Date.now().toString().slice(-6)}`;

    await addDoc(collection(db, 'sites', siteId, 'credits'), {
      code: refCode,
      clientName: creditClient,
      amountUSD: amountUSD,
      amountCDF: Math.round(amountUSD * exchangeRate),
      status: 'EN_ATTENTE',
      dueDate: creditDueDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      reason: creditReason,
      createdAt: serverTimestamp()
    });

    // Traceability
    await addDoc(collection(db, 'sites', siteId, 'auditlogs'), {
      userId: auth.currentUser?.email || 'Comptable',
      action: `Nouveau crédit accordé : ${refCode} - ${creditClient} ($${amountUSD.toFixed(2)})`,
      timestamp: serverTimestamp()
    });

    setIsCreditModalOpen(false);
    setCreditClient('');
    setCreditAmount('');
  };

  const markCreditPaid = async (creditId: string, clientName: string, amountUSD: number) => {
    await updateDoc(doc(db, 'sites', siteId, 'credits', creditId), {
      status: 'REGLE',
      settledAt: serverTimestamp()
    });

    await addDoc(collection(db, 'sites', siteId, 'auditlogs'), {
      userId: auth.currentUser?.email || 'Comptable',
      action: `Règlement crédit client : ${clientName} ($${amountUSD.toFixed(2)})`,
      timestamp: serverTimestamp()
    });
  };

  const filteredSales = sales.filter(s => 
    s.ticketId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.client?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCredits = credits.filter(c => 
    c.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 bg-[#070b14] text-slate-100 min-h-screen font-sans space-y-6">
      {/* Header and Subnav */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            REGISTRE DES FACTURES DE VENTES & CRÉDITS CLIENTS
          </h1>
          <p className="text-xs text-slate-400">
            Journal comptable des encaissements, tickets de caisse et créances assurances / entreprises
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#0c1220] border border-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveSubTab('invoices')}
              className={`px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'invoices' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText size={15} /> Factures Ventes ({sales.length})
            </button>
            <button
              onClick={() => setActiveSubTab('credits')}
              className={`px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'credits' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard size={15} /> Crédits & Assurances ({credits.length})
            </button>
          </div>

          {activeSubTab === 'credits' && (
            <button
              onClick={() => setIsCreditModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              + Nouveau Dossier Crédit
            </button>
          )}
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="flex items-center bg-[#0d1322] border border-slate-800/90 rounded-xl px-4 py-2.5 focus-within:border-blue-500">
        <Search size={18} className="text-slate-400 mr-2.5 shrink-0" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={
            activeSubTab === 'invoices' 
              ? "Recherche par numéro de ticket (ex: TCK-...), médicament ou client..."
              : "Recherche par nom du patient, entreprise conventionnée ou référence..."
          }
          className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>

      {/* VIEW 1: FACTURES VENTES TABLE */}
      {activeSubTab === 'invoices' && (
        <div className="bg-[#0c1220] rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#11192b] border-b border-slate-800/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">TICKET / FACTURE</th>
                  <th className="py-3 px-4">DATE & HEURE</th>
                  <th className="py-3 px-4">CLIENT / BÉNÉFICIAIRE</th>
                  <th className="py-3 px-4">ARTICLE DÉLIVRÉ</th>
                  <th className="py-3 px-4 text-center">QUANTITÉ</th>
                  <th className="py-3 px-4 text-center">MODE PAIEMENT</th>
                  <th className="py-3 px-4 text-right">MONTANT USD</th>
                  <th className="py-3 px-4 text-right">MONTANT CDF</th>
                  <th className="py-3 px-4 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      <p className="text-sm font-semibold text-slate-400">Aucune facture enregistrée pour le moment</p>
                      <p className="text-xs">Les encaissements réalisés à la Caisse Rapide s'afficheront automatiquement ici.</p>
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-400">
                        {sale.ticketId || `TCK-${sale.id.slice(-6)}`}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {sale.timestamp?.toDate ? sale.timestamp.toDate().toLocaleString() : 'Récemment'}
                      </td>
                      <td className="py-3 px-4 font-medium text-white">
                        {sale.client || 'Client Comptoir'}
                      </td>
                      <td className="py-3 px-4 text-slate-200">
                        <span className="font-semibold text-white">{sale.name}</span>
                        {sale.productCode && (
                          <span className="text-[10px] text-slate-400 font-mono ml-1.5">({sale.productCode})</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-white">
                        {sale.quantity || 1}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                          {sale.paymentMethod || 'ESPECES'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 tabular-nums">
                        $ {(sale.totalUSD || sale.amount || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300 tabular-nums">
                        {Math.round((sale.totalUSD || sale.amount || 0) * exchangeRate).toLocaleString()} FC
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => viewInvoiceDetail(sale)}
                          className="px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600 hover:text-white transition-colors cursor-pointer"
                        >
                          Détails / Ticket
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: CREDITS CLIENTS & ASSURANCES TABLE */}
      {activeSubTab === 'credits' && (
        <div className="bg-[#0c1220] rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#11192b] border-b border-slate-800/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">DOSSIER CRÉDIT</th>
                  <th className="py-3 px-4">BÉNÉFICIAIRE / ASSURANCE</th>
                  <th className="py-3 px-4">MOTIF / CONVENTION</th>
                  <th className="py-3 px-4">DATE LIMITE RÈGLEMENT</th>
                  <th className="py-3 px-4 text-right">MONTANT DÛ (USD)</th>
                  <th className="py-3 px-4 text-right">ÉQUIV. CDF</th>
                  <th className="py-3 px-4 text-center">STATUT</th>
                  <th className="py-3 px-4 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCredits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <p className="text-sm font-semibold text-slate-400">Aucun dossier de crédit enregistré</p>
                      <p className="text-xs">Utilisez le bouton « + Nouveau Dossier Crédit » ci-dessus pour ajouter une créance.</p>
                    </td>
                  </tr>
                ) : (
                  filteredCredits.map((c) => {
                    const isPaid = c.status === 'REGLE';
                    return (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">
                          {c.code || 'CRD-0001'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          {c.clientName}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {c.reason || 'Traitement pharmacie'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {c.dueDate || '2027-01-15'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white tabular-nums">
                          $ {(c.amountUSD || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-300 tabular-nums">
                          {(c.amountCDF || Math.round(c.amountUSD * exchangeRate)).toLocaleString()} FC
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isPaid ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              RÉGLÉ
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              EN ATTENTE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {!isPaid ? (
                            <button
                              onClick={() => markCreditPaid(c.id, c.clientName, c.amountUSD)}
                              className="px-2.5 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer text-[11px] font-semibold"
                            >
                              Valider Paiement
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">Dossier clôturé</span>
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

      {/* Modal 1: Invoice / Ticket Print View */}
      <Modal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        title={`Ticket Officiel de Caisse #${selectedInvoice?.ticketId || 'Facture'}`}
      >
        {selectedInvoice && (
          <div className="space-y-4 text-xs font-mono">
            <div className="text-center pb-3 border-b border-slate-800 space-y-1">
              <div className="font-bold text-white text-sm">PHARMAFLOW GROUP SARL</div>
              <div className="text-slate-400">Kinshasa - RDC · Tél: +243 81 000 0000</div>
              <div className="text-slate-400 text-[10px]">Date : {new Date().toLocaleString()}</div>
            </div>

            <div className="space-y-1.5 py-2 border-b border-slate-800 text-slate-300">
              <div className="flex justify-between">
                <span>Client :</span>
                <span className="font-bold text-white">{selectedInvoice.client || 'Client Comptoir'}</span>
              </div>
              <div className="flex justify-between">
                <span>Article :</span>
                <span className="font-bold text-white">{selectedInvoice.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Quantité :</span>
                <span>{selectedInvoice.quantity || 1}</span>
              </div>
              <div className="flex justify-between">
                <span>Mode Paiement :</span>
                <span>{selectedInvoice.paymentMethod || 'ESPECES'}</span>
              </div>
            </div>

            <div className="py-2 space-y-1 text-sm font-bold">
              <div className="flex justify-between text-white">
                <span>TOTAL USD :</span>
                <span>$ {(selectedInvoice.totalUSD || selectedInvoice.amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>TOTAL CDF :</span>
                <span>{Math.round((selectedInvoice.totalUSD || selectedInvoice.amount || 0) * exchangeRate).toLocaleString()} FC</span>
              </div>
            </div>

            <button
              onClick={() => {
                alert(`Impression du ticket ${selectedInvoice.ticketId} lancée sur l'imprimante thermique.`);
                setIsInvoiceModalOpen(false);
              }}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Printer size={16} /> Imprimer Ticket Thermique
            </button>
          </div>
        )}
      </Modal>

      {/* Modal 2: Create Credit / Insurance File */}
      <Modal
        isOpen={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        title="Créer une Créance / Dossier Crédit Client"
      >
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nom du Patient ou Organisme Assurance</label>
            <input
              type="text"
              value={creditClient}
              onChange={(e) => setCreditClient(e.target.value)}
              placeholder="Ex: ASCOMA ASSURANCE ou M. KABILA"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Montant de la Créance (USD)</label>
            <input
              type="number"
              step="0.50"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="Ex: 85.00"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Date Limite de Remboursement / Paiement</label>
            <input
              type="date"
              value={creditDueDate}
              onChange={(e) => setCreditDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Motif Thérapeutique / Référence Ordonnance</label>
            <input
              type="text"
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleCreateCredit}
            disabled={!creditClient || !creditAmount}
            className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <UserCheck size={16} /> Enregistrer la Créance & Imprimer Accord
          </button>
        </div>
      </Modal>
    </div>
  );
}
