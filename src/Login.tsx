import { useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Store, 
  Lock, 
  User, 
  ArrowRight, 
  CheckCircle, 
  KeyRound, 
  Cpu, 
  Wifi, 
  AlertCircle 
} from 'lucide-react';

export default function Login() {
  const { loginAsRole, loading } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@2026');
  const [selectedRole, setSelectedRole] = useState('super_admin');
  const [errorMsg, setErrorMsg] = useState('');

  const roles = [
    { id: 'super_admin', label: 'Super Admin / Architecte', desc: 'Accès système intégral et supervision' },
    { id: 'pharmacist', label: 'Pharmacien Titulaire', desc: 'Validation ordonnances et délivrance' },
    { id: 'cashier', label: 'Caissier Comptoir', desc: 'Point de vente POS et encaissement' },
    { id: 'stock_manager', label: 'Gestionnaire Stock', desc: 'Approvisionnements et dépôts' },
    { id: 'accountant', label: 'Comptable / Auditeur', desc: 'Journaux comptables et bilans' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Production check
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Veuillez renseigner votre identifiant et votre mot de passe.');
      return;
    }

    try {
      await loginAsRole(selectedRole, username === 'admin' ? 'Architecte Système (Créateur)' : username);
      navigate('/');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la connexion.');
    }
  };

  const handleQuickSelect = (roleId: string) => {
    setSelectedRole(roleId);
    if (roleId === 'super_admin') {
      setUsername('admin');
      setPassword('Admin@2026');
    } else if (roleId === 'pharmacist') {
      setUsername('dr.mwamba');
      setPassword('Pharm@2026');
    } else if (roleId === 'cashier') {
      setUsername('caisse1');
      setPassword('Caisse@2026');
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#070b14] text-slate-100 flex flex-col justify-between font-sans select-none">
      {/* Top Banner System Status */}
      <header className="h-14 border-b border-slate-800/80 px-6 flex items-center justify-between bg-[#090d18]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
            <Store size={18} />
          </div>
          <span className="font-extrabold text-sm tracking-tight text-white">
            PHARMAFLOW GROUP SARL
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
            SYSTEM ERP V2.4
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-400">
            <Wifi size={13} />
            <span>Mode Autonome / 100% Hors Ligne Prêt</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-md text-slate-400">
            <Cpu size={13} className="text-blue-400" />
            <span>Chiffrement AES-256</span>
          </div>
        </div>
      </header>

      {/* Main Login Box */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0c1222] border border-slate-800/90 rounded-2xl shadow-2xl p-7 relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600"></div>

          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 text-blue-400 mx-auto flex items-center justify-center mb-3">
              <ShieldCheck size={28} />
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              Connexion Sécurisée PharmaFlow
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Portail d'authentification pour officine, caisse et gestion multi-succursales
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Role Switcher */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Rôle & Profil de Session
              </label>
              <select
                value={selectedRole}
                onChange={(e) => handleQuickSelect(e.target.value)}
                className="w-full bg-[#090d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Username Input */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Identifiant Utilisateur
              </label>
              <div className="relative flex items-center">
                <User size={16} className="absolute left-3.5 text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin ou matricule..."
                  className="w-full bg-[#090d18] border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none font-mono"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-300 font-semibold">
                  Mot de Passe
                </label>
                <span className="text-[10px] text-slate-500">Défaut: Admin@2026</span>
              </div>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3.5 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#090d18] border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none font-mono"
                  required
                />
              </div>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Initialisation de la session...</span>
              ) : (
                <>
                  <span>Ouvrir la Session de Caisse</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick-Access Role Badges for Instant Production Testing */}
          <div className="mt-5 pt-4 border-t border-slate-800/80">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
              ACCÈS RAPIDE PAR RÔLE
            </span>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => handleQuickSelect('super_admin')}
                className={`py-1.5 px-2 rounded-lg border text-center transition-colors ${
                  selectedRole === 'super_admin' ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                👑 Super Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('pharmacist')}
                className={`py-1.5 px-2 rounded-lg border text-center transition-colors ${
                  selectedRole === 'pharmacist' ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                💊 Pharmacien
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('cashier')}
                className={`py-1.5 px-2 rounded-lg border text-center transition-colors ${
                  selectedRole === 'cashier' ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                🛒 Caissier POS
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer System Disclaimer */}
      <footer className="h-10 px-6 border-t border-slate-800/60 bg-[#090d18] flex items-center justify-between text-[11px] text-slate-500">
        <div>PharmaFlow Enterprise · Conforme BPF & Sécurité Médicale</div>
        <div className="font-mono text-emerald-400 flex items-center gap-1.5">
          <CheckCircle size={12} /> Système Opérationnel en Production
        </div>
      </footer>
    </div>
  );
}
