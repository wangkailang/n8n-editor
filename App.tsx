import React, { useState, useMemo, useCallback } from 'react';
import { MOCK_NODES } from './services/mockData';
import { Sidebar } from './components/Sidebar';
import { ExpressionEditor } from './components/ExpressionEditor';
import { evaluateExpression, generateAutocompleteOptions, buildEvaluationContext, validateSnippet } from './utils/expressionUtils';
import { Sparkles, Terminal } from 'lucide-react';

const App: React.FC = () => {
  const [expression, setExpression] = useState<string>('Hello {{Webhook.body.email}}, welcome back!');
  const [insertPath, setInsertPath] = useState<string | null>(null);

  // Handle sidebar clicks
  const handleVariableInsert = (path: string) => {
    setInsertPath(path);
  };

  // Reset insertion state after editor consumes it
  const handleInsertComplete = () => {
    setInsertPath(null);
  };

  // Real-time evaluation of the expression
  const resolvedValue = useMemo(() => {
    return evaluateExpression(expression, MOCK_NODES);
  }, [expression]);

  // Generate autocomplete options
  const variableOptions = useMemo(() => {
    return generateAutocompleteOptions(MOCK_NODES);
  }, []);

  // Build a reusable validator function for the editor
  const evaluationContext = useMemo(() => buildEvaluationContext(MOCK_NODES), []);
  const validator = useCallback((code: string) => {
    return validateSnippet(code, evaluationContext);
  }, [evaluationContext]);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 justify-between flex-shrink-0 z-20 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-800">Workflow Editor</h1>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-500 font-medium">v1.0.0</span>
        </div>
        
        <div className="flex items-center space-x-4">
             <button className="flex items-center px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Assistant
             </button>
             <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 ring-2 ring-white cursor-pointer" title="User Profile"></div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Variables) */}
        <Sidebar nodes={MOCK_NODES} onInsert={handleVariableInsert} />

        {/* Center Canvas / Editor Area */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col items-center justify-start bg-slate-100">
          <div className="w-full max-w-4xl h-full flex flex-col space-y-4">
            
            {/* Breadcrumb / Context Info */}
            <div className="flex items-center text-sm text-slate-500 space-x-2">
                <span>Workflows</span>
                <span>/</span>
                <span className="text-slate-800 font-medium">Onboarding Campaign</span>
                <span>/</span>
                <span>Edit Node: </span>
                <span className="font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Transform</span>
            </div>

            {/* The Editor Component */}
            <div className="flex-1 shadow-lg rounded-lg overflow-hidden border border-slate-300/60">
                <ExpressionEditor 
                    value={expression} 
                    onChange={setExpression}
                    insertPath={insertPath}
                    onInsertComplete={handleInsertComplete}
                    resolvedValue={resolvedValue}
                    variables={variableOptions}
                    validator={validator}
                />
            </div>

            {/* Hint Footer */}
            <div className="text-xs text-slate-400 text-center pb-2">
                Tip: You can perform basic JavaScript operations inside <code className="bg-slate-200 px-1 rounded text-slate-600">{'{{ }}'}</code> blocks (Simulated).
                <br/>
                Type <code className="bg-slate-200 px-1 rounded text-slate-600">{'{{'}</code> to trigger autocomplete.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;