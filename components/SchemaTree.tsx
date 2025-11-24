import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Box, Hash, Type, ToggleLeft, Braces, Brackets } from 'lucide-react';
import { DataType, InsertionCallback } from '../types';
import { getVariableTypeColor } from '../utils/expressionUtils';

interface SchemaTreeProps {
  data: any;
  basePath: string;
  onInsert: InsertionCallback;
  level?: number;
}

const TypeIcon: React.FC<{ type: string }> = ({ type }) => {
  const className = `w-3 h-3 mr-1.5 ${getVariableTypeColor(type)}`;
  switch (type) {
    case DataType.STRING: return <Type className={className} />;
    case DataType.NUMBER: return <Hash className={className} />;
    case DataType.BOOLEAN: return <ToggleLeft className={className} />;
    case DataType.OBJECT: return <Braces className={className} />;
    case DataType.ARRAY: return <Brackets className={className} />;
    default: return <Box className={className} />;
  }
};

const SchemaItem: React.FC<{
  itemKey: string;
  value: any;
  path: string;
  onInsert: InsertionCallback;
  level: number;
}> = ({ itemKey, value, path, onInsert, level }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  let type = DataType.STRING;
  if (typeof value === 'number') type = DataType.NUMBER;
  if (typeof value === 'boolean') type = DataType.BOOLEAN;
  if (isObject) type = DataType.OBJECT;
  if (isArray) type = DataType.ARRAY;

  const handleInsert = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Insert the full path
    onInsert(path);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const displayValue = typeof value === 'object' ? '' : String(value);

  return (
    <div className="select-none">
      <div
        className={`flex items-center group py-1 pr-2 rounded cursor-pointer hover:bg-slate-100 transition-colors ${level > 0 ? 'ml-3' : ''}`}
        onClick={isExpandable ? handleToggle : handleInsert}
        title={isExpandable ? `${path} (Expand)` : `Path: ${path}\nValue: ${displayValue}`}
      >
        <div className="flex-shrink-0 w-4 h-4 mr-1 flex items-center justify-center text-slate-400">
          {isExpandable && (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
        </div>
        
        <TypeIcon type={type} />
        
        <span className="text-sm font-medium text-slate-700 truncate mr-2">
          {itemKey}
        </span>

        {!isExpandable && (
            <span className="text-xs text-slate-400 truncate flex-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                {String(value).substring(0, 15)}
            </span>
        )}
      </div>

      {isExpandable && isOpen && (
        <div className="border-l border-slate-200 ml-2.5">
          <SchemaTree
            data={value}
            basePath={path}
            onInsert={onInsert}
            level={level + 1}
          />
        </div>
      )}
    </div>
  );
};

export const SchemaTree: React.FC<SchemaTreeProps> = ({ data, basePath, onInsert, level = 0 }) => {
  if (!data || typeof data !== 'object') return null;

  return (
    <div className="flex flex-col">
      {Object.keys(data).map((key) => (
        <SchemaItem
          key={key}
          itemKey={key}
          value={data[key]}
          path={basePath ? `${basePath}.${key}` : key}
          onInsert={onInsert}
          level={level}
        />
      ))}
    </div>
  );
};
