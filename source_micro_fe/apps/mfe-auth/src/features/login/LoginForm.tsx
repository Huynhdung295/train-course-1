import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router';
import { useLoginMutation } from '@nexus/auth';
import { Button, Input, PasswordInput } from '@nexus/ui';
import { handleRFC7807Errors } from '@nexus/utils';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  username: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginForm = () => {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useLoginMutation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const response = await mutateAsync({
        username: data.username,
        password: data.password,
        authMethod: 'PASSWORD',
      });

      if (response.mfaRequired && response.mfaSessionId) {
        navigate(`/mfa?sessionId=${response.mfaSessionId}`);
      } else {
        toast.success('Đăng nhập thành công!');
        // Shell will redirect based on auth state
        window.location.href = '/';
      }
    } catch (err: unknown) {
      const problem = (err as { problemDetail?: Parameters<typeof handleRFC7807Errors>[0] })?.problemDetail;
      if (problem?.errors) {
        handleRFC7807Errors<LoginFormValues>(problem, setError);
      } else {
        toast.error('Đăng nhập thất bại. Vui lòng thử lại.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Email"
        type="email"
        placeholder="you@company.com"
        autoComplete="email"
        error={errors.username?.message}
        {...register('username')}
      />

      <PasswordInput
        label="Mật khẩu"
        placeholder="••••••••"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />

      <div className="flex justify-end">
        <Link
          to="/forgot-password"
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Quên mật khẩu?
        </Link>
      </div>

      <Button type="submit" loading={isPending} fullWidth size="lg">
        Đăng nhập
      </Button>
    </form>
  );
};
