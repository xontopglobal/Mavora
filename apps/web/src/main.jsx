import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './lib/supabase';
import './style.css';

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('Sign in');
  const [tab, setTab] = useState('Home');
  const [message, setMessage] = useState('Connect. Share. Discover. Grow.');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data} = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!supabase) return setMessage('Configure Supabase in apps/web/.env, then restart Vite.');
    const result = mode === 'Sign up'
      ? await supabase.auth.signUp({email, password})
      : await supabase.auth.signInWithPassword({email, password});
    setMessage(result.error?.message || (mode === 'Sign up' ? 'Check your email for confirmation.' : 'Signed in.'));
  }
  async function reset() {
    if (!supabase || !email) return setMessage('Enter your email and configure Supabase first.');
    const {error} = await supabase.auth.resetPasswordForEmail(email, {redirectTo: window.location.origin + '/reset-password'});
    setMessage(error?.message || 'If the account exists, a reset email has been sent.');
  }
  if (!session) return <main className="auth"><section className="card"><div className="brand">MAVORA</div><p className="muted">Connect. Share. Discover. Grow.</p><h1>{mode} to Mavora</h1><form onSubmit={submit}><input type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/><button>{mode}</button></form><button className="text-button" onClick={reset}>Forgot password?</button><button className="text-button" onClick={()=>setMode(mode==='Sign in'?'Sign up':'Sign in')}>{mode==='Sign in'?'Create an account':'Already registered? Sign in'}</button><p className="status">{message}</p><p className="small">Email authentication foundation. Phone OTP, Google OAuth callback and full account recovery flow require further configuration.</p></section></main>;
  const tabs = ['Home','Groups','Messages','Marketplace','Profile'];
  return <main className="app"><header><div className="brand">MAVORA</div><button className="secondary" onClick={()=>supabase.auth.signOut()}>Sign out</button></header><nav>{tabs.map(t=><button className={tab===t?'selected':''} onClick={()=>setTab(t)} key={t}>{t}</button>)}</nav><section className="welcome"><h1>{tab}</h1><p>Your {tab.toLowerCase()} experience will be developed here and connected to Mavora's API and database.</p><p className="small">Current web build: responsive application shell and authenticated session foundation. Core social and marketplace workflows remain to be implemented.</p></section></main>;
}
createRoot(document.getElementById('root')).render(<App/>);
