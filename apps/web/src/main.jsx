
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, supabaseConfigStatus } from './lib/supabase';
import './style.css';
import SocialShell from './SocialShell';

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [authMethod, setAuthMethod] = useState('email');
  const [otpCode, setOtpCode] = useState('');
  const [otpPending, setOtpPending] = useState(false);
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('Sign in');
  const [message, setMessage] = useState(
    'Connect. Share. Discover. Grow.'
  );
  const [loading, setLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (!supabase) {
      const reasons = [];
      if (!supabaseConfigStatus.urlConfigured) reasons.push('Supabase URL is missing');
      if (!supabaseConfigStatus.keyConfigured) reasons.push('Supabase public/anon key is missing');
      if (supabaseConfigStatus.urlConfigured && !supabaseConfigStatus.urlValid) reasons.push('Supabase URL must look like https://your-project.supabase.co');
      setMessage(`Supabase connection is unavailable. ${reasons.join('. ') || 'Check apps/web/.env and restart Vite.'}.`);
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
        if (_event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
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
    const cleanPhone = phone.trim();

    if (authMethod === 'email' && !cleanEmail) { setMessage('Please enter your email address.'); return; }
    if (authMethod === 'phone' && !/^\+[1-9]\d{7,14}$/.test(cleanPhone)) { setMessage('Enter a phone number in international E.164 format, e.g. +2348012345678.'); return; }
    if (!password) { setMessage('Please enter your password.'); return; }

    if (password.length < 8) {
      setMessage('Your password must contain at least 8 characters.');
      return;
    }

    setLoading(true);
    setMessage(
      mode === 'Sign up'
        ? 'Creating your Ofsocio account...'
        : 'Signing you in...'
    );

    try {
      if (mode === 'Sign up') {
        const result = authMethod === 'phone'
          ? await supabase.auth.signUp({ phone: cleanPhone, password, options: { data: { display_name: cleanPhone } } })
          : await supabase.auth.signUp({ email: cleanEmail, password, options: { data: { display_name: cleanEmail.split('@')[0] } } });
        if (result.error) throw result.error;
        if (result.data.session) { setSession(result.data.session); setMessage('Your Ofsocio account has been created.'); }
        else if (authMethod === 'phone') { setOtpPending(true); setMessage('Phone registration started. Enter the SMS verification code below.'); }
        else { setMessage('Registration successful! Please check your email and confirm your account before signing in.'); }
      } else {
        const result = authMethod === 'phone'
          ? await supabase.auth.signInWithPassword({ phone: cleanPhone, password })
          : await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (result.error) throw result.error;
        setSession(result.data.session); setMessage('Welcome back to Ofsocio!');
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

  async function requestPhoneOtp() {
    if (!supabase || !/^\+[1-9]\d{7,14}$/.test(phone.trim())) { setMessage('Enter a phone number in international E.164 format.'); return; }
    setLoading(true);
    try { const { error }=await supabase.auth.signInWithOtp({phone:phone.trim()}); if(error)throw error; setOtpPending(true); setMessage('SMS code sent. Enter it below to verify your phone.'); }
    catch(error){setMessage(error.message||'Could not send SMS code.');}
    finally{setLoading(false);}
  }

  async function verifyPhoneOtp() {
    if (!supabase || !otpCode.trim()) { setMessage('Enter the SMS verification code.'); return; }
    setLoading(true);
    try { const {data,error}=await supabase.auth.verifyOtp({phone:phone.trim(),token:otpCode.trim(),type:'sms'}); if(error)throw error; setSession(data.session);setOtpPending(false);setOtpCode('');setMessage('Phone verified. Welcome to Ofsocio!'); }
    catch(error){setMessage(error.message||'Phone verification failed.');}
    finally{setLoading(false);}
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

  async function updateRecoveredPassword(e) {
    e.preventDefault();
    if (newPassword.length < 8) { setMessage('Choose a password with at least 8 characters.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setRecoveryMode(false); setNewPassword(''); setMessage('Password updated. You can continue using Ofsocio.');
    } catch (error) { setMessage(error.message || 'Could not update password.'); }
    finally { setLoading(false); }
  }

  async function googleSignIn() {
    if (!supabase) { setMessage('Supabase connection is unavailable.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (error) throw error;
    } catch (error) { setMessage(error.message || 'Google sign-in could not start.'); setLoading(false); }
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
  }

  if (recoveryMode) {
    return <main className="auth"><section className="card"><div className="brand">OFSOCIO</div><h1>Choose a new password</h1><form onSubmit={updateRecoveredPassword}><input type="password" placeholder="New password (8 characters minimum)" value={newPassword} onChange={e=>setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" required/><button type="submit" disabled={loading}>{loading?'Updating…':'Update password'}</button></form><p className="status" role="status">{message}</p></section></main>;
  }

  if (!session) {
    return (
      <main className="auth">
        <section className="card">
          <div className="brand">OFSOCIO</div>

          <p className="muted">
            Connect. Share. Discover. Grow.
          </p>

          <h1>{mode} to Ofsocio</h1>

          <form onSubmit={submit}>
            <div className="auth-method-toggle"><button type="button" className={authMethod==='email'?'active':''} onClick={()=>setAuthMethod('email')}>Email</button><button type="button" className={authMethod==='phone'?'active':''} onClick={()=>setAuthMethod('phone')}>Phone</button></div>
            {authMethod==='email'?<input type="email" placeholder="Email address" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" required/>:<input type="tel" placeholder="Phone e.g. +2348012345678" value={phone} onChange={(e)=>setPhone(e.target.value)} autoComplete="tel" required/>}

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
              minLength={8}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Please wait...' : mode}
            </button>
          </form>
          {authMethod==='phone'&&<button type="button" className="text-button" onClick={requestPhoneOtp} disabled={loading}>Sign in / verify with SMS code</button>}
          {authMethod==='phone'&&otpPending&&<div className="otp-panel"><input inputMode="numeric" placeholder="SMS verification code" value={otpCode} onChange={e=>setOtpCode(e.target.value)} required/><button type="button" onClick={verifyPhoneOtp} disabled={loading}>{loading?'Verifying…':'Verify phone'}</button></div>}

          {authMethod==='email'&&<button type="button" className="text-button" onClick={reset} disabled={loading}>Forgot password?</button>}

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
          <button type="button" className="text-button" onClick={googleSignIn} disabled={loading}>Continue with Google</button>

          <p className="status" role="status" aria-live="polite">
            {message}
          </p>

          <p className="small">
            Ofsocio account authentication.
          </p>
        </section>
      </main>
    );
  }

  return (
    <SocialShell
      supabase={supabase}
      currentUser={session.user}
      accessToken={session.access_token}
      onExit={signOut}
      exitLabel="Sign out"
    />
  );
}

createRoot(document.getElementById('root')).render(<App />);
