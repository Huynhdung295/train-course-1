import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { LoginPage } from './features/login/LoginPage';
import { MfaVerifyPage } from './features/mfa/MfaVerifyPage';
import { ForgotPasswordPage } from './features/reset-password/ForgotPasswordPage';
import { ResetPasswordPage } from './features/reset-password/ResetPasswordPage';

export const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/mfa" element={<MfaVerifyPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </BrowserRouter>
);
