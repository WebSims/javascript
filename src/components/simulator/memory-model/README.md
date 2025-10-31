# Memory Model Visualization Architecture

## Overview

The JSX-based memory visualization is built with a clean, modular architecture using custom React hooks. This separates concerns between data transformation, animation logic, and rendering.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│          JsxVisualizer Component                    │
│  (Presentation - Renders UI using components)       │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ uses
                  ▼
┌─────────────────────────────────────────────────────┐
│        useJsxVisualization Hook                     │
│  (Orchestration - Coordinates hooks & manages flow) │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
           │ uses                     │ uses
           ▼                          ▼
┌──────────────────────┐    ┌────────────────────────┐
│ useVisualizationData │    │ useMemvalAnimations    │
│  - Transform data    │    │  - Sequential anims    │
│  - Calculate layout  │    │  - Push/Pop handling   │
│  - ELK integration   │    │  - Timing control      │
└──────────────────────┘    └────────────────────────┘
```

## Hooks Structure

### 1. `useMemvalAnimations`
**Purpose:** Handles sequential memval animations

**Responsibilities:**
- Process memval changes (push/pop) one at a time
- Apply slide-in animation for push operations (500ms)
- Apply fade-out animation for pop operations (500ms)
- Maintain animation order and timing
- Provide cleanup mechanism

**Key Functions:**
- `processSequentially()`: Processes changes in order with callbacks
- `clearAnimations()`: Cancels pending animations

**Example:**
```typescript
const { processSequentially, clearAnimations } = useMemvalAnimations()

processSequentially(changes, baseMemval, {
  onUpdate: (updated) => setMemval(updated),
  onComplete: () => console.log('All animations done!')
})
```

---

### 2. `useVisualizationData`
**Purpose:** Transforms memory snapshots into visualization data

**Responsibilities:**
- Transform raw memory snapshots into UI-ready structures
- Create memval, heap, and scope data models
- Generate connection definitions
- Calculate layout using ELK (Eclipse Layout Kernel)
- Apply positioning to all elements

**Key Functions:**
- `transformMemorySnapshot()`: Converts ExecutionStep → VisualizationData
- `calculateLayout()`: Applies ELK layout algorithm

**Data Flow:**
```
ExecutionStep → transformMemorySnapshot() → VisualizationData
VisualizationData → calculateLayout() → Positioned VisualizationData
```

---

### 3. `useJsxVisualization`
**Purpose:** Main orchestration hook that coordinates everything

**Responsibilities:**
- Detect step changes (forward/backward/jump)
- Coordinate data transformation and animation
- Manage visualization state
- Handle different navigation scenarios

**Logic Flow:**

#### For Single Forward Step:
1. Transform new memory snapshot
2. Calculate layout for heap and scopes
3. Keep previous memval state initially
4. Process memval changes sequentially with animations
5. Update state after each animation

#### For Jumps/Backward/Initial:
1. Transform memory snapshot
2. Calculate layout
3. Render immediately (no animations)

**Example:**
```typescript
const visualizationData = useJsxVisualization(currentStep, steps)
// Returns: { memval, heap, scopes, connections }
```

---

## Component Structure

### `JsxVisualizer`
**Purpose:** Main component for JSX-based visualization

**Responsibilities:**
- Use `useJsxVisualization` hook
- Render memval, heap, and scope components
- Handle loading state

**Code:**
```typescript
export const JsxVisualizer = () => {
    const { currentStep, steps } = useSimulatorStore()
    const visualizationData = useJsxVisualization(currentStep, steps)
    
    if (!visualizationData) return <Loading />
    
    return (
        <div>
            <MemVal memval={visualizationData.memval} />
            <Heap heap={visualizationData.heap} />
            <Scope scopes={visualizationData.scopes} />
        </div>
    )
}
```

---

## Animation Flow Examples

### Forward Step Animation

Given memval changes:
```json
[
    { "type": "pop", "value": { "type": "primitive", "value": 2 } },
    { "type": "pop", "value": { "type": "primitive", "value": 1 } },
    { "type": "push", "value": { "type": "primitive", "value": 3 } }
]
```

**Timeline:**
```
t=0ms     → Item with value 2 starts fade-out
t=500ms   → Item with value 2 removed from DOM
            → Item with value 1 starts fade-out
t=1000ms  → Item with value 1 removed from DOM
            → New item with value 3 starts slide-in (from left)
t=1500ms  → All animations complete
```

### Backward Step Animation

When going backward from the above step, changes are reversed:

**Original changes:**
```json
[
    { "type": "pop", "value": 2 },
    { "type": "pop", "value": 1 },
    { "type": "push", "value": 3 }
]
```

**Reversed changes (applied in backward):**
```json
[
    { "type": "pop", "value": 3 },    // Remove the pushed item
    { "type": "push", "value": 1 },   // Add back the popped item
    { "type": "push", "value": 2 }    // Add back the popped item
]
```

**Timeline:**
```
t=0ms     → Item with value 3 starts fade-out (was pushed, now removed)
t=500ms   → Item with value 3 removed from DOM
            → Item with value 1 starts fade-in (was popped, now added back)
t=1000ms  → Item with value 1 fully visible
            → Item with value 2 starts fade-in (was popped, now added back)
t=1500ms  → All animations complete
```

---

## Key Design Decisions

### ✅ Separation of Concerns
- **Data transformation** is separate from **animation logic**
- **Animation timing** is separate from **rendering**
- Each hook has a single, well-defined responsibility

### ✅ Composability
- Hooks can be tested independently
- Easy to swap implementations (e.g., different animation strategies)
- New visualization modes can reuse existing hooks

### ✅ Clean Component
- Component is purely presentational (28 lines)
- All logic is in hooks
- Easy to understand and maintain

### ✅ Type Safety
- Full TypeScript typing throughout
- Shared interfaces between hooks
- Compile-time error checking

---

## CSS Animations

Defined in `src/index.css`:

```css
@keyframes slide-in {
  from {
    transform: translateX(-120px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

Applied via classes:
- `.animate-slide-in` - For push operations in forward navigation - slides from left to right
- `.animate-fade-in` - For push operations in backward navigation (adding items back)
- `.animate-fade-out` - For pop operations (forward) and push reversals (backward)

---

## Testing Strategy

Each hook can be tested independently:

1. **useMemvalAnimations**: Test animation sequencing and timing
2. **useVisualizationData**: Test data transformation and layout
3. **useJsxVisualization**: Test step detection and coordination

---

## Future Enhancements

Potential improvements:
- Add backward step animations
- Configurable animation duration
- Pause/resume animation support
- Animation presets (fast/slow/none)
- Accessibility improvements (reduced motion)

---

## Related Files

- `/src/hooks/useMemvalAnimations.ts` - Animation logic
- `/src/hooks/useVisualizationData.ts` - Data transformation
- `/src/hooks/useJsxVisualization.ts` - Main orchestration
- `/src/components/simulator/memory-model/jsx-visualizer.tsx` - Component
- `/src/components/simulator/memory-model/components/MemVal.tsx` - Memval renderer
- `/src/index.css` - Animation styles

