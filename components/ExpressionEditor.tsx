import React, { useRef, useEffect, useState } from 'react';
import { Copy, Check, Hash, Type, ToggleLeft, Box, Braces, Brackets } from 'lucide-react';
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
      
      // If menu is open, we should ideally close it or re-calculate, 
      // but for simplicity let's close it on scroll to avoid floating issues
      if (showMenu) setShowMenu(false);
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

  // Calculate coordinates for the Autocomplete Menu
  const getCaretCoordinates = () => {
    const textarea = textareaRef.current;
    if (!textarea) return { top: 0, left: 0 };
    
    // Create a dummy div to mirror the textarea properties
    const div = document.createElement('div');
    const style = getComputedStyle(textarea);
    
    // Copy relevant styles
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

    // Set text content up to cursor
    const text = textarea.value.substring(0, textarea.selectionStart);
    div.textContent = text;

    // Create a span at the end to get coordinates
    const span = document.createElement('span');
    span.textContent = '.';
    div.appendChild(span);

    document.body.appendChild(div);

    // Calculate relative coordinates
    // We need to account for the textarea's scroll
    const relativeTop = span.offsetTop - textarea.scrollTop;
    const relativeLeft = span.offsetLeft - textarea.scrollLeft;
    const lineHeight = parseInt(style.lineHeight) || 20;

    document.body.removeChild(div);

    return {
      top: relativeTop + lineHeight, // Position below the line
      left: relativeLeft
    };
  };

  // Logic to detect autocomplete trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    onChange(newVal);
    
    const cursor = e.target.selectionStart;
    
    // Look backwards from cursor for '{{'
    // Limit lookback to reasonable amount (e.g., 50 chars) to stay performant and relevant
    const lookback = newVal.substring(Math.max(0, cursor - 50), cursor);
    const match = lookback.match(/\{\{\s*([a-zA-Z0-9_\.]*)$/);

    if (match) {
        // Found a potential open tag.
        // Check if there is a closing tag '}}' immediately after or before the next newline
        // If the user already closed it, we might still want to edit if they are inside.
        // But specifically, we want to avoid triggering if we are OUTSIDE.
        // The regex `\{\{...$` ensures we are inside an unclosed segment relative to the cursor position.
        
        // Also ensure we are not already closed by looking ahead? 
        // Simpler: Just trigger if we match the pattern ending at cursor.
        const typedQuery = match[1];
        const matchIndex = Math.max(0, cursor - 50) + match.index!;
        
        setTriggerIndex(matchIndex);
        setQuery(typedQuery);
        
        // Filter variables
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

  // Keyboard Navigation
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

    // Replace the query part with the full path
    // We know triggerIndex is where '{{' starts
    // We assume the query goes up to current cursor position
    const beforeTrigger = value.substring(0, triggerIndex);
    const afterCursor = value.substring(textarea.selectionEnd);
    
    // We want the result to be `{{ Variable.Path }}`
    // If the user typed `{{ Var`, we replace `{{ Var` with `{{ Variable.Path }}`
    // We add spaces for nicer formatting if desired, e.g. `{{ path }}`
    const newValue = `${beforeTrigger}{{ ${variable.path} }}${afterCursor}`;
    
    onChange(newValue);
    setShowMenu(false);
    
    requestAnimationFrame(() => {
        // Place cursor after the inserted variable
        const newCursorPos = beforeTrigger.length + variable.path.length + 5; // {{_ + _}} length
        textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        textarea.focus();
    });
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
        {value.endsWith('\n') && <br />}
      </>
    );
  };

  return (
    // Removed overflow-hidden from here to allow popup to potentially flow out if needed,
    // though ideally it stays within container. We keep container relative.
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
            onClick={() => setShowMenu(false)} // Close menu on click elsewhere
            className="absolute inset-0 w-full h-full p-4 font-mono text-sm leading-6 bg-transparent text-transparent caret-indigo-600 border-none resize-none focus:ring-0 z-10 whitespace-pre-wrap break-words overflow-auto outline-none selection:bg-indigo-500/20"
            spellCheck={false}
            placeholder="Type {{ to select variables..."
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
                    Select Variable
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