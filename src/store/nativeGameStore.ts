/**
 * Native game store helpers (аналог Zustand без React зависимостей)
 * Simple API for working with gameStore
 */

import { gameStore } from "./gameStore";

/**
 * Subscribe to gameStore changes
 */
export function subscribeToGameStore(listener: (newState: any, prevState: any) => void): () => void {
  return gameStore.subscribe(listener);
}

/**
 * Get current state from gameStore
 */
export function getGameStoreState(): any {
  return gameStore.getState();
}

/**
 * Update gameStore state
 */
export function setGameStoreState(partial: any | ((state: any) => any | void)): void {
  gameStore.setState(partial);
}

/**
 * Extract selector from state (analog useGameStore)
 */
export function useGameStoreSelector<T>(selector: (state: any) => T): T {
  const state = gameStore.getState();
  return selector(state);
}

