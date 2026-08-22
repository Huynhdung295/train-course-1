import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { apiClient } from '@nexus/api-client';
import { Button, Input } from '@nexus/ui';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
});
type Values = z.infer<typeof schema>;

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Values) => {
    try {
      await apiClient.post('/api/v1/auth/forgot-password', { email: data.email });
      toast.success('Email đặt lại mật khẩu đã được gửi!');
      navigate('/login');
    } catch {
      toast.error('Không tìm thấy tài khoản với email này.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Quên mật khẩu</h1>
          <p className="text-slate-400 text-sm mt-1">Nhập email để nhận link đặt lại mật khẩu</p>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Email" type="email" placeholder="you@company.com" error={errors.email?.message} {...register('email')} />
            <Button type="submit" fullWidth loading={isSubmitting}>Gửi email</Button>
          </form>
          <button className="mt-4 w-full text-sm text-slate-500 hover:text-slate-300 transition-colors" onClick={() => navigate('/login')}>
            ← Quay lại đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
};
