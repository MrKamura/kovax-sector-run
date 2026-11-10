# Native UI Components

## Overview

The game uses **NativeX** - a custom native JS UI library for gradual migration from React.

## Structure

```
src/
в”њв”Ђв”Ђ components/
в”‚   в””в”Ђв”Ђ nativeX/           # Native UI components
в”‚       в”њв”Ђв”Ђ Component.ts   # Base class
в”‚       в”њв”Ђв”Ђ Button.ts
в”‚       в”њв”Ђв”Ђ Input.ts
в”‚       в”њв”Ђв”Ђ Card.ts
в”‚       в”њв”Ђв”Ђ AuthScreen.ts
в”‚       в”њв”Ђв”Ђ index.ts
в”‚       в””в”Ђв”Ђ nativeX.config.ts
в””в”Ђв”Ђ native/                # Core native modules
    в”њв”Ђв”Ђ ScreenManager.ts
    в”њв”Ђв”Ђ EventEmitter.ts
    в”њв”Ђв”Ђ main.ts           # Example app entry
    в””в”Ђв”Ђ index.ts
```

## Usage

```typescript
import { AuthScreen, AuthScreenEvents } from '@/components/nativeX';

const authScreen = new AuthScreen(document.body, {
  onLogin: async (email, password) => { /* ... */ },
  onRegister: async (email, password) => { /* ... */ },
});

authScreen.init();
authScreen.on(AuthScreenEvents.LOGIN, (e) => { /* ... */ });
```

## Architecture

### Component Base Class

All components extend `Component`:

- `createRootElement()` вЂ” create DOM element
- `render()` вЂ” render state
- `attachEventListeners()` / `detachEventListeners()` вЂ” event handling
- `show()` / `hide()` / `isVisible()` вЂ” visibility
- `destroy()` вЂ” cleanup

### EventEmitter

For inter-component communication:

```typescript
const emitter = new EventEmitter();
emitter.on('event', handler);
emitter.emit('event', data);
```

### ScreenManager

Manages screen transitions:

```typescript
const manager = new ScreenManager(container);
manager.addScreen('login', loginScreen);
manager.showScreen('login');
```

## Migration from React

| React | NativeX |
|-------|---------|
| `useState()` | Instance properties |
| `useEffect()` | `attachEventListeners()` |
| `props` | Constructor options |
| `children` | DOM manipulation |
| Context | `EventEmitter` |

## CSS Conventions

- Class prefix: `native-` (configurable)
- Use `nativeX.config.ts` for global settings

## Best Practices

1. Call `init()` after constructor
2. Call `destroy()` for cleanup
3. Use `EventEmitter` for events
4. Keep DOM access minimal
5. Use `nativeX/` prefix for CSS classes

## Planned Components

- PlayerPanel - Main player UI with skills ✅
- QuestPanel - Quest tracking ✅
- ChatPanel - In-game chat ✅
- SettingsMenu - Game settings
- NicknameScreen - Nickname selection ✅
- ShipSelectScreen - Ship/keeper selection ✅
- DeathOverlay - Death screen ✅
- LevelUpOverlay - Level-up screen ✅
- ExitOverlay - Exit countdown ✅
- QuestCompleteOverlay - Quest completion ✅
- TutorialOverlay - Tutorial overlays ✅
- QuestButton - Quest button ✅
- TournamentButton - Tournament button ✅
- MutationButton - Mutation button ✅

### Native Store

`src/store/nativeStore.ts` provides Zustand-compatible API without React hooks:

- `createNativeStore<T>(initial)` - Create store with initial state
- `subscribeToStore(store, listener)` - Subscribe to state changes
- `getStoreState(store)` - Get current state
- `setStoreState(store, partial)` - Update state (object or function)
- `useStoreSelector(store, selector)` - Extract selector from state

### Native Hooks

`src/hooks/` provides state machines without React dependencies:

- `createIntroStoryMachine()` - Intro story typewriter
- `createSplashMachine()` - Splash screen animation
- `createTutorialMachine()` - Tutorial progression

All machines have:
- `getState()` - Get current state
- `subscribe(listener)` - Subscribe to changes
- `enter()` / `leave()` - Lifecycle methods
- `destroy()` - Cleanup
