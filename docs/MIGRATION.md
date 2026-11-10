# Миграция с React на нативный JS

## Обзор

Этот проект постепенно мигрируется с React на нативный JavaScript. Миграция происходит постепенно, чтобы сохранить обратную совместимость и минимизировать риски.

## Структура

### React (старый)
- `src/main.tsx` — React entry point
- `src/App.tsx` — React компоненты
- `src/components/` — React компоненты (*.tsx)

### Native JS (новый)
- `src/main-native.ts` — Native entry point
- `src/components/nativeX/` — Native компоненты (*.ts)
- `src/native/` — Native core модули
- `src/store/nativeStore.ts` — Native store (аналог Zustand)

## Архитектура

### Component Base Class
Все native компоненты расширяют базовый класс `Component`:
- `createRootElement()` — создание DOM элемента
- `render()` — рендеринг состояния
- `attachEventListeners()` / `detachEventListeners()` — управление событиями
- `show()` / `hide()` / `isVisible()` — видимость
- `destroy()` — очистка

### Store API
Native store предоставляет Zustand-совместимый API без React зависимостей:
- `createNativeStore<T>(initial)` — создание store
- `store.getState()` — получение состояния
- `store.setState()` — обновление состояния
- `store.subscribe()` — подписка на изменения

### Machine API
Native хуки предоставляют машины состояний без React зависимостей:
- `createIntroStoryMachine()` — intro story
- `createSplashMachine()` — splash screen
- `createTutorialMachine()` — tutorial progression

## Миграция компонентов

### Пошаговый процесс

1. **Создать native аналог React компонента**
   - Создать файл `src/components/nativeX/ComponentName.ts`
   - Расширить `Component` базовый класс
   - Реализовать `createRootElement()`, `render()`, `attachEventListeners()`

2. **Экспортировать компонент**
   - Добавить в `src/components/nativeX/index.ts`
   - Добавить в `src/native/index.ts`

3. **Создать миграционный слой**
   - Использовать `createMigratedComponent()` из `src/migration.ts`
   - Поддерживать оба варианта (React и Native)

4. **Тестирование**
   - Проверить функциональность
   - Сравнить с React версией
   - Обновить документацию

5. **Активировать native версию**
   - Изменить `AppConfig.useReactUI = false` в `src/config.ts`
   - Или использовать `forceNative: true` в `nativeX.config.ts`

## Конфигурация

### Глобальная конфигурация
```typescript
import { AppConfig } from './config';

AppConfig.useReactUI = false; // Использовать native JS
```

### Конфигурация NativeX
```typescript
import { setNativeXConfig } from './components/nativeX';

setNativeXConfig({
  enableMigration: true,
  forceNative: false,
});
```

## Глоссарий

- **React** — UI библиотека от Facebook
- **Native JS** — нативный JavaScript без библиотек
- **Store** — управление состоянием
- **Machine** — машина состояний (state machine)
- **Component** — UI компонент

## Чеклист миграции

- [x] AuthScreen (Login/Register)
- [x] PlayerPanel (Player stats, skills)
- [x] QuestPanel (Quest tracking)
- [x] ChatPanel (In-game chat)
- [x] NicknameScreen (Nickname selection)
- [x] ShipSelectScreen (Ship/keeper selection)
- [x] DeathOverlay (Death screen)
- [x] LevelUpOverlay (Level-up screen)
- [x] ExitOverlay (Exit countdown)
- [x] QuestCompleteOverlay (Quest completion)
- [ ] SettingsMenu (Game settings)
- [ ] TutorialOverlay (Tutorial hints)
- [ ] QuestButton (Quest button)
- [ ] TournamentButton (Tournament button)
- [ ] MutationButton (Mutation button)
- [ ] ShipChoiceCard (Ship choice card)

## Часто задаваемые вопросы

### Почему постепенная миграция?
- Минимизация рисков
- Возможность отката
- Тестирование по частям
- Совместимость с существующим кодом

### Можно ли использовать оба варианта?
Да! Миграция позволяет использовать React и Native компоненты параллельно.

### Как выбрать режим?
- `useReactUI = true` — React (по умолчанию)
- `useReactUI = false` — Native JS

## Поддержка

Для вопросов по миграции обратитесь к документации:
- `docs/architecture.md` — архитектура
- `docs/frontend.md` — frontend документация
- `docs/native.md` — native UI документация