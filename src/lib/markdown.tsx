import React from 'react';

export function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block handling
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        result.push(
          <pre key={`code-${i}`} className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2 mb-2 overflow-x-auto">
            <code className="text-xs text-gray-700 font-mono whitespace-pre">{codeContent.join('\n')}</code>
          </pre>
        );
        codeContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      result.push(<hr key={i} className="border-gray-200 my-3" />);
      continue;
    }

    if (line.startsWith('### ')) { result.push(<h4 key={i} className="font-semibold text-gray-800 mt-3 mb-1 text-sm">{renderInline(line.replace('### ', ''))}</h4>); continue; }
    if (line.startsWith('## ')) { result.push(<h3 key={i} className="font-bold text-gray-900 mt-4 mb-1 text-sm">{renderInline(line.replace('## ', ''))}</h3>); continue; }
    if (line.startsWith('# ')) { result.push(<h2 key={i} className="font-bold text-gray-900 mt-3 mb-1 text-base">{renderInline(line.replace('# ', ''))}</h2>); continue; }

    // Checkbox list items
    if (line.match(/^[-*]\s*\[[ x]\]/)) {
      const checked = line.includes('[x]');
      const content = line.replace(/^[-*]\s*\[[ x]\]\s*/, '');
      result.push(
        <div key={i} className="flex items-start gap-2 ml-2 mt-0.5">
          <span className={`mt-0.5 text-sm ${checked ? 'text-green-500' : 'text-gray-300'}`}>{checked ? '✓' : '○'}</span>
          <span className={`text-sm ${checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{renderInline(content)}</span>
        </div>
      );
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.slice(2);
      result.push(<li key={i} className="ml-4 text-sm text-gray-700 mt-0.5 list-disc">{renderInline(content)}</li>);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, '');
      result.push(<li key={i} className="ml-4 text-sm text-gray-700 mt-0.5 list-decimal">{renderInline(content)}</li>);
      continue;
    }
    if (line.startsWith('> ')) { result.push(<blockquote key={i} className="border-l-2 border-blue-300 pl-3 text-sm text-gray-600 italic mt-1 bg-blue-50/50 py-0.5">{renderInline(line.slice(2))}</blockquote>); continue; }
    if (line.startsWith('**') && line.endsWith('**')) { result.push(<p key={i} className="font-semibold text-gray-800 mt-2 text-sm">{line.replace(/\*\*/g, '')}</p>); continue; }
    if (line.trim() === '') { result.push(<div key={i} className="h-2" />); continue; }
    result.push(<p key={i} className="text-sm text-gray-700 mt-1 leading-relaxed">{renderInline(line)}</p>);
  }

  return result;
}

function renderInline(text: string): React.ReactNode {
  // Handle inline code, **bold**, *italic*, and [links](url)
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    // Inline code
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-xs rounded font-mono">{part.slice(1, -1)}</code>;
    }
    // Bold
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    // Italic
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    // Links
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline underline-offset-2">{linkMatch[1]}</a>;
    }
    return part;
  });
}
