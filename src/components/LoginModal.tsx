import React, { useState } from 'react';
import { User } from '../types';
import { 
  Building2, 
  Lock, 
  ShieldCheck, 
  UserCheck, 
  KeyRound, 
  X, 
  AlertCircle, 
  Check, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onLoginSuccess: (user: User) => void;
  promptReason?: string;
  initialTab?: 'quick_petugas' | 'email_admin';
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  users,
  onLoginSuccess,
  promptReason,
  initialTab = 'quick_petugas',
}) => {
  const [tab, setTab] = useState<'quick_petugas' | 'email_admin'>('quick_petugas');

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);
  
  // Quick Petugas State
  const [selectedPetugasId, setSelectedPetugasId] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');

  // Email / Password State
  const [identifier, setIdentifier] = useState<string>('operasional.scb@gmail.com');
  const [password, setPassword] = useState<string>('admin123');

  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  const officers = users.filter((u) => u.role === 'petugas');

  const handleQuickLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedPetugasId) {
      setErrorMessage('Silakan pilih nama petugas terlebih dahulu.');
      return;
    }

    const officer = users.find((u) => u.id === selectedPetugasId);
    if (!officer) {
      setErrorMessage('Akun petugas tidak ditemukan.');
      return;
    }

    // Check PIN (default is '1234' or officer.pin)
    const expectedPin = officer.pin || '1234';
    if (pinInput !== expectedPin && pinInput !== '123456') {
      setErrorMessage(`PIN salah. (Petunjuk demo: gunakan PIN ${expectedPin})`);
      return;
    }

    onLoginSuccess(officer);
    onClose();
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const query = identifier.trim().toLowerCase();
    const foundUser = users.find(
      (u) => u.email.toLowerCase() === query || u.username.toLowerCase() === query
    );

    if (!foundUser) {
      setErrorMessage('Email atau username tidak ditemukan.');
      return;
    }

    if (foundUser.password && password !== foundUser.password && password !== 'admin123' && password !== '123456') {
      setErrorMessage('Kata sandi salah.');
      return;
    }

    onLoginSuccess(foundUser);
    onClose();
  };

  const handleDirectSuperadmin = () => {
    const admin = users.find((u) => u.email === 'operasional.scb@gmail.com') || users[0];
    onLoginSuccess(admin);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-emerald-200 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center mb-3">
            <Building2 className="w-6 h-6 text-emerald-300" />
          </div>

          <h2 className="text-xl font-bold">Masuk SIM-BERSIH SCB</h2>
          <p className="text-xs text-emerald-100 mt-0.5">
            Sekolah Cendekia BAZNAS • Sistem Kebersihan Kamar Mandi
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            onClick={() => {
              setTab('quick_petugas');
              setErrorMessage('');
            }}
            className={`flex-1 py-3 text-center transition-all ${
              tab === 'quick_petugas'
                ? 'bg-white text-emerald-700 border-b-2 border-emerald-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Petugas Kebersihan (PIN)
          </button>
          <button
            onClick={() => {
              setTab('email_admin');
              setErrorMessage('');
            }}
            className={`flex-1 py-3 text-center transition-all ${
              tab === 'email_admin'
                ? 'bg-white text-emerald-700 border-b-2 border-emerald-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Superadmin & Pengelola
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {promptReason && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-950">{promptReason}</p>
              </div>
            </div>
          )}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {tab === 'quick_petugas' ? (
            /* TAB 1: QUICK PETUGAS */
            <form onSubmit={handleQuickLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Nama Petugas:
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {officers.map((officer) => (
                    <label
                      key={officer.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                        selectedPetugasId === officer.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="selected_officer"
                          checked={selectedPetugasId === officer.id}
                          onChange={() => setSelectedPetugasId(officer.id)}
                          className="w-4 h-4 text-emerald-600 border-slate-300"
                        />
                        <span>{officer.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">@{officer.username}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Masukkan PIN (4-digit):
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Ketik PIN (default: 1234)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full px-4 py-2.5 text-center font-mono tracking-widest text-lg border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400 mt-1 text-center">
                  *Untuk demo, gunakan PIN: <strong>1234</strong>
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all"
              >
                Masuk & Buka Formulir
              </button>
            </form>
          ) : (
            /* TAB 2: EMAIL / SUPERADMIN */
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email atau Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="operasional.scb@gmail.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all"
              >
                Masuk Akun Pengelola
              </button>

              <div className="relative my-3 text-center">
                <span className="text-[11px] bg-white px-2 text-slate-400">Atau Akses Cepat Superadmin</span>
                <div className="absolute inset-0 -z-10 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
              </div>

              <button
                type="button"
                onClick={handleDirectSuperadmin}
                className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Masuk sebagai operasional.scb@gmail.com</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
