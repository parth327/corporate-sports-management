import { useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { ApiError, auth, config } from '@/api';
import { DEMO_PASSWORD } from '@/api/mock/constants';
import { ROLE_LABELS } from '@/rbac/matrix';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useMutation } from '@/hooks/useResource';
import {
  Button,
  Card,
  Checkbox,
  ErrorPanel,
  Field,
  Input,
  PageHeader,
} from '@/ui/primitives';
import { BrandLogo } from '@/ui/BrandLogo';
import { ThemeToggle } from '@/ui/ThemeToggle';
import { DURATION, EASE } from '@/lib/motion.js';

/**
 * Forms 2-5: sign in, forgot password, reset password, and the profile screen
 * that carries change-password.
 */

/* ------------------------------------------------------------------ *
 * Shared shell
 * ------------------------------------------------------------------ */

function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-surface px-5 py-10">
      {/* Static brand wash — cheaper than the arena canvas, same family. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(900px 600px at 15% -10%, rgba(199,45,134,0.18), transparent 60%),' +
            'radial-gradient(800px 600px at 90% 10%, rgba(36,117,183,0.16), transparent 60%),' +
            'radial-gradient(700px 600px at 55% 110%, rgba(168,133,0,0.12), transparent 60%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.slow, ease: EASE.luxe }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-7 flex items-center justify-between">
          <Link to="/">
            <BrandLogo alt="Apex Corporate Enterprises" className="h-9 w-auto" />
          </Link>
          <ThemeToggle />
        </div>

        <div className="glass-strong rounded-2xl p-6 shadow-2xl sm:p-8">
          <h1 className="font-display text-2xl leading-tight tracking-tightest text-fg">{title}</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-fg/72">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-5 text-center text-[13.5px] text-fg/68">{footer}</div>}
      </motion.div>
    </main>
  );
}

/* ------------------------------------------------------------------ *
 * Form 2 — Login
 * ------------------------------------------------------------------ */

interface LoginValues {
  userName: string;
  password: string;
  rememberMe: boolean;
}

export function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const form = useForm<LoginValues>({
    defaultValues: { userName: '', password: '', rememberMe: true },
  });
  const { run, saving, error } = useMutation(
    async (values: LoginValues) => signIn(values.userName, values.password, values.rememberMe),
  );

  const from = (location.state as { from?: string } | null)?.from ?? '/console';

  /* Already signed in — redirect declaratively. Calling navigate() during
     render would be a side effect in the render phase. */
  if (user) return <Navigate to={from} replace />;

  const submit = form.handleSubmit(async (values) => {
    try {
      const account = await run(values);
      toast.success(`Welcome back, ${account.displayName.split(' ')[0]}`);
      navigate(from, { replace: true });
    } catch (cause) {
      if (cause instanceof ApiError) {
        for (const [field, message] of Object.entries(cause.fieldErrors)) {
          if (field === 'userName' || field === 'password') {
            form.setError(field, { type: 'server', message });
          }
        }
      }
    }
  });

  const fillDemo = (userName: string) => {
    form.setValue('userName', userName);
    form.setValue('password', DEMO_PASSWORD);
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="The Corporate Sports Events Management console. Access is scoped to your role and assigned sub-group."
      footer={
        <>
          Taking part rather than running it? You are already on the register —{' '}
          <Link to="/" className="text-accent-solar underline-offset-2 hover:underline">
            see the season
          </Link>
          .
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && !Object.keys(error.fieldErrors).length && <ErrorPanel message={error.message} />}

        <Field label="Username or email" htmlFor="userName" required error={form.formState.errors.userName?.message}>
          <Input
            id="userName"
            autoComplete="username"
            autoFocus
            invalid={Boolean(form.formState.errors.userName)}
            placeholder="admin"
            {...form.register('userName', { required: 'Enter your username.' })}
          />
        </Field>

        <Field label="Password" htmlFor="password" required error={form.formState.errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            invalid={Boolean(form.formState.errors.password)}
            placeholder="••••••••"
            {...form.register('password', { required: 'Enter your password.' })}
          />
        </Field>

        <Checkbox
          label="Keep me signed in on this device"
          description="Leave off on a shared computer — the session then ends with the tab."
          {...form.register('rememberMe')}
        />

        <Button type="submit" variant="solar" loading={saving} className="w-full">
          Sign in
        </Button>

        <p className="text-center text-[13px]">
          <Link to="/forgot-password" className="text-fg/68 underline-offset-2 hover:text-fg hover:underline">
            Forgotten your password?
          </Link>
        </p>
      </form>

      {config.useMockApi && (
        <div className="mt-6 rounded-xl border border-solar-600/30 bg-solar-600/[0.07] p-4">
          <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.1em] text-accent-solar">
            Demo accounts
          </p>
          <p className="mb-3 text-[12.5px] leading-relaxed text-fg/72">
            Running on seeded data. Password for every account is{' '}
            <code className="rounded bg-fg/12 px-1.5 py-0.5 font-mono text-[12px] text-fg/90">
              {DEMO_PASSWORD}
            </code>
            .
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { user: 'admin', label: 'Main Admin' },
              { user: 'cricket', label: 'Management · Cricket' },
              { user: 'football', label: 'Management · Football' },
              { user: 'events', label: 'Event Mgmt · Cricket' },
            ].map((account) => (
              <button
                key={account.user}
                type="button"
                onClick={() => fillDemo(account.user)}
                className="rounded-full border border-fg/22 px-3 py-1.5 text-[12.5px] text-fg/82 transition-colors hover:border-solar-400 hover:text-fg"
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}

/* ------------------------------------------------------------------ *
 * Form 3 — Forgot password
 * ------------------------------------------------------------------ */

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const form = useForm<{ email: string }>({ defaultValues: { email: '' } });
  const { run, saving, error } = useMutation(async (email: string) => auth.forgotPassword(email));

  const submit = form.handleSubmit(async ({ email }) => {
    try {
      await run(email);
      setSent(true);
    } catch {
      /* Surfaced by `error` below. */
    }
  });

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle="If that address belongs to an account, a reset link is on its way. The link expires in 30 minutes."
        footer={
          <Link to="/login" className="text-accent-solar underline-offset-2 hover:underline">
            ← Back to sign in
          </Link>
        }
      >
        <div className="rounded-xl border border-phthalo-500/30 bg-phthalo-500/[0.07] p-4 text-[13.5px] leading-relaxed text-fg/78">
          We do not confirm whether an address is registered — that would let anyone test which
          colleagues have accounts.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email address or username on your account and we will send a reset link."
      footer={
        <Link to="/login" className="text-accent-solar underline-offset-2 hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <ErrorPanel message={error.message} />}

        <Field label="Email or username" htmlFor="email" required error={form.formState.errors.email?.message}>
          <Input
            id="email"
            autoFocus
            autoComplete="email"
            invalid={Boolean(form.formState.errors.email)}
            placeholder="you@example.com"
            {...form.register('email', { required: 'Enter your email address or username.' })}
          />
        </Field>

        <Button type="submit" variant="solar" loading={saving} className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}

/* ------------------------------------------------------------------ *
 * Form 4 — Reset password
 * ------------------------------------------------------------------ */

interface ResetValues {
  newPassword: string;
  confirmPassword: string;
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const toast = useToast();

  const form = useForm<ResetValues>({ defaultValues: { newPassword: '', confirmPassword: '' } });
  const { run, saving, error } = useMutation(async (password: string) =>
    auth.resetPassword(token, password),
  );

  const submit = form.handleSubmit(async ({ newPassword }) => {
    try {
      await run(newPassword);
      toast.success('Password changed', 'You can now sign in with your new password.');
      navigate('/login', { replace: true });
    } catch {
      /* Surfaced by `error`. */
    }
  });

  if (!token) {
    return (
      <AuthShell
        title="Link is incomplete"
        subtitle="This page needs a reset token. Open the link exactly as it appears in your email."
        footer={
          <Link to="/forgot-password" className="text-accent-solar underline-offset-2 hover:underline">
            Request a new link
          </Link>
        }
      >
        <ErrorPanel message="No reset token was found in the address bar." />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you have not used on this system before.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <ErrorPanel message={error.message} />}

        <Field
          label="New password"
          htmlFor="newPassword"
          required
          hint="At least 8 characters"
          error={form.formState.errors.newPassword?.message}
        >
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            autoFocus
            invalid={Boolean(form.formState.errors.newPassword)}
            {...form.register('newPassword', {
              required: 'Enter a new password.',
              minLength: { value: 8, message: 'Use at least 8 characters.' },
            })}
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirmPassword"
          required
          error={form.formState.errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(form.formState.errors.confirmPassword)}
            {...form.register('confirmPassword', {
              required: 'Repeat the new password.',
              validate: (value) => value === form.getValues('newPassword') || 'The two passwords do not match.',
            })}
          />
        </Field>

        <Button type="submit" variant="solar" loading={saving} className="w-full">
          Set new password
        </Button>
      </form>
    </AuthShell>
  );
}

/* ------------------------------------------------------------------ *
 * Form 5 — My profile + change password
 * ------------------------------------------------------------------ */

interface ProfileValues {
  displayName: string;
  email: string;
}

interface PasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();

  const profileForm = useForm<ProfileValues>({
    defaultValues: { displayName: user?.displayName ?? '', email: user?.email ?? '' },
  });
  const passwordForm = useForm<PasswordValues>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const profileMutation = useMutation(async (values: ProfileValues) => auth.updateProfile(values));
  const passwordMutation = useMutation(async (values: PasswordValues) =>
    auth.changePassword(values.currentPassword, values.newPassword),
  );

  if (!user) return null;

  const saveProfile = profileForm.handleSubmit(async (values) => {
    try {
      const updated = await profileMutation.run(values);
      setUser(updated);
      toast.success('Profile updated');
    } catch {
      /* Surfaced by the panel. */
    }
  });

  const savePassword = passwordForm.handleSubmit(async (values) => {
    try {
      await passwordMutation.run(values);
      toast.success('Password changed', 'Use the new password next time you sign in.');
      passwordForm.reset();
    } catch (cause) {
      if (cause instanceof ApiError) {
        for (const [field, message] of Object.entries(cause.fieldErrors)) {
          if (field === 'currentPassword') {
            passwordForm.setError('currentPassword', { type: 'server', message });
          }
        }
      }
    }
  });

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="My profile"
        description="Your display name, contact address and password. Your role and sub-group scope are set by the Main Administrator."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Profile details">
          <form onSubmit={saveProfile} noValidate className="space-y-4">
            {profileMutation.error && <ErrorPanel message={profileMutation.error.message} />}

            <Field label="Display name" htmlFor="displayName" required error={profileForm.formState.errors.displayName?.message}>
              <Input
                id="displayName"
                invalid={Boolean(profileForm.formState.errors.displayName)}
                {...profileForm.register('displayName', { required: 'Enter your name.' })}
              />
            </Field>

            <Field label="Email" htmlFor="profile-email" required error={profileForm.formState.errors.email?.message}>
              <Input
                id="profile-email"
                type="email"
                invalid={Boolean(profileForm.formState.errors.email)}
                {...profileForm.register('email', {
                  required: 'Enter your email address.',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: 'Enter a valid email address.' },
                })}
              />
            </Field>

            <dl className="grid grid-cols-2 gap-4 rounded-xl border border-fg/14 bg-fg/[0.04] p-4">
              <div>
                <dt className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-fg/58">Username</dt>
                <dd className="mt-1 font-mono text-[13.5px] text-fg/88">{user.userName}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-fg/58">Role</dt>
                <dd className="mt-1 text-[13.5px] text-fg/88">{ROLE_LABELS[user.role]}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-fg/58">Scope</dt>
                <dd className="mt-1 text-[13.5px] text-fg/88">
                  {user.subGroupName ?? 'All groups and sub-groups'}
                </dd>
              </div>
            </dl>

            <Button type="submit" variant="solar" size="sm" loading={profileMutation.saving}>
              Save profile
            </Button>
          </form>
        </Card>

        <Card title="Change password">
          <form onSubmit={savePassword} noValidate className="space-y-4">
            {passwordMutation.error && !Object.keys(passwordMutation.error.fieldErrors).length && (
              <ErrorPanel message={passwordMutation.error.message} />
            )}

            <Field
              label="Current password"
              htmlFor="currentPassword"
              required
              error={passwordForm.formState.errors.currentPassword?.message}
            >
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                invalid={Boolean(passwordForm.formState.errors.currentPassword)}
                {...passwordForm.register('currentPassword', { required: 'Enter your current password.' })}
              />
            </Field>

            <Field
              label="New password"
              htmlFor="new-password"
              required
              hint="At least 8 characters"
              error={passwordForm.formState.errors.newPassword?.message}
            >
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                invalid={Boolean(passwordForm.formState.errors.newPassword)}
                {...passwordForm.register('newPassword', {
                  required: 'Enter a new password.',
                  minLength: { value: 8, message: 'Use at least 8 characters.' },
                })}
              />
            </Field>

            <Field
              label="Confirm new password"
              htmlFor="confirm-password"
              required
              error={passwordForm.formState.errors.confirmPassword?.message}
            >
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                invalid={Boolean(passwordForm.formState.errors.confirmPassword)}
                {...passwordForm.register('confirmPassword', {
                  required: 'Repeat the new password.',
                  validate: (value) =>
                    value === passwordForm.getValues('newPassword') || 'The two passwords do not match.',
                })}
              />
            </Field>

            <Button type="submit" variant="solar" size="sm" loading={passwordMutation.saving}>
              Change password
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
