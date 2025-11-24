import React, { useRef, useEffect, useState } from 'react';
import { Copy, Check, Wand2 } from 'lucide-react';

interface ExpressionEditorProps {
  value: string;
  onChange: (val: string) => void;
  insertPath: string | null;
  onInsertComplete: () => void;
  resolvedValue: string;
}

export const ExpressionEditor: React.FC<ExpressionEditorProps> = ({
  value,
  onChange,
  insertPath,
  onInsertComplete,
  resolvedValue,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Sync scroll between textarea and highlighter backdrop
  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Handle external insertion (from sidebar click)
  useEffect(() => {
    if (insertPath && textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      const variableToken = `{{${insertPath}}}`;
      const newValue = value.substring(0, start) + variableToken + value.substring(end);
      
      onChange(newValue);
      
      // Move cursor after insertion
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variableToken.length;
        textarea.focus();
      });

      onInsertComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertPath]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Highlight Logic: Wrap {{...}} in span
  const getHighlightedText = () => {
    if (!value) return <br />; 
    
    const parts = value.split(/(\{\{[^}]+\}\})/g);
    
    return (
      <>
        {parts.map((part, index) => {
          if (part.startsWith('{{') && part.endsWith('}}')) {
            return (
              <span 
                key={index} 
                className="bg-indigo-100 text-indigo-700 rounded-sm"
              >
                {part}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
        {/* Ensure trailing newline renders correctly in the backdrop div */}
        {value.endsWith('\n') && <br />}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-slate-700">Expression</span>
        </div>
        <div className="flex items-center space-x-2">
            <button 
                onClick={copyToClipboard}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-md transition-all focus:outline-none"
                title="Copy Expression"
            >
                {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
        </div>
      </div>

      {/* Editor Container */}
      <div className="relative flex-1 min-h-[200px] w-full bg-white cursor-text group" onClick={() => textareaRef.current?.focus()}>
        
        {/* The Highlighter Layer (Behind) */}
        {/* 
           1. text-slate-900: Provides the visible text color for normal text.
           2. overflow-hidden: Hides scrollbars on backdrop, scroll is driven by textarea.
        */}
        <div 
            ref={backdropRef}
            className="absolute inset-0 p-4 font-mono text-sm leading-6 whitespace-pre-wrap break-words pointer-events-none text-slate-900 z-0 overflow-hidden"
            aria-hidden="true"
        >
            {getHighlightedText()}
        </div>

        {/* The Input Layer (Top) */}
        {/* 
           1. text-transparent: Hides the raw text to prevent "double text" ghosting.
           2. caret-indigo-600: Ensures the cursor remains visible and styled.
           3. selection:bg-indigo-500/20: Ensures text selection is visible over the backdrop.
        */}
        <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            className="absolute inset-0 w-full h-full p-4 font-mono text-sm leading-6 bg-transparent text-transparent caret-indigo-600 border-none resize-none focus:ring-0 z-10 whitespace-pre-wrap break-words overflow-auto outline-none selection:bg-indigo-500/20"
            spellCheck={false}
            placeholder="Type your expression here or select variables from the left..."
        />
      </div>

      {/* Result Preview Panel */}
      <div className="border-t border-slate-200 bg-slate-50 p-0 flex flex-col h-1/3 min-h-[150px]">
        <div className="px-4 py-2 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Result Preview
        </div>
        <div className="flex-1 p-4 overflow-auto font-mono text-sm text-slate-700">
            {resolvedValue ? (
                <div className="whitespace-pre-wrap break-words animate-in fade-in duration-300">
                    {resolvedValue}
                </div>
            ) : (
                <span className="text-slate-400 italic">Start typing to see the result...</span>
            )}
        </div>
      </div>
    </div>
  );
};