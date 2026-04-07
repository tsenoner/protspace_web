export type LogicalOp = 'AND' | 'OR' | 'NOT';

export interface FilterCondition {
  id: string;
  logicalOp?: LogicalOp;
  annotation: string;
  values: string[];
}

export interface FilterGroup {
  id: string;
  logicalOp?: LogicalOp;
  conditions: FilterQueryItem[];
}

export type FilterQueryItem = FilterCondition | FilterGroup;
export type FilterQuery = FilterQueryItem[];

let nextId = 0;

function generateId(): string {
  return `q-${Date.now()}-${nextId++}`;
}

export function createCondition(overrides?: Partial<FilterCondition>): FilterCondition {
  return {
    id: generateId(),
    annotation: '',
    values: [],
    ...overrides,
  };
}

export function createGroup(overrides?: Partial<FilterGroup>): FilterGroup {
  return {
    id: generateId(),
    logicalOp: 'AND',
    conditions: [createCondition()],
    ...overrides,
  };
}

export function isFilterGroup(item: FilterQueryItem): item is FilterGroup {
  return 'conditions' in item;
}
