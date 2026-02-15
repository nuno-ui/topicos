import { LoginForm } from './login-form';
import { Sparkles, Search, Brain, Zap, Shield, Globe } from 'lucide-react';

const features = [
  { icon: Search, title: 'Unified Search', desc: 'Search across Gmail, Slack, Notion, Calendar & Drive in one place' },
  { icon: Brain, title: 'AI-Powered', desc: 'Smart topic clustering, daily briefings, and auto-categorization' },
  { icon: Zap, title: 'Topic-Centric', desc: 'Organize everything around topics, not apps or inboxes' },
  { icon: Shield, title: 'Private & Secure', desc: 'Your data stays yours with enterprise-grade security' },
];

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding + features */}
      <div className="hidden lg:flex lg:w-1/2 brand-gradient relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzAtOS45NC04LjA2LTE4LTE4LTE4UzAgOC4wNiAwIDE4czguMDYgMTggMTggMTggMTgtOC4wNiAxOC0xOHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 w-full">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">TopicOS</h1>
                <p className="text-blue-100 text-sm font-medium">Search-First Productivity</p>
              </div>
            </div>
            <p className="text-xl text-white/90 font-medium leading-relaxed max-w-md">
              Your AI-powered command center for everything that matters.
            </p>
          </div>

          <div className="space-y-5 animate-slide-up">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-4 group">
                <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-white/25 transition-colors">
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">{f.title}</h3>
                  <p className="text-blue-100/80 text-sm mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex items-center gap-2 text-blue-100/60 text-xs">
            <Globe className="w-3.5 h-3.5" />
            <span>Integrates with Google Workspace, Slack & Notion</span>
          </div>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 animate-fade-in">
        <div className="max-w-sm w-full">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-extrabold brand-gradient-text">TopicOS</h1>
            </div>
            <p className="text-gray-500 text-sm">Search-first productivity</p>
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 mt-1.5 text-sm">Sign in to your account to continue</p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-xs text-gray-400">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
