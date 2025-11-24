import React, { useRef, useEffect, useState } from 'react';
import { Copy, Check, Hash, Type, ToggleLeft, Box, Braces, Brackets, Wand2, Info } from 'lucide-react';
import { VariableSchema, DataType, Validator } from '../types';
import { getVariableTypeColor } from '../utils/expressionUtils';

interface ExpressionEditorProps {
  value: string;
  onChange: (val: string) => void;
  insertPath: string | null;
  onInsertComplete: () => void;
  resolvedValue: string;
  variables: VariableSchema[];
  validator?: Validator;
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
  variables,
  validator
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

  // Token Inspection State (Tooltip)
  const [activeToken, setActiveToken] = useState<VariableSchema | null>(null);
  const [tooltipCoords, setTooltipCoords] = useState({ top: 0, left: 0 });

  // Sync scroll between textarea and highlighter backdrop
  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
      
      if (showMenu) setShowMenu(false);
      // We don't hide the tooltip on scroll, it just moves with text usually, 
      // but simplistic calc might drift. Hiding is safer.
      setActiveToken(null);
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
        checkCursorContext(); // Trigger tooltip check after insert
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

  /**
   * Checks if the cursor is currently inside a {{ ... }} block and determines which variable/function it is.
   */
  const checkCursorContext = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Don't show tooltip if menu is open to avoid clutter
    if (showMenu) {
        setActiveToken(null);
        return;
    }

    const cursor = textarea.selectionStart;
    const text = textarea.value;

    // Find boundaries of the current interpolation block
    const lastOpen = text.lastIndexOf('{{', cursor);
    const nextClose = text.indexOf('}}', lastOpen);

    // Ensure cursor is strictly between {{ and }} (including spaces)
    // +2 accounts for the length of '{{'
    if (lastOpen !== -1 && nextClose !== -1 && cursor >= lastOpen && cursor <= nextClose + 2) {
        
        const content = text.slice(lastOpen + 2, nextClose).trim();
        
        // 1. Try to match the exact string to a variable (e.g. "Webhook.body.email")
        let found = variables.find(v => v.path === content);

        // 2. If not found, check if it's a function call (e.g. "formatDate(...)")
        if (!found) {
            const possibleFuncName = content.split('(')[0].trim();
            found = variables.find(v => v.path === possibleFuncName && v.type === DataType.FUNCTION);
        }

        // 3. Fallback: If strict match fails, we can try to see if the word *under the cursor* is a variable.
        // This handles cases like: {{ formatDate( Webhook.body.email ) }} where cursor is on Webhook...
        if (!found) {
             // Basic word boundary detection around cursor inside the content
             // Calculate cursor position relative to the content string
             const cursorInContent = cursor - (lastOpen + 2);
             if (cursorInContent >= 0 && cursorInContent <= content.length) {
                 // Expand word around cursor
                 // We use a simple regex to grab the continuous identifier characters around cursor
                 // Note: This is an approximation.
                 const before = content.slice(0, cursorInContent).match(/[\w\.]+$/);
                 const after = content.slice(cursorInContent).match(/^[\w\.]+/);
                 
                 if (before || after) {
                    const word = (before ? before[0] : '') + (after ? after[0] : '');
                    found = variables.find(v => v.path === word);
                 }
             }
        }

        if (found) {
            const coords = getCaretCoordinates();
            // Position tooltip slightly below cursor
            setTooltipCoords({
                top: coords.top + 5,
                left: coords.left
            });
            setActiveToken(found);
            return;
        }
    }

