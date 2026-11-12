import { useEffect, useState } from 'react';
import { db, auth } from './firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { 
  Users, 
  FileText, 
  Search, 
  Plus, 
  HeartPulse, 
  AlertCircle, 
  Calendar, 
  Phone, 
  MapPin, 
  CheckCircle,
  FileCheck,
  ShieldCheck,
  Sparkles,
  Layers
} from 'lucide-react';
import Modal from './Modal';

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
  insuranceRate: number; // e.g. 80%
  fidelityPoints: number;
  fidelityTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
}

interface PrescriptionRecord {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  prescribedMedicines: string[];
  date: string;
  status: 'DELIVRE' | 'PARTIEL' | 'EN_ATTENTE';
  notes: string;
}

export default function PatientsAndPrescriptions() {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'patients' | 'prescriptions'>('patients');
  const [searchTerm, setSearchTerm] = useState('');
  const [siteId] = useState('site1');

  // New Patient Modal
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [pName, setPName] = useState('');
  const [pPhone, setPPhone] = useState('+243 81 ');
  const [pAddress, setPAddress] = useState('Kinshasa - Gombe');
  const [pAge, setPAge] = useState('35');
  const [pGender, setPGender] = useState<'M' | 'F'>('M');
  const [pAllergies, setPAllergies] = useState('Aucune connue');
  const [pConditions, setPConditions] = useState('Hypertension');
  const [pInsurance, setPInsurance] = useState('ASCOMA ASSURANCE');
  const [pInsuranceRate, setPInsuranceRate] = useState('80');

  // New Prescription Modal
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [rxPatientId, setRxPatientId] = useState('');
  const [rxDoctor, setRxDoctor] = useState('Dr. Kabongo (Clinique Ngaliema)');
  const [rxDrugs, setRxDrugs] = useState('Paracétamol Sirop, Clamoxyl 500mg, Gaviscon');
  const [rxNotes, setRxNotes] = useState('Posologie : 1 gélule 3 fois par jour après les repas');

  useEffect(() => {
    // 1. Fetch Patients
    const patientsRef = collection(db, 'sites', siteId, 'patients');
    const unsubsPatients = onSnapshot(patientsRef, (snap) => {
      setPatients(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });

    // 2. Fetch Prescriptions
    const rxRef = collection(db, 'sites', siteId, 'prescriptions');
    const qRx = query(rxRef, orderBy('createdAt', 'desc'));
    const unsubsRx = onSnapshot(qRx, (snap) => {
      setPrescriptions(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });

    return () => {
      unsubsPatients();
      unsubsRx();
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

  const handleCreatePatient = async () => {
    if (!pName.trim()) {
      alert('Veuillez renseigner le nom complet du patient.');
      return;
    }

    const code = `PAT-${Date.now().toString().slice(-5)}`;
    await addDoc(collection(db, 'sites', siteId, 'patients'), {
      code,
      fullName: pName,
      phone: pPhone,
      address: pAddress,
      age: parseInt(pAge, 10) || 30,
      gender: pGender,
      allergies: pAllergies,
      chronicConditions: pConditions,
      insuranceName: pInsurance,
      insuranceRate: parseInt(pInsuranceRate, 10) || 0,
      fidelityPoints: 50,
      fidelityTier: 'SILVER',
      createdAt: serverTimestamp()
    });

    await logAction(`Création Dossier Patient : ${code} - ${pName} (${pInsurance})`);
    setIsPatientModalOpen(false);
    setPName('');
  };

  const handleCreatePrescription = async () => {
    const patient = patients.find(p => p.id === rxPatientId) || patients[0];
    if (!patient || !rxDrugs.trim()) {
      alert('Veuillez renseigner le patient et les médicaments prescrits.');
      return;
    }

    const rxCode = `ORD-${Date.now().toString().slice(-5)}`;
    const drugList = rxDrugs.split(',').map(s => s.trim()).filter(Boolean);

    await addDoc(collection(db, 'sites', siteId, 'prescriptions'), {
      rxCode,
      patientId: patient.id,
      patientName: patient.fullName,
      doctorName: rxDoctor,
      prescribedMedicines: drugList,
      date: new Date().toLocaleDateString(),
      status: 'DELIVRE',
      notes: rxNotes,
      createdAt: serverTimestamp(),
      dispensedBy: auth.currentUser?.email || 'Pharmacien Dispensateur'
    });

    await logAction(`Délivrance Ordonnance ${rxCode} pour ${patient.fullName} (${drugList.length} spécialités)`);
    setIsRxModalOpen(false);
    setRxDrugs('');
  };

  const filteredPatients = patients.filter(p => 
    p.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm) ||
    p.insuranceName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRx = prescriptions.filter(rx => 
    rx.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rx.doctorName?.toLowerCase().includes(searchTerm.toLowerCase())
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
              onClick={() => setIsPatientModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={15} /> + Nouveau Patient
            </button>
          ) : (
            <button
              onClick={() => {
                if (patients.length > 0) setRxPatientId(patients[0].id);
                setIsRxModalOpen(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <FileCheck size={15} /> + Enregistrer Ordonnance
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
              {patients.filter(p => p.insuranceRate > 0).length}
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
              ? "Rechercher par nom de patient, matricule, téléphone ou assurance..."
              : "Rechercher par nom du médecin prescripteur ou patient..."
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <p className="text-sm font-semibold text-slate-400">Aucun dossier patient enregistré</p>
                      <p className="text-xs">Cliquez sur « + Nouveau Patient » pour ouvrir le premier dossier médical.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((pat) => (
                    <tr key={pat.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                        {pat.code || 'PAT-0001'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        {pat.fullName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        <div>{pat.phone}</div>
                        <div className="text-[11px] text-slate-500">{pat.address}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">
                        {pat.age} ans ({pat.gender === 'F' ? 'Femme' : 'Homme'})
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-rose-400 font-medium">⚠️ {pat.allergies || 'Néant'}</div>
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
                          ★ {pat.fidelityTier || 'SILVER'} ({pat.fidelityPoints || 50} pts)
                        </span>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRx.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <p className="text-sm font-semibold text-slate-400">Aucune ordonnance enregistrée</p>
                      <p className="text-xs">Utilisez le bouton « + Enregistrer Ordonnance » pour archiver une prescription médicale.</p>
                    </td>
                  </tr>
                ) : (
                  filteredRx.map((rx: any) => (
                    <tr key={rx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-400">
                        {rx.rxCode || 'ORD-0001'}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {rx.patientName}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {rx.doctorName}
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-medium">
                        {Array.isArray(rx.prescribedMedicines) ? rx.prescribedMedicines.join(', ') : rx.prescribedMedicines}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {rx.notes || 'Respecter les heures de prise'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle size={12} /> DÉLIVRÉ CONFORME
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: New Patient */}
      <Modal
        isOpen={isPatientModalOpen}
        onClose={() => setIsPatientModalOpen(false)}
        title="Création du Dossier Médical Patient"
      >
        <div className="space-y-3.5 text-xs">
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

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Allergies Connues (Alerte Risque)</label>
            <input
              type="text"
              placeholder="Ex: Allergie Pénicilline, Sulfamides..."
              value={pAllergies}
              onChange={(e) => setPAllergies(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-rose-500/50 rounded-lg text-rose-300 focus:border-rose-500 focus:outline-none"
            />
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

          <button
            onClick={handleCreatePatient}
            className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <HeartPulse size={16} /> Enregistrer le Patient & Carte Fidélité
          </button>
        </div>
      </Modal>

      {/* Modal 2: New Prescription */}
      <Modal
        isOpen={isRxModalOpen}
        onClose={() => setIsRxModalOpen(false)}
        title="Enregistrement d'une Ordonnance Médicale"
      >
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Patient</label>
            <select
              value={rxPatientId}
              onChange={(e) => setRxPatientId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.fullName} ({p.insuranceName})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Médecin Prescripteur / Établissement</label>
            <input
              type="text"
              value={rxDoctor}
              onChange={(e) => setRxDoctor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            />
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
            onClick={handleCreatePrescription}
            className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle size={16} /> Valider la Délivrance Ordonnance
          </button>
        </div>
      </Modal>
    </div>
  );
}
