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
  Cpu,
  Wifi,
  AlertCircle,
} from 'lucide-react';

export default function Login() {
  const { loginWithGoogle, loginAsRole, loading } = useAuth();
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

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    try {
      await loginWithGoogle(selectedRole);
      navigate('/');
    } catch (err: any) {
      const msg = err?.message || 'Connexion Google interrompue.';
      if (msg.includes('popup-blocked')) {
        setErrorMsg('Le navigateur a bloqué la fenêtre Google. Veuillez autoriser les popups pour ce site.');
      } else if (msg.includes('popup-closed-by-user')) {
        setErrorMsg('Fenêtre de connexion fermée avant la validation.');
      } else {
        setErrorMsg(`Erreur d'authentification Google : ${msg}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Veuillez renseigner votre identifiant et votre mot de passe.');
      return;
    }

    try {
      await loginAsRole(
        selectedRole,
        username === 'admin' ? 'Architecte Système' : username
      );
      navigate('/');
    } catch (err: any) {
      const code = err?.code || '';
      const msg = err?.message || '';
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/admin-restricted-operation' ||
        msg.includes('admin-restricted-operation') ||
        msg.includes('operation-not-allowed')
      ) {
        setErrorMsg(
          'La base Cloud Firestore requiert une authentification Google active. Cliquez sur « Se connecter avec Google (Production Cloud) » ci-dessus.'
        );
      } else {
        setErrorMsg(msg || 'Erreur lors de la connexion Firebase.');
      }
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
            SHEKINAH PHARMA
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
            SYSTEM ERP V2.4
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-400">
            <Wifi size={13} />
            <span>Firestore Cloud + Cache IndexedDB</span>
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
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600"></div>

          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 text-blue-400 mx-auto flex items-center justify-center mb-3">
              <ShieldCheck size={28} />
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              Connexion Sécurisée SHEKINAH PHARMA
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Authentification requise pour l'accès en lecture/écriture aux modules ERP
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Role Switcher */}
          <div className="mb-4 text-xs">
            <label className="block text-slate-300 font-semibold mb-1.5">
              Rôle & Profil de Session ERP
            </label>
            <select
              value={selectedRole}
              onChange={(e) => handleQuickSelect(e.target.value)}
              className="w-full bg-[#090d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} — {r.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Primary Google Sign-In CTA */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 mb-4"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>Se connecter avec Google (Production Cloud)</span>
          </button>

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-slate-800 w-full"></div>
            <span className="bg-[#0c1222] px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
              Ou session poste caisse
            </span>
            <div className="border-t border-slate-800 w-full"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Initialisation de la session...</span>
              ) : (
                <>
                  <span>Ouvrir la Session Poste Local</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick-Access Role Badges */}
          <div className="mt-5 pt-4 border-t border-slate-800/80">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
              PRÉSÉLECTION RAPIDE DU RÔLE
            </span>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => handleQuickSelect('super_admin')}
                className={`py-1.5 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
                  selectedRole === 'super_admin'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('pharmacist')}
                className={`py-1.5 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
                  selectedRole === 'pharmacist'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Pharmacien
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('cashier')}
                className={`py-1.5 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
                  selectedRole === 'cashier'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Caissier POS
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer System Disclaimer */}
      <footer className="h-10 px-6 border-t border-slate-800/60 bg-[#090d18] flex items-center justify-between text-[11px] text-slate-500">
        <div>SHEKINAH PHARMA Enterprise · Conforme BPF & Sécurité Médicale</div>
        <div className="font-mono text-emerald-400 flex items-center gap-1.5">
          <CheckCircle size={12} /> Système Opérationnel en Production
        </div>
      </footer>
    </div>
  );
}
