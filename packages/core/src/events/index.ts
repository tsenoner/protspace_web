export type HostMessageSeverity = 'info' | 'warning' | 'error' | 'success';

export interface HostMessageEventDetail<
  TSource extends string = string,
  TSeverity extends HostMessageSeverity = HostMessageSeverity,
  TContext extends object | undefined = object | undefined,
> {
  message: string;
  severity: TSeverity;
  source: TSource;
  context?: TContext;
  originalError?: unknown;
}
