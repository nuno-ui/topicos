'use client';

import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (!main) return;

    const handleScroll = () => {
      setVisible(main.scrollTop > 400);
    };

    main.addEventListener('scroll', handleScroll, { passive: true });
    return () => main.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    const main = document.getElementById('main-content');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-20 right-6 z-30 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-lg hover:shadow-xl flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all animate-float-up"
      aria-label="Back to top"
      title="Back to top"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}
