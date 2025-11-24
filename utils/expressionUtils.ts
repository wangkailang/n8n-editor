import { WorkflowNode, DataType, VariableSchema } from '../types';

// Regex to identify {{ ... }} blocks
const EXPRESSION_REGEX = /\{\{(.*?)\}\}/g;

/**
 * Built-in formatting functions available in the expression editor
 */
const FORMATTERS: Record<string, Function> = {
  // String Utils
  toUpper: (str: any) => String(str || '').toUpperCase(),
  toLower: (str: any) => String(str || '').toLowerCase(),
  truncate: (str: any, length: number) => {
    const s = String(str || '');
    return s.length > length ? s.substring(0, length) + '...' : s;
  },
  
  // Date Utils
  formatDate: (date: string | number | Date, formatStr: string = 'YYYY-MM-DD') => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';

    const map: Record<string, string> = {
      YYYY: d.getFullYear().toString(),
      MM: ('0' + (d.getMonth() + 1)).slice(-2),
      DD: ('0' + d.getDate()).slice(-2),
      HH: ('0' + d.getHours()).slice(-2),
      mm: ('0' + d.getMinutes()).slice(-2),
      ss: ('0' + d.getSeconds()).slice(-2),
    };

    return formatStr.replace(/YYYY|MM|DD|HH|mm|ss/g, (matched) => map[matched]);
  },
  now: () => new Date(),

  // Number/Money Utils
  formatCurrency: (amount: number, currency: string = 'USD') => {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    } catch (e) {
      return `${amount} ${currency}`;
    }
  },
  round: (num: number, decimals: number = 0) => {
     const factor = Math.pow(10, decimals);
     return Math.round(Number(num) * factor) / factor;
  },

  // Data/JSON Utils
  json: (obj: any) => JSON.stringify(obj, null, 2),
  join: (arr: any[], separator: string = ', ') => Array.isArray(arr) ? arr.join(separator) : String(arr),
  length: (item: any) => (item && item.length !== undefined ? item.length : 0),
};

/**
 * flattens a JSON object into a list of paths
 */
export const flattenObjectToSchema = (
  obj: any,
  parentPath: string = ''
): VariableSchema[] => {
  if (obj === null || obj === undefined) return [];

  const schema: VariableSchema[] = [];

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

    const item: VariableSchema = {
      path: currentPath,
      key,
      type,
      value: typeof value === 'object' ? JSON.stringify(value).substring(0, 20) + '...' : value,
      isExpandable: type === DataType.OBJECT || type === DataType.ARRAY,
    };

    schema.push(item);

    if (type === DataType.OBJECT && value !== null && !Array.isArray(value)) {
        schema.push(...flattenObjectToSchema(value, currentPath));
    }
  });

  return schema;
};

/**
 * Generates a flat list of all variables available from the nodes AND built-in functions for autocomplete
 */
export const generateAutocompleteOptions = (nodes: WorkflowNode[]): VariableSchema[] => {
  // 1. Node Variables
  const variables = nodes.flatMap(node => flattenObjectToSchema(node.data, node.name));

  // 2. Built-in Functions
  const functions: VariableSchema[] = Object.keys(FORMATTERS).map(fnName => ({
    path: fnName,
    key: fnName,
    type: DataType.FUNCTION,
    value: 'Function',
    isExpandable: false
  }));

  return [...functions, ...variables];
};

/**
 * Evaluates the full expression string by executing JS inside {{ ... }}
 */
export const evaluateExpression = (expression: string, nodes: WorkflowNode[]): string => {
  if (!expression) return '';

  // 1. Build the Context Object
  // Top-level keys will be node names (e.g. 'Webhook', 'Stripe')
  const context: Record<string, any> = {};
  
  nodes.forEach(node => {
    context[node.name] = node.data;
  });

  // Add formatters to context (e.g. 'toUpper', 'formatDate')
  Object.assign(context, FORMATTERS);

  // 2. Process the string
  return expression.replace(EXPRESSION_REGEX, (match, code) => {
    try {
        // Create a function that takes the context keys as arguments
        const argNames = Object.keys(context);
        const argValues = Object.values(context);
        
        // "return " + code ensures expressions like "Webhook.id" return the value.
        // We use a safe-ish way to access properties, but it's still eval-like.
        // In a real app, use a sandboxed parser like 'jsep' or 'vm'.
        // For this UI demo, new Function is acceptable.
        
        // We unescape HTML entities if any (simple browser implementation) just in case
        const cleanCode = code.trim().replace(/&gt;/g, '>').replace(/&lt;/g, '<');
        
        const fn = new Function(...argNames, `return (${cleanCode});`);
        const result = fn(...argValues);

        if (result === undefined) return '';
        if (typeof result === 'object') return JSON.stringify(result); // Default object to JSON string in output
        return String(result);

    } catch (err) {
        // console.error("Eval error", err);
        return `[Error: ${err instanceof Error ? err.message : 'Invalid Expression'}]`;
    }
  });
};

export const getVariableTypeColor = (type: DataType | string): string => {
  switch (type) {
    case DataType.STRING: return 'text-green-600';
    case DataType.NUMBER: return 'text-orange-600';
    case DataType.BOOLEAN: return 'text-blue-600';
    case DataType.OBJECT: return 'text-purple-600';
    case DataType.ARRAY: return 'text-purple-600';
    case DataType.FUNCTION: return 'text-pink-600';
    default: return 'text-slate-500';
  }
};