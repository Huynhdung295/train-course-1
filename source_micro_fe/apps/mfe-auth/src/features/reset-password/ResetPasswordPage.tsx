import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router';
import { apiClient } from '@nexus/api-client';
import { Button, PasswordInput } from '@nexus/ui';
import toast from 'react-hot-toast';

const schema = z.object({
  password: z.string().min(8, 'Tối thiểu 8 ký tự').regex(/[A-Z]/, 'Cần ít nhất 1 chữ hoa').regex(/\d/, 'Cần ít nhất 1 chữ số'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Mật khẩu không khớp', path: ['confirmPassword'] });

type Values = z.infer<typeof schema>;

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Values) => {
    try {
      await apiClient.post('/api/v1/auth/reset-password', { token, newPassword: data.password });
      toast.success('Đặt lại mật khẩu thành công!');
      navigate('/login');
    } catch {
      toast.error('Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Đặt lại mật khẩu</h1>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <PasswordInput label="Mật khẩu mới" error={errors.password?.message} {...register('password')} />
            <PasswordInput label="Xác nhận mật khẩu" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
            <Button type="submit" fullWidth loading={isSubmitting}>Xác nhận</Button>
          </form>
        </div>
      </div>
    </div>
  );
};
