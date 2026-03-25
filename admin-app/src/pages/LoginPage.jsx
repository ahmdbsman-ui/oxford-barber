import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

export default function LoginPage({
  authError,
  isAuthenticatedAdmin,
  login,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticatedAdmin) {
    return <Navigate replace to="/" />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    const result = await login(email, password);

    setSubmitting(false);

    if (result.ok) {
      navigate(location.state?.from?.pathname || '/', { replace: true });
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="panel-kicker">Owner Access</div>
        <h1 className="login-title">Oxford Barber Admin</h1>
        <p className="login-copy">
          Sign in with an approved owner email to access live bookings,
          history, and business stats.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label" htmlFor="admin-email">
            Admin Email
          </label>
          <input
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            className="login-input"
            id="admin-email"
            inputMode="email"
            onChange={(event) =>
              setEmail(event.target.value.replace(/\s+/g, ''))
            }
            placeholder="owner@email.com"
            spellCheck={false}
            type="email"
            value={email}
          />

          <label className="login-label" htmlFor="admin-password">
            Password
          </label>
          <input
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            className="login-input"
            id="admin-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            spellCheck={false}
            type="password"
            value={password}
          />

          {authError ? <div className="message error">{authError}</div> : null}

          <button className="login-button" disabled={submitting} type="submit">
            {submitting ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
