import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { apiClient } from '@nexus/api-client';
import { useAuthStore } from '@nexus/auth';
import type { LoginResponse } from '@nexus/types';
import toast from 'react-hot-toast';

export const PasskeyButton = () => {
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const handlePasskey = async () => {
    setLoading(true);
    try {
      // Step 1: Get authentication options from backend
      const options = await apiClient.get<Record<string, unknown>>(
        '/api/v1/auth/passkey/authenticate/options',
      );

      // Step 2: Perform WebAuthn authentication
      const credential = await startAuthentication({ optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'] });

      // Step 3: Verify with backend
      const response = await apiClient.post<LoginResponse>(
        '/api/v1/auth/passkey/authenticate',
        credential,
      );

      setAuth(response.user, response.tokens, response.user.tenantId);
      toast.success('Đăng nhập bằng Passkey thành công!');
      window.location.href = '/';
    } catch (err) {
      toast.error('Passkey xác thực thất bại.');
      console.error('[Passkey] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePasskey}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
        </svg>
      )}
      Đăng nhập với Passkey
    </button>
  );
};
