/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, CleaningReport } from './types';
import { 
  getUsers, 
  saveUsers, 
  addUser, 
  updateUser, 
  deleteUser, 
  getReports, 
  addReport, 
  updateReport, 
  deleteReport, 
  getCurrentUser, 
  setCurrentUser, 
  clearCurrentUser,
  resetAllData
} from './utils/storage';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { ReportForm } from './components/ReportForm';
import { AccountManagement } from './components/AccountManagement';
import { LoginModal } from './components/LoginModal';
import { PrintModal } from './components/PrintModal';
import { GoogleDriveManager } from './components/GoogleDriveManager';
import { CheckCircle2, AlertCircle, Building2, Sparkles, UserCheck } from 'lucide-react';

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [reports, setReports] = useState<CleaningReport[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'input' | 'accounts' | 'drive'>('dashboard');

  // Modals
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [printReportsData, setPrintReportsData] = useState<CleaningReport[] | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const [loginModalPrompt, setLoginModalPrompt] = useState<string>('');
  const [loginModalTab, setLoginModalTab] = useState<'quick_petugas' | 'email_admin'>('quick_petugas');

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  const handleOpenLoginModal = (
    reason = 'Silakan masuk pada akun Petugas Kebersihan atau Pengelola SCB.',
    tab: 'quick_petugas' | 'email_admin' = 'quick_petugas'
  ) => {
    setLoginModalPrompt(reason);
    setLoginModalTab(tab);
    setIsLoginModalOpen(true);
  };

  const handleRequestInputReport = () => {
    if (!currentUser) {
      handleOpenLoginModal(
        'Akses Dibatasi: Non-user / Tamu hanya bisa melihat Dashboard. Silakan login sebagai Petugas untuk mengisi laporan.',
        'quick_petugas'
      );
      showToast('Non-user / Tamu hanya bisa melihat dashboard. Silakan login.', 'error');
      setActiveTab('dashboard');
      return;
    }
    setActiveTab('input');
  };

  // Safe tab change handler to block non-users from switching to input or accounts
  const handleSafeTabChange = (targetTab: 'dashboard' | 'input' | 'accounts' | 'drive') => {
    if (targetTab === 'input') {
      handleRequestInputReport();
      return;
    }
    if (targetTab === 'accounts') {
      if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.email !== 'operasional.scb@gmail.com')) {
        handleOpenLoginModal('Pengelolaan akun hanya dapat diakses oleh Superadmin.', 'email_admin');
        setActiveTab('dashboard');
        return;
      }
    }
    setActiveTab(targetTab);
  };

  // Initial Load
  useEffect(() => {
    const loadedUsers = getUsers();
    setUsers(loadedUsers);

    const loadedCurrentUser = getCurrentUser();
    setCurrentUserState(loadedCurrentUser);

    const loadedReports = getReports();
    setReports(loadedReports);
  }, []);

  // Handlers for Reports
  const handleAddNewReport = (newReportData: Omit<CleaningReport, 'id' | 'timestamp'>) => {
    const saved = addReport(newReportData);
    setReports(getReports());
    showToast(`Laporan ${saved.area} berhasil disimpan!`);
  };

  const handleUpdateReport = (id: string, updates: Partial<CleaningReport>) => {
    updateReport(id, updates);
    setReports(getReports());
    showToast('Laporan berhasil diperbarui / diverifikasi.');
  };

  const handleDeleteReport = (id: string) => {
    deleteReport(id);
    setReports(getReports());
    showToast('Laporan berhasil dihapus.', 'info');
  };

  // Handlers for Users
  const handleAddUser = (userData: Omit<User, 'id' | 'createdAt'>) => {
    const created = addUser(userData);
    setUsers(getUsers());
    showToast(`Petugas ${created.name} berhasil ditambahkan!`);
  };

  const handleUpdateUser = (id: string, updates: Partial<User>) => {
    const updated = updateUser(id, updates);
    setUsers(getUsers());
    if (currentUser?.id === id && updated) {
      setCurrentUserState(updated);
      setCurrentUser(updated);
    }
    showToast('Data petugas berhasil diperbarui.');
  };

  const handleDeleteUser = (id: string) => {
    deleteUser(id);
    setUsers(getUsers());
    showToast('Akun berhasil dihapus.', 'info');
  };

  // User Session
  const handleSwitchUser = (user: User) => {
    setCurrentUser(user);
    setCurrentUserState(user);
    showToast(`Beralih ke akun: ${user.name}`);
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setCurrentUserState(user);
    showToast(`Selamat datang, ${user.name}!`);
    // If officer, automatically suggest the input tab
    if (user.role === 'petugas') {
      setActiveTab('input');
    }
  };

  const handleLogout = () => {
    clearCurrentUser();
    setCurrentUserState(null);
    setIsLoginModalOpen(true);
    showToast('Anda telah keluar. Silakan masuk kembali.', 'info');
  };

  const handleResetData = () => {
    resetAllData();
    setUsers(getUsers());
    setReports(getReports());
    const admin = getCurrentUser();
    setCurrentUserState(admin);
    showToast('Data demo berhasil direset ke setelan awal.', 'info');
  };

  const officers = users.filter((u) => u.role === 'petugas');
  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.email === 'operasional.scb@gmail.com';

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-60 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-800 text-white border-emerald-700'
                : toast.type === 'error'
                ? 'bg-rose-800 text-white border-rose-700'
                : 'bg-slate-800 text-white border-slate-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-300" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        currentUser={currentUser}
        allUsers={users}
        activeTab={activeTab}
        setActiveTab={handleSafeTabChange}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
        onOpenLoginModal={() => handleOpenLoginModal('Masuk Akun Petugas Kebersihan / Superadmin SCB')}
        onRequestInputReport={handleRequestInputReport}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'dashboard' && (
          <DashboardView
            reports={reports}
            currentUser={currentUser}
            officers={officers}
            onAddNewReport={handleRequestInputReport}
            onUpdateReport={handleUpdateReport}
            onDeleteReport={handleDeleteReport}
            onOpenPrintModal={(filtered) => setPrintReportsData(filtered)}
            onOpenLoginModal={handleOpenLoginModal}
          />
        )}

        {activeTab === 'input' && (
          currentUser ? (
            <ReportForm
              currentUser={currentUser}
              officers={officers}
              onSubmitSuccess={(newReport) => {
                handleAddNewReport(newReport);
              }}
              onViewDashboard={() => setActiveTab('dashboard')}
            />
          ) : (
            <div className="max-w-md mx-auto my-14 p-6 sm:p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
              <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">Akses Khusus Petugas Kebersihan</h3>
              <p className="text-xs text-slate-600 mt-2 mb-6 leading-relaxed">
                Non-user / Tamu hanya bisa melihat dashboard pemantauan. Untuk mengisi Formulir Laporan Kebersihan Kamar Mandi, silakan masuk ke akun Petugas Anda terlebih dahulu.
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => handleOpenLoginModal('Silakan masuk ke akun Petugas Kebersihan Anda untuk mengisi formulir.', 'quick_petugas')}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-colors"
                >
                  Masuk Akun Petugas
                </button>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                >
                  Kembali ke Dashboard Laporan
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'accounts' && (
          isSuperAdmin ? (
            <AccountManagement
              users={users}
              currentUser={currentUser}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onSwitchUser={handleSwitchUser}
              onResetData={handleResetData}
            />
          ) : (
            <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl border border-slate-200 text-center">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800 text-base">Akses Khusus Super Admin</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Halaman pengelolaan akun hanya dapat diakses oleh akun pengelola superadmin (operasional.scb@gmail.com).
              </p>
              <button
                onClick={() => {
                  const admin = users.find((u) => u.email === 'operasional.scb@gmail.com') || users[0];
                  handleSwitchUser(admin);
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
              >
                Beralih ke Superadmin
              </button>
            </div>
          )
        )}

        {activeTab === 'drive' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <GoogleDriveManager
              reports={reports}
              onShowToast={showToast}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700">SIM-BERSIH SCB</span>
            <span>•</span>
            <span>Sekolah Cendekia BAZNAS (SCB)</span>
          </div>
          <div className="flex items-center space-x-3 text-[11px] text-slate-400">
            <span>Petugas: IDAY M YUSUF • ABDUL KODIR • WAHYUDIN</span>
            <span>•</span>
            <span>Superadmin: operasional.scb@gmail.com</span>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        users={users}
        onLoginSuccess={handleLoginSuccess}
        promptReason={loginModalPrompt}
        initialTab={loginModalTab}
      />

      {/* Print Document Modal */}
      {printReportsData && (
        <PrintModal
          isOpen={!!printReportsData}
          onClose={() => setPrintReportsData(null)}
          reports={printReportsData}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
