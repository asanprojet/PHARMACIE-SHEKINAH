/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ToastProvider } from './ToastContext';
import Login from './Login';
import ProfessionalLayout from './ProfessionalLayout';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, firebaseUser, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="h-screen w-screen bg-[#070b14] text-slate-300 flex items-center justify-center font-sans text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Initialisation sécurisée SHEKINAH PHARMA ERP...</span>
        </div>
      </div>
    );
  }

  return currentUser && firebaseUser ? <>{children}</> : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <ProfessionalLayout />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
