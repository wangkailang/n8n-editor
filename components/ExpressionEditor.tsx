import React, { useRef, useEffect, useState } from 'react';
import { Copy, Check, Hash, Type, ToggleLeft, Box, Braces, Brackets, Wand2 } from 'lucide-react';
import { VariableSchema, DataType } from '../types';
import { getVariableTypeColor } from '../utils/expressionUtils';

interface ExpressionEditorProps {
  value: string;
  onChange: (val: string) => void;
  insertPath: string | null;
  onInsertComplete: () => void;
  resolvedValue: string;
  variables: VariableSchema[];
}

const TypeIcon: React.FC<{ type: string }> = ({ type }) => {
  const className = `w-3 h-3 flex-shrink-0 ${getVariableTypeColor(type)}`;
  switch (type) {
    case DataType.STRING: return <Type className={className} />;
    case DataType.NUMBER: return <Hash className={className} />;
    case DataType.BOOLEAN: return <ToggleLeft className={className} />;
    case DataType.OBJECT: return <Braces className={className} />;
    case DataType.ARRAY: return <Brackets className={className} />;
    case DataType.FUNCTION: return <Wand2 className={className} />;
    default: return <Box className={className} />;
  }
};

export const ExpressionEditor: React.FC<ExpressionEditorProps> = ({
  value,
  onChange,
  insertPath,
  onInsertComplete,
  resolvedValue,
  variables
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Autocomplete State
  const [showMenu, setShowMenu] = useState(false);
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerIndex, setTriggerIndex] = useState(-1);
  const [filteredOptions, setFilteredOptions] = useState<VariableSchema[]>([]);

  // Sync scroll between textarea and highlighter backdrop
  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
      
      if (showMenu) setShowMenu(false);
    }
  };

  // Handle external insertion (from sidebar click)
  useEffect(() => {
    if (insertPath && textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      const variableToken = `{{ ${insertPath} }}`;
      const newValue = value.substring(0, start) + variableToken + value.substring(end);
      
      onChange(newValue);
      
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

  const getCaretCoordinates = () => {
    const textarea = textareaRef.current;
    if (!textarea) return { top: 0, left: 0 };
    
    const div = document.createElement('div');
    const style = getComputedStyle(textarea);
    
    const properties = [
      'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight', 'fontFamily',
      'textAlign', 'textTransform', 'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing',
      'tabSize', 'MozTabSize'
    ];
    
    properties.forEach(prop => {
      div.style.setProperty(prop, style.getPropertyValue(prop));
    });

    div.style.position = 'absolute';
    div.style.top = '0px';
    div.style.left = '0px';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';

    const text = textarea.value.substring(0, textarea.selectionStart);
    div.textContent = text;

    const span = document.createElement('span');
    span.textContent = '.';
    div.appendChild(span);

    document.body.appendChild(div);

    const relativeTop = span.offsetTop - textarea.scrollTop;
    const relativeLeft = span.offsetLeft - textarea.scrollLeft;
    const lineHeight = parseInt(style.lineHeight) || 20;

    document.body.removeChild(div);

    return {
      top: relativeTop + lineHeight,
      left: relativeLeft
    };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    onChange(newVal);
    
    const cursor = e.target.selectionStart;
    
    // Improved regex to find '{{' token closer to cursor
    // Allows for {{ functionName( }} as well, but primarily we want to autocomplete path start
    const lookback = newVal.substring(Math.max(0, cursor - 50), cursor);
    
    // Match anything after the last {{
    const match = lookback.match(/\{\{\s*([a-zA-Z0-9_\.]*)$/);

    if (match) {
        const typedQuery = match[1];
        const matchIndex = Math.max(0, cursor - 50) + match.index!;
        
        setTriggerIndex(matchIndex);
        setQuery(typedQuery);
        
        const filtered = variables.filter(v => 
            v.path.toLowerCase().includes(typedQuery.toLowerCase())
        );
        
        setFilteredOptions(filtered);
        setSelectedIndex(0);
        
        if (filtered.length > 0) {
            const coords = getCaretCoordinates();
            setMenuCoords(coords);
            setShowMenu(true);
        } else {
            setShowMenu(false);
        }
    } else {
        setShowMenu(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMenu) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredOptions.length);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertVariable(filteredOptions[selectedIndex]);
    } else if (e.key === 'Escape') {
        setShowMenu(false);
    }
  };

  const insertVariable = (variable: VariableSchema) => {
    if (!variable) return;
    
    const textarea = textareaRef.current;
    if (!textarea) return;

    // We replace from the triggerIndex (where {{ starts) up to cursor?
    // Actually, handleInputChange sets triggerIndex at `{{`.
    // The query part is `{{ query`.
    const beforeTrigger = value.substring(0, triggerIndex);
    const afterCursor = value.substring(textarea.selectionEnd);
    
    // For functions, we might want to add parens automatically
    let insertion = `{{ ${variable.path} }}`;
    let cursorOffset = insertion.length;

    if (variable.type === DataType.FUNCTION) {
        insertion = `{{ ${variable.path}() }}`;
        cursorOffset = insertion.length - 3; // Position inside parens: "function(|) }}"
    }
    
    const newValue = `${beforeTrigger}${insertion}${afterCursor}`;
    
    onChange(newValue);
    setShowMenu(false);
    
    requestAnimationFrame(() => {
        const newCursorPos = beforeTrigger.length + cursorOffset;
        textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        textarea.focus();
    });
  };

  const getHighlightedText = () => {
    if (!value) return <br />; 
    
    const parts = value.split(/(\{\{.*?\}\})/g);
    
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
        {value.endsWith('\n') && <br />}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 rounded-t-lg">
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
      <div className="relative flex-1 min-h-[200px] w-full bg-white cursor-text group rounded-b-lg">
        
        {/* The Highlighter Layer (Behind) */}
        <div 
            ref={backdropRef}
            className="absolute inset-0 p-4 font-mono text-sm leading-6 whitespace-pre-wrap break-words pointer-events-none text-slate-900 z-0 overflow-hidden"
            aria-hidden="true"
        >
            {getHighlightedText()}
        </div>

        {/* The Input Layer (Top) */}
        <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            onClick={() => setShowMenu(false)} 
            className="absolute inset-0 w-full h-full p-4 font-mono text-sm leading-6 bg-transparent text-transparent caret-indigo-600 border-none resize-none focus:ring-0 z-10 whitespace-pre-wrap break-words overflow-auto outline-none selection:bg-indigo-500/20"
            spellCheck={false}
            placeholder="Type {{ to select variables or functions..."
        />

        {/* Autocomplete Menu */}
        {showMenu && (
            <div 
                className="absolute z-50 w-64 bg-white rounded-md shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
                style={{ 
                    top: menuCoords.top, 
                    left: menuCoords.left,
                    maxHeight: '200px'
                }}
            >
                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                    Suggestions
                </div>
                <ul className="overflow-y-auto flex-1 py-1">
                    {filteredOptions.map((option, idx) => (
                        <li 
                            key={option.path}
                            className={`px-3 py-2 flex items-center cursor-pointer text-sm ${idx === selectedIndex ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                            onClick={() => insertVariable(option)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                        >
                            <TypeIcon type={option.type} />
                            <div className="ml-2 flex flex-col overflow-hidden">
                                <span className="font-medium truncate">{option.path}</span>
                                <span className="text-xs text-slate-400 truncate opacity-80">{String(option.value)}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        )}
      </div>

      {/* Result Preview Panel */}
      <div className="border-t border-slate-200 bg-slate-50 p-0 flex flex-col h-1/3 min-h-[150px] rounded-b-lg">
        <div className="px-4 py-2 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Result Preview
        </div>
        <div className="flex-1 p-4 overflow-auto font-mono text-sm text-slate-700">
            {resolvedValue ? (
                <div className="whitespace-pre-wrap break-words">
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