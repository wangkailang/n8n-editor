import { WorkflowNode, DataType } from '../types';

// Regex to identify {{ NodeName.path.to.variable }}
// We allow spaces inside the braces for forgiveness: {{  Node.value  }}
const VARIABLE_REGEX = /\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/g;

/**
 * flattens a JSON object into a list of paths
 */
export const flattenObjectToSchema = (
  obj: any,
  parentPath: string = ''
): any[] => {
  if (obj === null || obj === undefined) return [];

  const schema: any[] = [];

  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    const currentPath = parentPath ? `${parentPath}.${key}` : key;
    const type = Array.isArray(value)
      ? DataType.ARRAY
      : value === null
      ? DataType.NULL
      : typeof value === 'object'
      ? DataType.OBJECT
      : (typeof value as DataType);

    const item = {
      path: currentPath,
      key,
      type,
      value: typeof value === 'object' ? JSON.stringify(value).substring(0, 20) + '...' : value,
      isExpandable: type === DataType.OBJECT || type === DataType.ARRAY,
    };

    schema.push(item);

    // Recursively add children if needed for a flat list, 
    // but for tree view we might handle this differently in the component.
    // Here we return a structure suitable for recursive rendering.
  });

  return schema;
};

/**
 * Resolves a single path string (e.g. "Webhook.body.name") against the list of nodes
 */
export const resolvePath = (path: string, nodes: WorkflowNode[]): any => {
  const parts = path.split('.');
  const nodeName = parts[0];
  const restPath = parts.slice(1);

  const node = nodes.find((n) => n.name === nodeName);
  if (!node) return undefined;

  let current = node.data;
  for (const part of restPath) {
    if (current === undefined || current === null) return undefined;
    // Handle array access if brackets exist (simplified for this demo, assumes dot notation for arrays mostly)
    // Real n8n handles [0] syntax, here we will stick to pure dot notation or simple obj access
    current = current[part];
  }

  return current;
};

/**
 * Evaluates the full expression string by replacing {{variables}} with their values.
 */
export const evaluateExpression = (expression: string, nodes: WorkflowNode[]): string => {
  if (!expression) return '';

  return expression.replace(VARIABLE_REGEX, (match, path) => {
    const value = resolvePath(path, nodes);
    if (value === undefined) {
      return `[undefined: ${path}]`;
    }
    if (typeof value === 'object') {
      return '[Object]';
    }
    return String(value);
  });
};

export const getVariableTypeColor = (type: DataType | string): string => {
  switch (type) {
    case DataType.STRING: return 'text-green-600';
    case DataType.NUMBER: return 'text-orange-600';
    case DataType.BOOLEAN: return 'text-blue-600';
    case DataType.OBJECT: return 'text-purple-600';
    case DataType.ARRAY: return 'text-purple-600';
    default: return 'text-slate-500';
  }
};
