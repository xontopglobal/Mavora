
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './lib/supabase';
import SocialShell from './SocialShell';
import './style.css';

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('Sign in');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [tab, setTab] = useState('Home');
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState(
    'Connect. Share. Discover. Grow.'
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setMessage(
        'Supabase is not configured. Check apps/web/.env.'
      );
      return;
    }

    let mounted = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setMessage(error.message);
        return;
      }

      setSession(data.session);
    }

    loadSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(e) {
    e.preventDefault();

    if (loading) return;

    if (!supabase) {
      setMessage('Supabase connection is unavailable.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setMessage('Please enter your email and password.');
      return;
    }

    if (password.length < 6) {
      setMessage('Your password must contain at least 6 characters.');
      return;
    }

    if (mode === 'Sign up' && !ageConfirmed) {
      setMessage('Mavora is for adults 18 and older. Confirm your eligibility to continue.');
      return;
    }

    setLoading(true);
    setMessage(
      mode === 'Sign up'
        ? 'Creating your Mavora account...'
        : 'Signing you in...'
    );

    try {
      if (mode === 'Sign up') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password
        });

        if (error) throw error;

        if (data.session) {
          setSession(data.session);
          setMessage('Your Mavora account has been created.');
        } else {
          setMessage(
            'Registration successful! Please check your email and confirm your account before signing in.'
          );
        }
      } else {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password
          });

        if (error) throw error;

        setSession(data.session);
        setMessage('Welcome back to Mavora!');
      }
    } catch (error) {
      console.error('Authentication error:', error);

      if (error.message?.toLowerCase().includes('invalid login')) {
        setMessage(
          'Invalid email or password. Check your details or create an account.'
        );
      } else if (
        error.message?.toLowerCase().includes('already registered')
      ) {
        setMessage(
          'This email already has an account. Please sign in instead.'
        );
      } else {
        setMessage(error.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    if (loading) return;

    if (!supabase) {
      setMessage('Supabase connection is unavailable.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setMessage('Enter your email address first.');
      return;
    }

    setLoading(true);
    setMessage('Sending password recovery email...');

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin + '/reset-password'
        });

      if (error) throw error;

      setMessage(
        'If this email belongs to an account, a password recovery link has been sent.'
      );
    } catch (error) {
      setMessage(error.message || 'Could not send recovery email.');
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (!supabase) return;

    setLoading(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      setSession(null);
      setPassword('');
      setMessage('You have signed out successfully.');
    } catch (error) {
      setMessage(error.message || 'Could not sign out.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode((current) =>
      current === 'Sign in' ? 'Sign up' : 'Sign in'
    );
    setMessage('Enter your details to continue.');
    setPassword('');
    setAgeConfirmed(false);
  }

  if (!session && !preview) {
    return (
      <main className="auth">
        <section className="card">
          <div className="brand">MAVORA</div>

          <p className="muted">
            Connect. Share. Discover. Grow.
          </p>

          <h1>{mode} to Mavora</h1>

          <form onSubmit={submit}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === 'Sign up'
                  ? 'new-password'
                  : 'current-password'
              }
              minLength={6}
              required
            />

            {mode === 'Sign up' && (
              <label className="age-confirmation">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(event) => setAgeConfirmed(event.target.checked)}
                />
                <span>I confirm I am 18 or older and accept the Terms and Privacy Policy.</span>
              </label>
            )}

            <button type="submit" disabled={loading}>
              {loading ? 'Please wait...' : mode}
            </button>
          </form>

          <button
            type="button"
            className="text-button"
            onClick={reset}
            disabled={loading}
          >
            Forgot password?
          </button>

          <button
            type="button"
            className="text-button"
            onClick={switchMode}
            disabled={loading}
          >
            {mode === 'Sign in'
              ? 'Create an account'
              : 'Already registered? Sign in'}
          </button>

          <button
            type="button"
            className="preview-link"
            onClick={() => setPreview(true)}
          >
            Explore Mavora preview <span>↗</span>
          </button>

          <p className="status" role="status" aria-live="polite">
            {message}
          </p>

          <p className="small">
            Mavora account authentication.
          </p>
        </section>
      </main>
    );
  }

  return (
    <SocialShell
      preview={preview}
      accessToken={session?.access_token}
      onExit={preview ? () => setPreview(false) : signOut}
    />
  );
}

createRoot(document.getElementById('root')).render(<App />);
