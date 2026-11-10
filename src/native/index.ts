// Core native modules
export { ScreenManager } from './ScreenManager';
export { EventEmitter, Event } from './EventEmitter';

// Native store (аналог Zustand без React зависимостей)
export type { StoreListener, Store, StateSelector, UseStoreOptions } from '../store/nativeStore';
export { createNativeStore, subscribeToStore, getStoreState, setStoreState, useStoreSelector } from '../store/nativeStore';

// Native hooks (аналог React хуков без React зависимостей)
export type { IntroStoryMachine, IntroStoryState } from '../hooks/nativeIntroStory';
export { createIntroStoryMachine } from '../hooks/nativeIntroStory';
export type { SplashMachine, SplashState } from '../hooks/nativeSplash';
export { createSplashMachine } from '../hooks/nativeSplash';
export type { TutorialMachine, TutorialState } from '../hooks/nativeTutorial';
export { createTutorialMachine } from '../hooks/nativeTutorial';