import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useMfaVerifyMutation } from '@nexus/auth';
import { Button } from '@nexus/ui';
import toast from 'react-hot-toast';

const OTP_LENGTH = 6;

export const MfaVerifyPage = () => {
  const [code, setCode] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId') ?? '';
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useMfaVerifyMutation();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!sessionId) navigate('/login', { replace: true });
    inputRefs.current[0]?.focus();
  }, [sessionId, navigate]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const updated = [...code];
    updated[index] = value.slice(-1);
    setCode(updated);
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (updated.every(Boolean)) handleSubmit(updated.join(''));
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (pasted.length === OTP_LENGTH) {
      setCode(pasted.split(''));
      handleSubmit(pasted);
    }
  };

  const handleSubmit = async (otp: string) => {
    try {
      await mutateAsync({ sessionId, code: otp });
      toast.success('Xác thực thành công!');
      window.location.href = '/';
    } catch {
      toast.error('Mã OTP không hợp lệ. Vui lòng thử lại.');
      setCode(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Xác thực 2 lớp</h1>
          <p className="text-slate-400 text-sm mt-1">Nhập mã 6 chữ số từ ứng dụng Authenticator</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-12 h-12 text-center text-xl font-bold rounded-xl border-2 bg-white/10 text-white transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                style={{ borderColor: digit ? '#3b82f6' : 'rgba(255,255,255,0.2)' }}
              />
            ))}
          </div>

          <Button
            fullWidth
            loading={isPending}
            onClick={() => handleSubmit(code.join(''))}
            disabled={code.some((d) => !d)}
          >
            Xác thực
          </Button>

          <button
            className="mt-4 w-full text-sm text-slate-500 hover:text-slate-300 transition-colors"
            onClick={() => navigate('/login')}
          >
            ← Quay lại đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
};
