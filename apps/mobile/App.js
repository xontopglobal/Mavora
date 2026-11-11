import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './src/lib/supabase';
import SocialExperience from './src/SocialExperience';

const tabs = ['Home', 'Groups', 'Messages', 'Marketplace', 'Profile'];
export default function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('Home');
  const [mode, setMode] = useState('Sign in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function authenticate() {
    if (!supabase) return Alert.alert('Setup required', 'Add Supabase settings to apps/mobile/.env and restart Expo.');
    if (mode === 'Sign up' && !ageConfirmed) return Alert.alert('Age confirmation required', 'Mavora is for adults 18 and older. Confirm your eligibility to continue.');
    setBusy(true);
    try {
      const result = mode === 'Sign up'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === 'Sign up') Alert.alert('Check your email', 'Confirm your email if confirmation is enabled in Supabase.');
    } catch (e) { Alert.alert('Authentication error', e.message); }
    finally { setBusy(false); }
  }

  async function requestPhoneOtp() {
    if (!supabase || !phone) return Alert.alert('Phone verification', 'Configure Supabase and enter a phone number in international E.164 format.');
    const { error } = await supabase.auth.signInWithOtp({ phone });
    Alert.alert(error ? 'Could not send OTP' : 'OTP requested', error?.message || 'OTP verification screen must be completed before phone login is ready.');
  }

  async function recover() {
    if (!supabase || !email) return Alert.alert('Enter email', 'Enter your account email first.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'mavora://reset-password' });
    Alert.alert(error ? 'Reset failed' : 'Check your email', error?.message || 'If the account exists, a reset link will be sent. Configure this redirect in Supabase.');
  }

  async function googleScaffold() {
    if (!supabase) return Alert.alert('Setup required', 'Configure Supabase first.');
    Alert.alert('Google sign-in setup', 'Enable Google in Supabase Auth and configure Expo AuthSession/deep links and provider redirect URLs. The complete native OAuth callback flow is not yet implemented.');
  }

  if (!session && !preview) return <SafeAreaView style={s.page}><StatusBar style="light"/><ScrollView contentContainerStyle={s.auth}>
    <Text style={s.logo}>MAVORA</Text><Text style={s.tagline}>Connect. Share. Discover. Grow.</Text>
    <Text style={s.title}>{mode} to Mavora</Text>
    <TextInput style={s.input} placeholder="Email address" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail}/>
    <TextInput style={s.input} placeholder="Password (minimum 8 characters recommended)" secureTextEntry value={password} onChangeText={setPassword}/>
    <Pressable style={s.primary} onPress={authenticate} disabled={busy}><Text style={s.primaryText}>{busy ? 'Please wait…' : mode}</Text></Pressable>
    <Pressable onPress={recover}><Text style={s.link}>Forgot password?</Text></Pressable>
    <Pressable style={s.outline} onPress={googleScaffold}><Text style={s.outlineText}>Continue with Google (setup required)</Text></Pressable>
    <View style={s.line}/>
    <TextInput style={s.input} placeholder="Phone e.g. +2348012345678" keyboardType="phone-pad" value={phone} onChangeText={setPhone}/>
    <Pressable style={s.outline} onPress={requestPhoneOtp}><Text style={s.outlineText}>Request phone OTP (foundation)</Text></Pressable>
    {mode === 'Sign up' && <Pressable style={s.ageRow} onPress={() => setAgeConfirmed(!ageConfirmed)}><View style={[s.ageCheck, ageConfirmed && s.ageCheckOn]}><Text style={s.ageCheckMark}>{ageConfirmed ? '✓' : ''}</Text></View><Text style={s.ageText}>I confirm I am 18 or older and accept the Terms and Privacy Policy.</Text></Pressable>}
    <Pressable onPress={() => { setMode(mode === 'Sign in' ? 'Sign up' : 'Sign in'); setAgeConfirmed(false); }}><Text style={s.link}>{mode === 'Sign in' ? 'Create an account' : 'Already have an account? Sign in'}</Text></Pressable>
    <Pressable style={s.preview} onPress={() => setPreview(true)}><Text style={s.previewText}>Explore Mavora preview  ↗</Text></Pressable>
    <Text style={s.hint}>This is the authentication foundation. Complete OTP verification, Google OAuth callback and password update before launch.</Text>
  </ScrollView></SafeAreaView>;

  return <SocialExperience
    preview={preview}
    accessToken={session?.access_token}
    onExit={preview ? () => setPreview(false) : () => supabase.auth.signOut()}
  />;
}
const s = StyleSheet.create({
 page:{flex:1,backgroundColor:'#f5f7fc'},auth:{padding:26,paddingTop:54},content:{padding:22},
 logo:{fontSize:34,fontWeight:'900',letterSpacing:4,color:'#243b72'},logoSmall:{fontSize:22,fontWeight:'900',letterSpacing:3,color:'#243b72'},
 tagline:{color:'#65708a',marginTop:6,marginBottom:42},title:{fontSize:25,fontWeight:'800',color:'#18233d',marginBottom:18},
 input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#dce2ee',padding:15,borderRadius:12,marginBottom:12},
 primary:{backgroundColor:'#243b72',padding:16,borderRadius:12,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'800'},
 outline:{borderWidth:1,borderColor:'#243b72',padding:14,borderRadius:12,alignItems:'center',marginTop:8},outlineText:{color:'#243b72',fontWeight:'700'},
 link:{color:'#3157a4',textAlign:'center',padding:14,fontWeight:'700'},line:{height:1,backgroundColor:'#dce2ee',marginVertical:18},
 hint:{fontSize:12,color:'#788196',lineHeight:18,marginTop:20},header:{paddingHorizontal:20,paddingVertical:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 panel:{backgroundColor:'#fff',padding:20,borderRadius:16,borderWidth:1,borderColor:'#e1e6f0'},panelTitle:{fontSize:18,fontWeight:'800',color:'#243b72',marginBottom:8},body:{fontSize:15,color:'#59647a',lineHeight:23},
 nav:{flexDirection:'row',justifyContent:'space-around',paddingVertical:13,backgroundColor:'#fff',borderTopWidth:1,borderTopColor:'#e2e6ef'},navItem:{paddingHorizontal:3},navText:{fontSize:11,color:'#778096'},navActive:{color:'#243b72',fontWeight:'900'},preview:{borderWidth:1,borderColor:'#5be3cf66',backgroundColor:'#5be3cf0c',padding:13,borderRadius:8,alignItems:'center',marginTop:8},previewText:{color:'#54cbb9',fontWeight:'700'},ageRow:{flexDirection:'row',alignItems:'flex-start',gap:9,marginTop:8,padding:5},ageCheck:{width:19,height:19,borderWidth:1,borderColor:'#63718a',borderRadius:3,alignItems:'center',justifyContent:'center'},ageCheckOn:{backgroundColor:'#5be3cf',borderColor:'#5be3cf'},ageCheckMark:{color:'#0a101c',fontWeight:'800',fontSize:12},ageText:{color:'#abb6c8',fontSize:11,lineHeight:17,flex:1},
 page:{flex:1,backgroundColor:'#0a101c'},auth:{padding:26,paddingTop:54,flexGrow:1,justifyContent:'center',backgroundColor:'#0a101c'},logo:{fontSize:34,fontWeight:'900',letterSpacing:4,color:'#eff3fc'},logoSmall:{fontSize:22,fontWeight:'900',letterSpacing:3,color:'#eff3fc'},tagline:{color:'#9ba8ba',marginTop:6,marginBottom:42},title:{fontSize:25,fontWeight:'800',color:'#eff3fc',marginBottom:18},input:{backgroundColor:'#111b2b',borderWidth:1,borderColor:'#293448',color:'#eff3fc',padding:15,borderRadius:6,marginBottom:12},primary:{backgroundColor:'#b69cff',padding:16,borderRadius:6,alignItems:'center'},primaryText:{color:'#151425',fontWeight:'800'},outline:{borderWidth:1,borderColor:'#b69cff',padding:14,borderRadius:6,alignItems:'center',marginTop:8},outlineText:{color:'#d2c4ff',fontWeight:'700'},link:{color:'#b69cff',textAlign:'center',padding:14,fontWeight:'700'},line:{height:1,backgroundColor:'#293448',marginVertical:18},hint:{fontSize:11,color:'#78869b',lineHeight:17,marginTop:20}
});
