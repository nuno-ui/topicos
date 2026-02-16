import { LoginForm } from './login-form';
import { Sparkles, Search, Brain, Zap, Shield, Globe, Users, Star } from 'lucide-react';

const features = [
  { icon: Brain, title: 'AI Companion', desc: 'Your personal AI that handles the grunt work — organizing, connecting, and acting on your behalf', badge: 'Core' },
  { icon: Search, title: 'Unified Life View', desc: 'One place for everything. Gmail, Slack, Notion, Calendar, Drive — all connected', badge: 'Connected' },
  { icon: Zap, title: 'Focus on Being Human', desc: 'While AI manages your digital life, you focus on what truly matters', badge: 'Freedom' },
  { icon: Shield, title: 'Supercharged Productivity', desc: 'Be 10x more productive with zero extra stress', badge: '10x' },
];

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding + features */}
      <div className="hidden lg:flex lg:w-1/2 brand-gradient relative overflow-hidden grain-overlay">
        {/* Background pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzAtOS45NC04LjA2LTE4LTE4LTE4UzAgOC4wNiAwIDE4czguMDYgMTggMTggMTggMTgtOC4wNiAxOC0xOHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />

        {/* Animated floating particles */}
        <div className="login-particle login-particle-1" />
        <div className="login-particle login-particle-2" />
        <div className="login-particle login-particle-3" />
        <div className="login-particle login-particle-4" />
        <div className="login-particle login-particle-5" />
        <div className="login-particle login-particle-6" />
        <div className="login-particle login-particle-7" />
        <div className="login-particle login-particle-8" />

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 w-full">
          {/* Logo + version badge */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-13 h-13 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg shadow-black/10">
                <span className="text-white font-bold text-2xl leading-none">Y</span>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-3xl font-extrabold text-white tracking-tight">YouOS</h1>
                  <span className="px-2 py-0.5 bg-white/15 backdrop-blur-sm text-[10px] font-bold text-white/90 rounded-full uppercase tracking-wider border border-white/10">
                    v1
                  </span>
                </div>
                <p className="text-blue-100 text-sm font-medium">Your AI-Powered Life OS</p>
              </div>
            </div>
            <p className="text-xl text-white/90 font-medium leading-relaxed max-w-md">
              While AI does the hard work, you focus on being human.
            </p>
          </div>

          {/* Features with better visual hierarchy */}
          <div className="space-y-4 animate-slide-up">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-4 group p-3 -ml-3 rounded-xl hover:bg-white/[0.07] transition-colors">
                <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-white/25 group-hover:scale-105 transition-all shadow-sm">
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold text-[15px]">{f.title}</h3>
                    <span className="px-1.5 py-0.5 bg-white/10 text-[9px] font-bold text-white/70 rounded uppercase tracking-wider">
                      {f.badge}
                    </span>
                  </div>
                  <p className="text-blue-100/75 text-sm mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Social proof / testimonial section */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex -space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-300/30 border-2 border-white/20 flex items-center justify-center text-[10px] font-bold text-white/80">JM</div>
                <div className="w-8 h-8 rounded-full bg-purple-300/30 border-2 border-white/20 flex items-center justify-center text-[10px] font-bold text-white/80">SK</div>
                <div className="w-8 h-8 rounded-full bg-pink-300/30 border-2 border-white/20 flex items-center justify-center text-[10px] font-bold text-white/80">AL</div>
                <div className="w-8 h-8 rounded-full bg-emerald-300/30 border-2 border-white/20 flex items-center justify-center text-[10px] font-bold text-white/80">RW</div>
                <div className="w-8 h-8 rounded-full bg-amber-300/30 border-2 border-white/20 flex items-center justify-center text-[10px] font-bold text-white/80">+5</div>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  <Users className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-white font-semibold text-sm">Trusted by 500+ professionals</span>
                </div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 text-amber-300 fill-amber-300" />
                  ))}
                  <span className="text-blue-100/60 text-xs ml-1">4.9/5 average rating</span>
                </div>
              </div>
            </div>
            <p className="text-blue-100/50 text-xs italic leading-relaxed max-w-sm">
              &ldquo;YouOS transformed how I manage my digital life. I spend 60% less time on admin work and can finally focus on what matters.&rdquo;
            </p>
            <p className="text-blue-100/40 text-[11px] mt-1.5 font-medium">
              &mdash; Sarah K., Product Manager at TechCorp
            </p>
          </div>

          <div className="mt-8 flex items-center gap-2 text-blue-100/60 text-xs">
            <Globe className="w-3.5 h-3.5" />
            <span>Integrates with Google Workspace, Slack & Notion</span>
          </div>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 animate-fade-in">
        <div className="max-w-sm w-full">
          {/* Mobile logo - enhanced with more visual impact */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex flex-col items-center gap-3 mb-4">
              <div className="w-16 h-16 brand-gradient rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <span className="text-white font-bold text-3xl leading-none">Y</span>
              </div>
              <div>
                <div className="flex items-center justify-center gap-2">
                  <h1 className="text-3xl font-extrabold brand-gradient-text">YouOS</h1>
                  <span className="px-2 py-0.5 bg-blue-50 text-[10px] font-bold text-blue-600 rounded-full uppercase tracking-wider border border-blue-100">
                    v1
                  </span>
                </div>
                <p className="text-gray-500 text-sm mt-1.5">Your AI-Powered Life OS</p>
              </div>
            </div>
            {/* Mobile social proof */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="flex -space-x-1.5">
                <div className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-blue-600">J</div>
                <div className="w-6 h-6 rounded-full bg-purple-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-purple-600">S</div>
                <div className="w-6 h-6 rounded-full bg-pink-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-pink-600">A</div>
              </div>
              <span className="text-gray-400 text-xs">Trusted by 500+ professionals</span>
            </div>
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
