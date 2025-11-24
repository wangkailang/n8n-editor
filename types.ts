export enum DataType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  OBJECT = 'object',
  ARRAY = 'array',
  NULL = 'null',
  FUNCTION = 'function'
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  data: Record<string, any>;
}

export interface VariableSchema {
  path: string;
  key: string;
  type: DataType;
  value: any;
  parentPath?: string;
  isExpandable: boolean;
  children?: VariableSchema[];
  description?: string;
  usage?: string;
}

export type InsertionCallback = (path: string) => void;

export type Validator = (expression: string) => { isValid: boolean; message?: string };