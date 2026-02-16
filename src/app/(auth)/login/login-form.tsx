'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');
    setMessage('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: window.location.origin + '/dashboard' },
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
    } else {
      setStatus('success');
      setMessage('Check your email for the login link!');
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard',
          scopes: 'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.readonly',
        },
      });
      if (error) {
        setStatus('error');
        setMessage(error.message);
      }
    } catch {
      setStatus('error');
      setMessage('Failed to start Google sign-in. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Google OAuth - primary CTA */}
      <button onClick={handleGoogleLogin}
        className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all flex items-center justify-center gap-3 text-sm group hover-lift">
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-gray-50 text-gray-400 uppercase tracking-wider font-medium">or use email</span>
        </div>
      </div>

      {/* Magic link form */}
      <form onSubmit={handleLogin} className="space-y-3">
        <div className="relative">
          <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com" required
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-3 brand-gradient text-white rounded-xl font-semibold text-sm hover:opacity-90 hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? 'Sending link...' : 'Send Magic Link'}
        </button>
      </form>

      {/* Status message */}
      {message && (
        <div className={`flex items-center gap-2.5 p-3.5 rounded-xl text-sm animate-fade-in ${
          status === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          status === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
          'bg-gray-50 text-gray-600'
        }`}>
          {status === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> :
           status === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : null}
          {message}
        </div>
      )}
    </div>
  );
}
