import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface LoginForm {
  username: string;
  password: string;
}

/**
 * react-hook-form keeps inputs uncontrolled (no re-render per keystroke) and gives declarative
 * validation — the React counterpart of Angular's reactive forms for this use case.
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ defaultValues: { username: '', password: '' } });

  const onSubmit = async ({ username, password }: LoginForm) => {
    setError(null);
    try {
      await login(username, password);
      const returnUrl = (location.state as { from?: string } | null)?.from ?? '/dashboard';
      navigate(returnUrl, { replace: true });
    } catch {
      setError('Login failed — is the API running on :5080?');
    }
  };

  return (
    <div className="login-wrap">
      <form className="panel card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="brand">
          <div className="logo">⬢</div>
          <div>
            <h1>
              ShipTrack <span>Ops</span>
            </h1>
            <p>Realtime logistics control tower</p>
          </div>
        </div>

        <label htmlFor="username">Operator</label>
        <input
          id="username"
          type="text"
          placeholder="e.g. ops-lead"
          autoComplete="username"
          className={errors.username ? 'invalid' : ''}
          {...register('username', { required: true, minLength: 2 })}
        />
        {errors.username && <span className="hint">Username is required (min 2 chars).</span>}

        <label htmlFor="password">Passphrase</label>
        <input
          id="password"
          type="password"
          placeholder="any passphrase (demo)"
          autoComplete="current-password"
          className={errors.password ? 'invalid' : ''}
          {...register('password', { required: true, minLength: 3 })}
        />
        {errors.password && <span className="hint">Password is required (min 3 chars).</span>}

        {error && <div className="error">{error}</div>}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Enter control tower'}
        </button>

        <p className="note">Demo auth — any non-empty credentials are accepted.</p>
      </form>
    </div>
  );
}
