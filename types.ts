export enum DataType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  OBJECT = 'object',
  ARRAY = 'array',
  NULL = 'null'
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
}

export type InsertionCallback = (path: string) => void;
