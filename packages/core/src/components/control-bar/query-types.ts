export type LogicalOp = 'AND' | 'OR' | 'NOT';
export type ConditionOperator = 'is' | 'is_not' | 'contains' | 'starts_with';

export interface FilterCondition {
  id: string;
  logicalOp?: LogicalOp;
  annotation: string;
  operator: ConditionOperator;
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

export function generateId(): string {
  return `q-${Date.now()}-${nextId++}`;
}

export function createCondition(overrides?: Partial<FilterCondition>): FilterCondition {
  return {
    id: generateId(),
    annotation: '',
    operator: 'is',
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