    setActiveToken(null);
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
            setActiveToken(null); // Hide tooltip when autocomplete is active
        } else {
            setShowMenu(false);
        }
    } else {
        setShowMenu(false);
        // We delay the cursor context check slightly or just run it
        // Running immediately might be flashy while typing, but useful.
        // checkCursorContext(); // Let's rely on onKeyUp/Click for stability
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMenu) {
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
    }
  };

  const handleKeyUp = () => {
      // Trigger context check on key up (navigation, typing)
      if (!showMenu) {
          checkCursorContext();
      }
  };

  const handleClick = () => {
      setShowMenu(false);
      checkCursorContext();
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
        checkCursorContext(); // Show tooltip for the newly inserted function
    });
  };

  const getHighlightedText = () => {
    if (!value) return <br />; 
    
    const parts = value.split(/(\{\{.*?\}\})/g);
    
    return (
      <>
        {parts.map((part, index) => {
          if (part.startsWith('{{') && part.endsWith('}}')) {
            const innerCode = part.slice(2, -2).trim();
            const validation = validator ? validator(innerCode) : { isValid: true };
            
            const validClass = "bg-indigo-100 text-indigo-700 rounded-sm";
            const invalidClass = "bg-red-50 text-red-600 rounded-sm border-b border-red-400";

            return (
              <span 
                key={index} 
                className={validation.isValid ? validClass : invalidClass}
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

  const selectedOption = filteredOptions[selectedIndex];

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
            onKeyUp={handleKeyUp}
            onClick={handleClick}
            onScroll={handleScroll}
            className="absolute inset-0 w-full h-full p-4 font-mono text-sm leading-6 bg-transparent text-transparent caret-indigo-600 border-none resize-none focus:ring-0 z-10 whitespace-pre-wrap break-words overflow-auto outline-none selection:bg-indigo-500/20"
            spellCheck={false}
            placeholder="Type {{ to select variables or functions..."
        />

        {/* Autocomplete Menu */}
        {showMenu && (
            <div 
                className="absolute z-50 w-80 bg-white rounded-md shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
                style={{ 
                    top: menuCoords.top, 
                    left: menuCoords.left,
                    maxHeight: '300px'
                }}
            >
                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                    Suggestions
                </div>
                <ul className="overflow-y-auto flex-1 py-1 max-h-40">
                    {filteredOptions.map((option, idx) => (
                        <li 
                            key={option.path}
                            className={`px-3 py-2 flex items-center cursor-pointer text-sm ${idx === selectedIndex ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                            onClick={() => insertVariable(option)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                        >
                            <TypeIcon type={option.type} />
                            <div className="ml-2 flex flex-col overflow-hidden w-full">
                                <span className="font-medium truncate">{option.path}</span>
                            </div>
                        </li>
                    ))}
                </ul>
                
                {/* Info Panel for Autocomplete */}
                {selectedOption && (
                    <div className="bg-slate-50 border-t border-slate-100 p-3 text-xs">
                         <div className="flex items-start mb-1">
                             <Info className="w-3 h-3 text-indigo-500 mt-0.5 mr-1.5 flex-shrink-0" />
                             <span className="font-semibold text-slate-700">
                                 {selectedOption.type === DataType.FUNCTION ? 'Function' : 'Variable'}
                             </span>
                         </div>
                         <div className="text-slate-600 mb-2 leading-relaxed">
                             {selectedOption.description || 'No description available.'}
                         </div>
                         <div className="bg-white border border-slate-200 rounded p-1.5 font-mono text-slate-500 truncate">
                             {selectedOption.usage ? (
                                 <span className="text-indigo-600">{selectedOption.usage}</span>
                             ) : (
                                 <span>Val: {String(selectedOption.value).substring(0, 40)}</span>
                             )}
                         </div>
                    </div>
                )}
            </div>
        )}

        {/* Active Token Tooltip (Inspection) */}
        {activeToken && !showMenu && (
            <div 
                className="absolute z-40 max-w-xs bg-slate-800 text-white rounded shadow-xl border border-slate-700 animate-in fade-in zoom-in-95 duration-100 p-2.5 pointer-events-none"
                style={{ 
                    top: tooltipCoords.top, 
                    left: tooltipCoords.left,
                    transform: 'translateY(4px)' // Offset slightly
                }}
            >
                <div className="flex items-center mb-1 pb-1 border-b border-slate-600">
                    <TypeIcon type={activeToken.type} />
                    <span className="ml-2 text-xs font-bold truncate">{activeToken.path}</span>
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-400 bg-slate-700 px-1 rounded">
                        {activeToken.type}
                    </span>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed">
                    {activeToken.description}
                </div>
                {activeToken.usage && (
                     <div className="mt-2 text-[10px] font-mono text-indigo-300 bg-slate-900/50 p-1 rounded border border-slate-700/50">
                         {activeToken.usage}
                     </div>
                )}
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
