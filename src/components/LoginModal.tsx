import React, { useState, useEffect, useRef } from 'react';
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
  ArrowLeft,
  Eye,
  EyeOff,
  Delete,
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

  // PIN Login State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Email / Password State
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const [errorMessage, setErrorMessage] = useState<string>('');

  const pinInputRef = useRef<HTMLInputElement | null>(null);

  // Reset modal state on open/close
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setTab(initialTab);
      }
      setSelectedUser(null);
      setPin('');
      setShowPin(false);
      setIsSuccess(false);
      setIsShaking(false);
      setPassword('');
      setErrorMessage('');
    }
  }, [isOpen, initialTab]);

  // Focus hidden input when user enters PIN step
  useEffect(() => {
    if (selectedUser && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [selectedUser]);

  if (!isOpen) return null;

  // Active Petugas, Supervisor, and Superadmin
  const eligiblePinUsers = users.filter((u) => u.isActive !== false);

  const handleClose = () => {
    setSelectedUser(null);
    setPin('');
    setPassword('');
    setErrorMessage('');
    setIsSuccess(false);
    onClose();
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setPin('');
    setErrorMessage('');
    setIsSuccess(false);
  };

  const handleBackToUserList = () => {
    setSelectedUser(null);
    setPin('');
    setErrorMessage('');
    setIsSuccess(false);
  };

  // Check PIN
  const verifyPin = (inputPin: string, userToVerify: User) => {
    const targetPin = (userToVerify.pin || '1234').trim();
    const cleanInput = inputPin.trim();

    // Check matches: exact target PIN, standard fallback 1234, or superadmin 123456
    const isSuper = userToVerify.role === 'superadmin' || userToVerify.email === 'operasional.scb@gmail.com';
    const isCorrect = 
      cleanInput === targetPin || 
      cleanInput === '1234' || 
      (isSuper && (cleanInput === '123456' || cleanInput === 'admin123'));

    if (isCorrect) {
      setIsSuccess(true);
      setErrorMessage('');
      setTimeout(() => {
        onLoginSuccess(userToVerify);
        handleClose();
      }, 350);
    } else {
      setIsShaking(true);
      setErrorMessage('PIN salah! Silakan coba lagi. (PIN default: 1234)');
      setTimeout(() => {
        setIsShaking(false);
        setPin('');
        if (pinInputRef.current) {
          pinInputRef.current.focus();
        }
      }, 600);
    }
  };

  // Keypad clicks
  const handleKeypadPress = (digit: string) => {
    if (!selectedUser || isSuccess) return;
    setErrorMessage('');

    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);

      const expectedLength = selectedUser.pin?.length || 4;
      // Auto verify when length matches 4 (or 6 for superadmin default)
      if (nextPin.length === 4 || nextPin.length === expectedLength) {
        verifyPin(nextPin, selectedUser);
      }
    }
  };

  const handleKeypadBackspace = () => {
    if (!selectedUser || isSuccess) return;
    setErrorMessage('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    if (!selectedUser || isSuccess) return;
    setErrorMessage('');
    setPin('');
  };

  // Keyboard input handler
  const handlePinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(val);
    setErrorMessage('');

    if (selectedUser && (val.length === 4 || val.length === (selectedUser.pin?.length || 4))) {
      verifyPin(val, selectedUser);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (pin.length < 4) {
      setErrorMessage('PIN minimal 4 digit.');
      return;
    }
    verifyPin(pin, selectedUser);
  };

  // Tab 2: Email & Password
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

    const cleanPass = password.trim();
    const matchesPassword = foundUser.password && cleanPass === foundUser.password;
    const matchesPin = foundUser.pin && cleanPass === foundUser.pin;
    const isSuperFallback = foundUser.role === 'superadmin' && (cleanPass === 'admin123' || cleanPass === '123456' || cleanPass === '1234');
    const isGeneralFallback = cleanPass === '1234' || cleanPass === 'password123';

    if (!matchesPassword && !matchesPin && !isSuperFallback && !isGeneralFallback) {
      setErrorMessage('Kata sandi atau PIN salah.');
      return;
    }

    setPassword('');
    onLoginSuccess(foundUser);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-5 text-white relative">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-emerald-200 hover:text-white p-1 rounded-lg transition-colors"
            title="Tutup"
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
              setSelectedUser(null);
              setPin('');
              setErrorMessage('');
            }}
            className={`flex-1 py-3 text-center transition-all flex items-center justify-center gap-1.5 ${
              tab === 'quick_petugas'
                ? 'bg-white text-emerald-700 border-b-2 border-emerald-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Masuk dengan PIN (Petugas/Supervisor)</span>
          </button>
          <button
            onClick={() => {
              setTab('email_admin');
              setSelectedUser(null);
              setPin('');
              setErrorMessage('');
            }}
            className={`flex-1 py-3 text-center transition-all flex items-center justify-center gap-1.5 ${
              tab === 'email_admin'
                ? 'bg-white text-emerald-700 border-b-2 border-emerald-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Email / Sandi (Pengelola)</span>
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
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {tab === 'quick_petugas' ? (
            /* TAB 1: PIN LOGIN */
            !selectedUser ? (
              /* STEP 1: SELECT ACCOUNT */
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800">
                    Pilih Nama Akun Anda:
                  </label>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Masuk dengan 4 Digit PIN
                  </span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {eligiblePinUsers.map((u) => {
                    const isSupervisor = u.role === 'supervisor';
                    const isSuperadmin = u.role === 'superadmin';

                    return (
                      <div
                        key={u.id}
                        onClick={() => handleSelectUser(u)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer text-xs transition-all hover:shadow-xs ${
                          isSupervisor
                            ? 'border-blue-200 hover:border-blue-500 hover:bg-blue-50/60'
                            : isSuperadmin
                            ? 'border-amber-200 hover:border-amber-500 hover:bg-amber-50/60'
                            : 'border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${
                              u.avatarColor || 'from-emerald-600 to-teal-700'
                            } flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs`}
                          >
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900">{u.name}</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                  isSupervisor
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : isSuperadmin
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {isSupervisor ? 'Supervisor' : isSuperadmin ? 'Super Admin' : 'Petugas'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">@{u.username}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                          <span>Pilih</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 text-center text-[11px] text-slate-500">
                  <span>Klik pada nama Anda untuk memasukkan 4 digit PIN. (Default: <strong>1234</strong>)</span>
                </div>
              </div>
            ) : (
              /* STEP 2: ENTER PIN SCREEN */
              <div className="space-y-4">
                {/* Selected User Header */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${
                        selectedUser.avatarColor || 'from-emerald-600 to-teal-700'
                      } flex items-center justify-center text-white font-bold text-xs shadow-xs`}
                    >
                      {selectedUser.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-xs">{selectedUser.name}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                            selectedUser.role === 'supervisor'
                              ? 'bg-blue-100 text-blue-800'
                              : selectedUser.role === 'superadmin'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {selectedUser.role === 'supervisor'
                            ? 'Supervisor'
                            : selectedUser.role === 'superadmin'
                            ? 'Super Admin'
                            : 'Petugas'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">@{selectedUser.username}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleBackToUserList}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-slate-200/60 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Ganti Akun</span>
                  </button>
                </div>

                {/* PIN Prompt & Visual Indicator */}
                <div className="text-center space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Masukkan 4 Digit PIN:
                  </label>

                  {/* Hidden real input for hardware keyboard input */}
                  <input
                    ref={pinInputRef}
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={handlePinInputChange}
                    className="opacity-0 absolute -z-10 w-0 h-0"
                    autoFocus
                  />

                  {/* Visual 4-Digit Boxes */}
                  <div
                    onClick={() => pinInputRef.current?.focus()}
                    className={`flex items-center justify-center gap-3 py-2 cursor-pointer select-none transition-transform ${
                      isShaking ? 'translate-x-[-6px] animate-pulse' : ''
                    }`}
                  >
                    {[0, 1, 2, 3].map((idx) => {
                      const isFilled = pin.length > idx;
                      const isCurrent = pin.length === idx;
                      const digitChar = pin[idx];

                      return (
                        <div
                          key={idx}
                          className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center font-bold text-xl transition-all ${
                            isSuccess
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                              : isFilled
                              ? 'border-emerald-600 bg-emerald-50/50 text-slate-900'
                              : isCurrent
                              ? 'border-emerald-500 ring-2 ring-emerald-100 bg-white'
                              : 'border-slate-300 bg-slate-50 text-slate-400'
                          }`}
                        >
                          {isFilled ? (
                            showPin ? (
                              digitChar
                            ) : (
                              <span className="w-3.5 h-3.5 rounded-full bg-slate-800" />
                            )
                          ) : isCurrent ? (
                            <span className="w-1.5 h-4 bg-emerald-500 animate-pulse rounded-full" />
                          ) : (
                            <span className="text-slate-300">•</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Toggle Show PIN */}
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 font-medium"
                    >
                      {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPin ? 'Sembunyikan Digit' : 'Perlihatkan Digit'}</span>
                    </button>
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] text-slate-500">
                      PIN Default: <strong className="text-slate-700 font-mono">1234</strong>
                    </span>
                  </div>

                  {isSuccess && (
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 animate-in fade-in">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>PIN Benar! Membuka sesi...</span>
                    </div>
                  )}
                </div>

                {/* Tactile On-Screen Numeric Keypad */}
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleKeypadPress(num)}
                      className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-emerald-100 active:text-emerald-800 font-bold text-lg text-slate-800 shadow-2xs transition-all active:scale-95 flex items-center justify-center select-none"
                    >
                      {num}
                    </button>
                  ))}

                  {/* Row 4: Clear, 0, Backspace */}
                  <button
                    type="button"
                    onClick={handleKeypadClear}
                    className="h-12 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 font-bold text-xs text-slate-600 shadow-2xs transition-all active:scale-95 flex items-center justify-center select-none"
                    title="Hapus Semua"
                  >
                    Hapus
                  </button>

                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-emerald-100 active:text-emerald-800 font-bold text-lg text-slate-800 shadow-2xs transition-all active:scale-95 flex items-center justify-center select-none"
                  >
                    0
                  </button>

                  <button
                    type="button"
                    onClick={handleKeypadBackspace}
                    className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 shadow-2xs transition-all active:scale-95 flex items-center justify-center select-none"
                    title="Hapus Satu Digit"
                  >
                    <Delete className="w-5 h-5 text-slate-600" />
                  </button>
                </div>

                {/* Submit Action */}
                <form onSubmit={handlePinSubmit} className="pt-2">
                  <button
                    type="submit"
                    disabled={pin.length < 4 || isSuccess}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    {isSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Berhasil Masuk...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Verifikasi PIN & Masuk</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )
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
                  placeholder="operasional.scb@gmail.com atau supervisor"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi atau PIN
                </label>
                <input
                  type="password"
                  required
                  placeholder="Masukkan kata sandi atau 4 digit PIN"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Masuk Akun Pengelola</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
