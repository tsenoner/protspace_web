# Architecture

## Legend Component

The legend component uses a controller-based architecture for separation of concerns.

### Controllers

**PersistenceController**

- Manages localStorage operations for legend settings
- Scopes settings by dataset hash and annotation name
- Dataset hash is computed from sorted protein IDs using djb2 algorithm

**DragController**

- Handles drag-and-drop reordering
- Supports merging items into "Other" group
- Automatically switches to manual sort mode on reorder

**ScatterplotSyncController**

- Observes scatterplot data and annotation changes
- Dispatches z-order and color mapping events
- Maintains component synchronization

### Data Processing

**LegendDataProcessor**

- Converts annotation values into legend items
- Applies persisted colors and shapes when available
- Handles category grouping and "Other" bucket
- Supports multiple sorting modes

### Storage Layer

Located in `@protspace/utils/storage`:

- Generic localStorage wrapper with type safety
- Key format: `protspace:{component}:{datasetHash}:{context}`
- Graceful error handling for quota exceeded scenarios
- djb2 hash algorithm for deterministic dataset identification

### Reactive Controllers Pattern

Controllers implement Lit's `ReactiveController` interface:

```typescript
interface ReactiveController {
  hostConnected(): void;
  hostDisconnected(): void;
}
```

Communication between controllers and host component happens through callback interfaces, enabling:

- Testability (controllers can be tested in isolation)
- Reusability (controllers can be used by other components)
- Maintainability (concerns are clearly separated)
