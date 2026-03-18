// GenericRow represents dynamic Parquet data with arbitrary columns
export type GenericRow = Record<string, unknown>;

export type Rows = GenericRow[];
