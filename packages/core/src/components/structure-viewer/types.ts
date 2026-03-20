export type {
  StructureErrorContext,
  StructureErrorEventDetail,
  StructureLoadDetail,
  StructureLoadEvent,
} from './structure-viewer.events';

import type { StructureErrorEventDetail } from './structure-viewer.events';

export interface StructureErrorEvent extends CustomEvent {
  detail: StructureErrorEventDetail;
}
