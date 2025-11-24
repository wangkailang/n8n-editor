import React, { useState } from 'react';
import { WorkflowNode, InsertionCallback } from '../types';
import { SchemaTree } from './SchemaTree';
import { Layers, Search } from 'lucide-react';

interface SidebarProps {
  nodes: WorkflowNode[];
  onInsert: InsertionCallback;
}

export const Sidebar: React.FC<SidebarProps> = ({ nodes, onInsert }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Simple filter logic for nodes
  const filteredNodes = nodes.filter(n => 
    n.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-80 flex-shrink-0">
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center mb-3">
          <Layers className="w-4 h-4 mr-2 text-indigo-600" />
          Input Data
        </h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search nodes..." 
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredNodes.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            No nodes found
          </div>
        ) : (
          filteredNodes.map(node => (
            <div key={node.id} className="mb-4">
              <div className="px-2 py-1.5 mb-1 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
                {node.name}
              </div>
              <SchemaTree 
                data={node.data} 
                basePath={node.name} 
                onInsert={onInsert} 
              />
            </div>
          ))
        )}
      </div>
      
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">
        Click items to insert variable
      </div>
    </div>
  );
};
