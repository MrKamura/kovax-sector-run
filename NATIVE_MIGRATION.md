# Миграция на Native UI

Этот документ описывает процесс миграции с React на нативный JavaScript UI.

## Введение

Компания Kovax Game постепенно мигрирует UI с React на нативный JavaScript. Это решение обусловлено следующими причинами:

- **Производительность**: Нативный JS работает быстрее без Virtual DOM
- **Размер**: Меньший размер bundle без React
- **Контроль**: Больше контроля над DOM и поведением
- **Простота**: Меньше зависимостей

## Архитектура

### NativeX Library

`src/components/nativeX/` содержит переиспользуемые UI компоненты:

```
nativeX/
├── Component.ts          # Базовый класс
├── Button.ts             # Кнопки
├── Input.ts              # Поля ввода
├── Card.ts               # Карточки
├── AuthScreen.ts         # Экран аутентификации
├── PlayerPanel.ts        # Панель игрока (в разработке)
├── QuestPanel.ts         # Панель квестов (в разработке)
└── ChatPanel.ts          # Чат (в разработке)
```

### Core Modules

`src/native/` содержит ядро нативной системы:

```
native/
├── ScreenManager.ts      # Управление экранами
├── EventEmitter.ts       # Система событий
└── main.ts              # Пример приложения
```

## Использование

### Базовый компонент

```typescript
import { Component } from '@/components/nativeX';

class MyComponent extends Component {
  protected createRootElement(): HTMLElement {
    return document.createElement('div');
  }
  
  protected render(): void {
    this.element.textContent = 'Hello NativeX';
  }
}
```

### Встроенные компоненты

```typescript
import { Button, Input, Card } from '@/components/nativeX';

// Кнопка
const button = new Button(document.body, {
  text: 'Нажми меня',
  onClick: () => console.log('Клик!'),
});

// Поле ввода
const input = new Input(document.body, {
  placeholder: 'Введите текст',
  onChange: (value) => console.log(value),
});

// Карточка
const card = new Card(document.body, {
  title: 'Заголовок',
});
card.setContent('<p>Содержимое</p>');
```

### События

```typescript
import { EventEmitter } from '@/native/EventEmitter';

const emitter = new EventEmitter();

// Подписаться
const unsubscribe = emitter.on('myEvent', (event) => {
  console.log(event.type, event.data);
});

// Отправить
emitter.emit('myEvent', { data: 'value' });

// Отписаться
unsubscribe();
```

### ScreenManager

```typescript
import { ScreenManager } from '@/native/ScreenManager';

const manager = new ScreenManager(document.body);
manager.addScreen('login', loginScreen);
manager.addScreen('game', gameScreen);
manager.showScreen('login');
```

## Конвертация из React

### Шаг 1: Создать класс

```typescript
// React
const MyComponent = ({ text }) => <div>{text}</div>;

// NativeX
export class MyComponent extends Component {
  private text: string;
  
  constructor(parent: HTMLElement | null, text: string) {
    super(parent);
    this.text = text;
    this.init();
  }
  
  protected createRootElement(): HTMLElement {
    const div = document.createElement('div');
    div.textContent = this.text;
    return div;
  }
}
```

### Шаг 2: Управление состоянием

```typescript
// React с useState
const [count, setCount] = useState(0);

// NativeX с свойствами
private count = 0;
private updateCountDisplay() {
  this.countElement.textContent = this.count.toString();
}
```

### Шаг 3: События

```typescript
// React
<button onClick={() => setCount(c => c + 1)}>

// NativeX
this.button.addEventListener('click', () => {
  this.count++;
  this.updateCountDisplay();
});
```

## Стратегия миграции

### Фаза 1: Базовые компоненты ✅
- [x] Component (базовый класс)
- [x] Button
- [x] Input
- [x] Card

### Фаза 2: Экраны аутентификации ✅
- [x] AuthScreen

### Фаза 3: Игровой UI
- [x] PlayerPanel
- [x] QuestPanel
- [x] ChatPanel
- [x] SettingsMenu

### Фаза 4: Интеграция с Phaser
- [ ] Game HUD
- [ ] Menu overlays
- [ ] Quest interface

## Файлы

| Файл | Описание |
|------|----------|
| `src/components/nativeX/` | UI компоненты |
| `src/native/` | Ядро системы |
| `docs/native.md` | Документация |
| `NATIVE_MIGRATION.md` | Этот файл |
| `scripts/check-nativex.ts` | Скрипт проверки |

## Лучшие практики

1. **Используйте `init()` после конструктора**
2. **Всегда вызывайте `destroy()` при очистке**
3. **Используйте `EventEmitter` для событий**
4. **Минимизируйте прямой DOM доступ**
5. **Используйте `native-` префикс для CSS**

## Troubleshooting

### Компонент не отображается

- Убедитесь, что вызвали `init()`
- Проверьте, что родительский элемент существует
- Убедитесь, что `render()` вызван

### События не срабатывают

- Проверьте `attachEventListeners()`
- Убедитесь, что `destroy()` не вызван
- Проверьте `detachEventListeners()`

## Ресурсы

- [Docs/native.md](docs/native.md)
- [nativeX/README.md](src/components/nativeX/README.md)
- [examples.ts](src/components/nativeX/examples.ts)

## Вопросы?

Смотрите `docs/native.md` или задайте вопрос в Discord.



