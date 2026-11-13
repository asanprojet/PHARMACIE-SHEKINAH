import { useEffect, useState } from 'react';
import { db } from './firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  Users,
  Search,
  Plus,
  HeartPulse,
  CheckCircle,
  FileCheck,
  ShieldCheck,
  Edit3,
  Trash2,
} from 'lucide-react';
import Modal from './Modal';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { OperationType, handleFirestoreError, formatReadableError } from './firestoreUtils';

interface PatientRecord {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  address: string;
  age: number;
  gender: 'M' | 'F';
  allergies: string;
  chronicConditions: string;
  insuranceName: string;
  insuranceRate: number;
  fidelityPoints: number;
  fidelityTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
}

interface PrescriptionRecord {
  id: string;
  rxCode?: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  prescribedMedicines: string[];
  date: string;
  status: 'DELIVRE' | 'PARTIEL' | 'EN_ATTENTE';
  notes: string;
}

export default function PatientsAndPrescriptions() {
  const { authReady, firebaseUser, currentUser } = useAuth();
  const { showToast, confirmAction } = useToast();
  const siteId = currentUser?.siteId || 'site1';

  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'patients' | 'prescriptions'>('patients');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Patient Create / Edit Modal
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientRecord | null>(null);
  const [pName, setPName] = useState('');
  const [pPhone, setPPhone] = useState('+243 81 ');
  const [pAddress, setPAddress] = useState('Kinshasa - Gombe');
  const [pAge, setPAge] = useState('35');
  const [pGender, setPGender] = useState<'M' | 'F'>('M');
  const [pAllergies, setPAllergies] = useState('Aucune connue');
  const [pConditions, setPConditions] = useState('Général');
  const [pInsurance, setPInsurance] = useState('ASCOMA ASSURANCE');
  const [pInsuranceRate, setPInsuranceRate] = useState('80');
  const [pFidelityPoints, setPFidelityPoints] = useState('50');
  const [pFidelityTier, setPFidelityTier] = useState<'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'>('SILVER');

  // Prescription Create / Edit Modal
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [editingRx, setEditingRx] = useState<PrescriptionRecord | null>(null);
  const [rxPatientId, setRxPatientId] = useState('');
  const [rxWalkInName, setRxWalkInName] = useState('');
  const [rxDoctor, setRxDoctor] = useState('Dr. Kabongo (Clinique Ngaliema)');
  const [rxDrugs, setRxDrugs] = useState('');
  const [rxNotes, setRxNotes] = useState('Posologie : 1 prise 3 fois par jour après les repas');
  const [rxStatus, setRxStatus] = useState<'DELIVRE' | 'PARTIEL' | 'EN_ATTENTE'>('DELIVRE');

  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const patientsRef = collection(db, 'sites', siteId, 'patients');
    const unsubsPatients = onSnapshot(
      patientsRef,
      (snap) => {
        setPatients(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      },
      (err) => {
        showToast(formatReadableError(err), 'error');
        try {
          handleFirestoreError(err, OperationType.LIST, `sites/${siteId}/patients`);
        } catch {
          // logged
        }
      }
    );

    const rxRef = collection(db, 'sites', siteId, 'prescriptions');
    const qRx = query(rxRef, orderBy('createdAt', 'desc'));
    const unsubsRx = onSnapshot(
      qRx,
      (snap) => {
        setPrescriptions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      },
      (err) => {
        showToast(formatReadableError(err), 'error');
        try {
          handleFirestoreError(err, OperationType.LIST, `sites/${siteId}/prescriptions`);
        } catch {
          // logged
        }
      }
    );

    return () => {
      unsubsPatients();
      unsubsRx();
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

  const openNewPatientModal = () => {
    setEditingPatient(null);
    setPName('');
    setPPhone('+243 81 ');
    setPAddress('Kinshasa - Gombe');
    setPAge('35');
    setPGender('M');
    setPAllergies('Aucune connue');
    setPConditions('Général');
    setPInsurance('ASCOMA ASSURANCE');
    setPInsuranceRate('80');
    setPFidelityPoints('50');
    setPFidelityTier('SILVER');
    setIsPatientModalOpen(true);
  };

  const openEditPatientModal = (pat: PatientRecord) => {
    setEditingPatient(pat);
    setPName(pat.fullName || '');
    setPPhone(pat.phone || '');
    setPAddress(pat.address || '');
    setPAge(String(pat.age ?? 30));
    setPGender(pat.gender || 'M');
    setPAllergies(pat.allergies || 'Aucune connue');
    setPConditions(pat.chronicConditions || 'Général');
    setPInsurance(pat.insuranceName || 'AUCUNE (PARTICULIER)');
    setPInsuranceRate(String(pat.insuranceRate ?? 0));
    setPFidelityPoints(String(pat.fidelityPoints ?? 50));
    setPFidelityTier(pat.fidelityTier || 'SILVER');
    setIsPatientModalOpen(true);
  };

  const handleSavePatient = async () => {
    if (!pName.trim()) {
      showToast('Veuillez renseigner le nom complet du patient.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingPatient) {
        const path = `sites/${siteId}/patients/${editingPatient.id}`;
        await updateDoc(doc(db, 'sites', siteId, 'patients', editingPatient.id), {
          fullName: pName.trim(),
          phone: pPhone.trim(),
          address: pAddress.trim(),
          age: parseInt(pAge, 10) || 30,
          gender: pGender,
          allergies: pAllergies.trim() || 'Aucune connue',
          chronicConditions: pConditions.trim() || 'Général',
          insuranceName: pInsurance,
          insuranceRate: pInsurance.includes('AUCUNE') ? 0 : parseInt(pInsuranceRate, 10) || 0,
          fidelityPoints: parseInt(pFidelityPoints, 10) || 0,
          fidelityTier: pFidelityTier,
          updatedAt: serverTimestamp(),
        });
        await logAction(`Mise à jour Dossier Patient : ${editingPatient.code} - ${pName.trim()}`);
        showToast('Dossier patient mis à jour.', 'success');
      } else {
        const code = `PAT-${Date.now().toString().slice(-5)}`;
        await addDoc(collection(db, 'sites', siteId, 'patients'), {
          code,
          fullName: pName.trim(),
          phone: pPhone.trim(),
          address: pAddress.trim(),
          age: parseInt(pAge, 10) || 30,
          gender: pGender,
          allergies: pAllergies.trim() || 'Aucune connue',
          chronicConditions: pConditions.trim() || 'Général',
          insuranceName: pInsurance,
          insuranceRate: pInsurance.includes('AUCUNE') ? 0 : parseInt(pInsuranceRate, 10) || 0,
          fidelityPoints: parseInt(pFidelityPoints, 10) || 50,
          fidelityTier: pFidelityTier,
          createdAt: serverTimestamp(),
        });
        await logAction(`Création Dossier Patient : ${code} - ${pName.trim()} (${pInsurance})`);
        showToast(`Patient ${code} enregistré avec succès.`, 'success');
      }

      setIsPatientModalOpen(false);
      setEditingPatient(null);
    } catch (err) {
      showToast(formatReadableError(err), 'error');
      try {
        handleFirestoreError(
          err,
          editingPatient ? OperationType.UPDATE : OperationType.CREATE,
          editingPatient ? `sites/${siteId}/patients/${editingPatient.id}` : `sites/${siteId}/patients`
        );
      } catch {
        // logged
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePatient = async (pat: PatientRecord) => {
    const confirmed = await confirmAction({
      title: 'Supprimer le dossier patient ?',
      message: `Voulez-vous supprimer définitivement le dossier de ${pat.fullName} (${pat.code}) ?`,
      confirmLabel: 'Supprimer le dossier',
      danger: true,
    });
    if (!confirmed) return;

    const path = `sites/${siteId}/patients/${pat.id}`;
    try {
      await deleteDoc(doc(db, 'sites', siteId, 'patients', pat.id));
      await logAction(`Suppression Dossier Patient : ${pat.code} - ${pat.fullName}`);
      showToast('Dossier patient supprimé.', 'info');
    } catch (err) {
      showToast(formatReadableError(err), 'error');
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch {
        // logged
      }
    }
  };

  const openNewRxModal = () => {
    setEditingRx(null);
    setRxPatientId(patients.length > 0 ? patients[0].id : '__WALKIN__');
    setRxWalkInName('');
    setRxDoctor('Dr. Kabongo (Clinique Ngaliema)');
    setRxDrugs('');
    setRxNotes('Posologie : 1 prise 3 fois par jour après les repas');
    setRxStatus('DELIVRE');
    setIsRxModalOpen(true);
  };

  const openEditRxModal = (rx: PrescriptionRecord) => {
    setEditingRx(rx);
    setRxPatientId(rx.patientId && patients.some((p) => p.id === rx.patientId) ? rx.patientId : '__WALKIN__');
    setRxWalkInName(rx.patientName || '');
    setRxDoctor(rx.doctorName || '');
    setRxDrugs(Array.isArray(rx.prescribedMedicines) ? rx.prescribedMedicines.join(', ') : String(rx.prescribedMedicines || ''));
    setRxNotes(rx.notes || '');
    setRxStatus(rx.status || 'DELIVRE');
    setIsRxModalOpen(true);
  };

  const handleSavePrescription = async () => {
    const matchedPatient = rxPatientId !== '__WALKIN__' ? patients.find((p) => p.id === rxPatientId) : undefined;
    const finalPatientName = matchedPatient ? matchedPatient.fullName : rxWalkInName.trim();

    if (!finalPatientName || !rxDrugs.trim()) {
      showToast('Veuillez renseigner le patient et les médicaments prescrits.', 'error');
      return;
    }

    const drugList = rxDrugs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    try {
      if (editingRx) {
        const path = `sites/${siteId}/prescriptions/${editingRx.id}`;
        await updateDoc(doc(db, 'sites', siteId, 'prescriptions', editingRx.id), {
          patientId: matchedPatient ? matchedPatient.id : 'WALKIN',
          patientName: finalPatientName,
          doctorName: rxDoctor.trim(),
          prescribedMedicines: drugList,
          status: rxStatus,
          notes: rxNotes.trim(),
          updatedAt: serverTimestamp(),
        });
        await logAction(`Modification Ordonnance ${editingRx.rxCode || editingRx.id} pour ${finalPatientName} (${rxStatus})`);
        showToast('Ordonnance mise à jour.', 'success');
      } else {
        const rxCode = `ORD-${Date.now().toString().slice(-5)}`;
        await addDoc(collection(db, 'sites', siteId, 'prescriptions'), {
          rxCode,
          patientId: matchedPatient ? matchedPatient.id : 'WALKIN',
          patientName: finalPatientName,
          doctorName: rxDoctor.trim(),
          prescribedMedicines: drugList,
          date: new Date().toLocaleDateString(),
          status: rxStatus,
          notes: rxNotes.trim(),
          createdAt: serverTimestamp(),
          dispensedBy: currentUser?.email || firebaseUser?.email || 'Pharmacien Dispensateur',
        });
        await logAction(`Délivrance Ordonnance ${rxCode} pour ${finalPatientName} (${drugList.length} spécialités)`);
        showToast(`Ordonnance ${rxCode} enregistrée.`, 'success');
      }

      setIsRxModalOpen(false);
      setEditingRx(null);
      setRxDrugs('');
    } catch (err) {
      showToast(formatReadableError(err), 'error');
      try {
        handleFirestoreError(
          err,
          editingRx ? OperationType.UPDATE : OperationType.CREATE,
          editingRx ? `sites/${siteId}/prescriptions/${editingRx.id}` : `sites/${siteId}/prescriptions`
        );
      } catch {
        // logged
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRx = async (rx: PrescriptionRecord) => {
    const confirmed = await confirmAction({
      title: "Supprimer l'ordonnance ?",
      message: `Voulez-vous supprimer l'ordonnance ${rx.rxCode || rx.id} de ${rx.patientName} ?`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;

    const path = `sites/${siteId}/prescriptions/${rx.id}`;
    try {
      await deleteDoc(doc(db, 'sites', siteId, 'prescriptions', rx.id));
      await logAction(`Suppression Ordonnance ${rx.rxCode || rx.id} (${rx.patientName})`);
      showToast('Ordonnance supprimée.', 'info');
    } catch (err) {
      showToast(formatReadableError(err), 'error');
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch {
        // logged
      }
    }
  };

  const filteredPatients = patients.filter(
    (p) =>
      p.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.includes(searchTerm) ||
      p.insuranceName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRx = prescriptions.filter(
    (rx) =>
      rx.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rx.doctorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rx.rxCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 bg-[#070b14] text-slate-100 min-h-screen font-sans space-y-6 select-none">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            DOSSIERS PATIENTS, ORDONNANCES & COUVERTURE ASSURANCES
          </h1>
          <p className="text-xs text-slate-400">
            Historique pharmacothérapeutique, détection des interactions médicamenteuses et taux de tiers payant
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#0c1220] border border-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveSubTab('patients')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'patients' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users size={14} /> Fichiers Patients ({patients.length})
            </button>
            <button
              onClick={() => setActiveSubTab('prescriptions')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'prescriptions' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCheck size={14} /> Ordonnances Médicales ({prescriptions.length})
            </button>
          </div>

          {activeSubTab === 'patients' ? (
            <button
              onClick={openNewPatientModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={15} /> Nouveau Patient
            </button>
          ) : (
            <button
              onClick={openNewRxModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <FileCheck size={15} /> Enregistrer Ordonnance
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              PATIENTS RÉPERTORIÉS
            </span>
            <div className="text-2xl font-mono font-extrabold text-blue-400">{patients.length}</div>
            <div className="text-[11px] text-slate-400 mt-1">Dossiers médicaux actifs</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              ORDONNANCES DÉLIVRÉES
            </span>
            <div className="text-2xl font-mono font-extrabold text-emerald-400">{prescriptions.length}</div>
            <div className="text-[11px] text-emerald-400 mt-1">Contrôlées par pharmacien</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <FileCheck size={22} />
          </div>
        </div>

        <div className="bg-[#0c1222] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              PATIENTS COUVERTS ASSURANCE
            </span>
            <div className="text-2xl font-mono font-extrabold text-purple-400">
              {patients.filter((p) => (p.insuranceRate || 0) > 0).length}
            </div>
            <div className="text-[11px] text-purple-400 mt-1">Tiers payant actif</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ShieldCheck size={22} />
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="flex items-center bg-[#0d1322] border border-slate-800 rounded-xl px-4 py-2.5 focus-within:border-blue-500">
        <Search size={18} className="text-slate-400 mr-2.5 shrink-0" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={
            activeSubTab === 'patients'
              ? 'Rechercher par nom de patient, matricule, téléphone ou assurance...'
              : 'Rechercher par référence, médecin prescripteur ou patient...'
          }
          className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
        />
      </div>

      {/* VIEW 1: PATIENTS TABLE */}
      {activeSubTab === 'patients' && (
        <div className="bg-[#0c1220] rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#11192b] border-b border-slate-800/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">CODE PATIENT</th>
                  <th className="py-3 px-4">NOM ET PRÉNOM</th>
                  <th className="py-3 px-4">CONTACT & VILLE</th>
                  <th className="py-3 px-4">ÂGE & GENRE</th>
                  <th className="py-3 px-4">ALLERGIES & PATHOLOGIES</th>
                  <th className="py-3 px-4">ASSURANCE / COUVERTURE</th>
                  <th className="py-3 px-4 text-center">FIDÉLITÉ</th>
                  <th className="py-3 px-4 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <p className="text-sm font-semibold text-slate-400">Aucun dossier patient enregistré</p>
                      <p className="text-xs">Cliquez sur « Nouveau Patient » pour ouvrir le premier dossier médical.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((pat) => (
                    <tr key={pat.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-400">{pat.code || 'PAT-0001'}</td>
                      <td className="py-3.5 px-4 font-bold text-white">{pat.fullName}</td>
                      <td className="py-3.5 px-4 text-slate-400">
                        <div>{pat.phone}</div>
                        <div className="text-[11px] text-slate-500">{pat.address}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">
                        {pat.age} ans ({pat.gender === 'F' ? 'Femme' : 'Homme'})
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-rose-400 font-medium">{pat.allergies || 'Néant'}</div>
                        <div className="text-[11px] text-slate-400">{pat.chronicConditions || 'Général'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-white">{pat.insuranceName || 'Client Particulier'}</span>
                        {pat.insuranceRate > 0 && (
                          <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {pat.insuranceRate}% PEC
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                          ★ {pat.fidelityTier || 'SILVER'} ({pat.fidelityPoints || 0} pts)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditPatientModal(pat)}
                            className="p-1.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-600 hover:text-white transition-colors cursor-pointer"
                            title="Modifier dossier patient"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeletePatient(pat)}
                            className="p-1.5 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-lg hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                            title="Supprimer dossier patient"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: PRESCRIPTIONS TABLE */}
      {activeSubTab === 'prescriptions' && (
        <div className="bg-[#0c1220] rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#11192b] border-b border-slate-800/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">RÉF ORDONNANCE</th>
                  <th className="py-3 px-4">PATIENT BÉNÉFICIAIRE</th>
                  <th className="py-3 px-4">MÉDECIN PRESCRIPTEUR</th>
                  <th className="py-3 px-4">SPÉCIALITÉS DÉLIVRÉES</th>
                  <th className="py-3 px-4">POSOLOGIE / INSTRUCTIONS</th>
                  <th className="py-3 px-4 text-center">STATUT DÉLIVRANCE</th>
                  <th className="py-3 px-4 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRx.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <p className="text-sm font-semibold text-slate-400">Aucune ordonnance enregistrée</p>
                      <p className="text-xs">Utilisez le bouton « Enregistrer Ordonnance » pour archiver une prescription médicale.</p>
                    </td>
                  </tr>
                ) : (
                  filteredRx.map((rx) => (
                    <tr key={rx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-400">{rx.rxCode || 'ORD-0001'}</td>
                      <td className="py-3 px-4 font-bold text-white">{rx.patientName}</td>
                      <td className="py-3 px-4 text-slate-300">{rx.doctorName}</td>
                      <td className="py-3 px-4 text-emerald-400 font-medium">
                        {Array.isArray(rx.prescribedMedicines) ? rx.prescribedMedicines.join(', ') : rx.prescribedMedicines}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{rx.notes || 'Respecter les heures de prise'}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                            rx.status === 'DELIVRE'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : rx.status === 'PARTIEL'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          }`}
                        >
                          <CheckCircle size={12} /> {rx.status || 'DELIVRE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditRxModal(rx)}
                            className="p-1.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-600 hover:text-white transition-colors cursor-pointer"
                            title="Modifier ordonnance"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteRx(rx)}
                            className="p-1.5 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-lg hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                            title="Supprimer ordonnance"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Create / Edit Patient */}
      <Modal
        isOpen={isPatientModalOpen}
        onClose={() => {
          setIsPatientModalOpen(false);
          setEditingPatient(null);
        }}
        title={editingPatient ? `Modifier Dossier ${editingPatient.code}` : 'Création du Dossier Médical Patient'}
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nom Complet du Patient</label>
            <input
              type="text"
              placeholder="Ex: M. Jean-Pierre Mwamba"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Téléphone</label>
              <input
                type="text"
                value={pPhone}
                onChange={(e) => setPPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Âge</label>
              <input
                type="number"
                value={pAge}
                onChange={(e) => setPAge(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Genre</label>
              <select
                value={pGender}
                onChange={(e) => setPGender(e.target.value as 'M' | 'F')}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="M">Homme (M)</option>
                <option value="F">Femme (F)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Adresse / Commune</label>
            <input
              type="text"
              value={pAddress}
              onChange={(e) => setPAddress(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Allergies Connues</label>
              <input
                type="text"
                placeholder="Ex: Pénicilline, Sulfamides..."
                value={pAllergies}
                onChange={(e) => setPAllergies(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-rose-500/50 rounded-lg text-rose-300 focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Pathologies Chroniques</label>
              <input
                type="text"
                placeholder="Ex: Hypertension, Diabète..."
                value={pConditions}
                onChange={(e) => setPConditions(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Assurance / Tiers Payant</label>
              <select
                value={pInsurance}
                onChange={(e) => setPInsurance(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="ASCOMA ASSURANCE">ASCOMA ASSURANCE</option>
                <option value="ACTIVA ASSURANCES">ACTIVA ASSURANCES</option>
                <option value="RAW SURVIE">RAW SURVIE</option>
                <option value="AUCUNE (PARTICULIER)">AUCUNE (PARTICULIER)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Taux Prise en Charge (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={pInsuranceRate}
                onChange={(e) => setPInsuranceRate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {editingPatient && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Points Fidélité</label>
                <input
                  type="number"
                  min="0"
                  value={pFidelityPoints}
                  onChange={(e) => setPFidelityPoints(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-amber-300 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Palier Fidélité</label>
                <select
                  value={pFidelityTier}
                  onChange={(e) => setPFidelityTier(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="BRONZE">BRONZE</option>
                  <option value="SILVER">SILVER</option>
                  <option value="GOLD">GOLD</option>
                  <option value="PLATINUM">PLATINUM</option>
                </select>
              </div>
            </div>
          )}

          <button
            onClick={handleSavePatient}
            disabled={isSubmitting}
            className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <HeartPulse size={16} />
            {isSubmitting
              ? 'Enregistrement...'
              : editingPatient
              ? 'Mettre à Jour le Dossier Patient'
              : 'Enregistrer le Patient & Carte Fidélité'}
          </button>
        </div>
      </Modal>

      {/* Modal 2: Create / Edit Prescription */}
      <Modal
        isOpen={isRxModalOpen}
        onClose={() => {
          setIsRxModalOpen(false);
          setEditingRx(null);
        }}
        title={editingRx ? `Modifier Ordonnance ${editingRx.rxCode || ''}` : "Enregistrement d'une Ordonnance Médicale"}
      >
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Patient</label>
            <select
              value={rxPatientId}
              onChange={(e) => setRxPatientId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.fullName} ({p.insuranceName})
                </option>
              ))}
              <option value="__WALKIN__">Patient de passage / Saisie libre</option>
            </select>
          </div>

          {rxPatientId === '__WALKIN__' && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Nom du Patient de Passage</label>
              <input
                type="text"
                value={rxWalkInName}
                onChange={(e) => setRxWalkInName(e.target.value)}
                placeholder="Ex: Mme. Béatrice Lunda"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Médecin Prescripteur</label>
              <input
                type="text"
                value={rxDoctor}
                onChange={(e) => setRxDoctor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Statut Délivrance</label>
              <select
                value={rxStatus}
                onChange={(e) => setRxStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="EN_ATTENTE">EN ATTENTE</option>
                <option value="PARTIEL">PARTIEL</option>
                <option value="DELIVRE">DÉLIVRÉ</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Médicaments Prescrits (séparés par virgules)</label>
            <textarea
              rows={2}
              value={rxDrugs}
              onChange={(e) => setRxDrugs(e.target.value)}
              placeholder="Ex: Paracétamol Sirop 2.4%, Clamoxyl 500mg"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Instructions de Posologie & Durée</label>
            <input
              type="text"
              value={rxNotes}
              onChange={(e) => setRxNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleSavePrescription}
            disabled={isSubmitting}
            className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle size={16} />
            {isSubmitting
              ? 'Enregistrement...'
              : editingRx
              ? "Mettre à Jour l'Ordonnance"
              : 'Valider la Délivrance Ordonnance'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
