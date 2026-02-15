import React from 'react';

export function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-gray-800 mt-2 mb-0.5 text-sm">{line.replace('### ', '')}</h4>;
    if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-gray-900 mt-3 mb-1 text-sm">{line.replace('## ', '')}</h3>;
    if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-gray-900 mt-2 mb-1 text-base">{line.replace('# ', '')}</h2>;
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.slice(2);
      return <li key={i} className="ml-4 text-sm text-gray-700 mt-0.5 list-disc">{renderInline(content)}</li>;
    }
    if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, '');
      return <li key={i} className="ml-4 text-sm text-gray-700 mt-0.5 list-decimal">{renderInline(content)}</li>;
    }
    if (line.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-gray-300 pl-3 text-sm text-gray-600 italic mt-1">{line.slice(2)}</blockquote>;
    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-gray-800 mt-2 text-sm">{line.replace(/\*\*/g, '')}</p>;
    if (line.trim() === '') return <br key={i} />;
    return <p key={i} className="text-sm text-gray-700 mt-1">{renderInline(line)}</p>;
  });
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold** and *italic* inline
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
