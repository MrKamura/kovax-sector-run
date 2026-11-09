# NativeX - Нативные JS компоненты

Эта папка содержит нативные JS компоненты для игры Kovax: Sector Run. Они используются для постепенной миграции с React на нативный JavaScript.

## Структура

```
nativeX/
├── Component.ts          # Базовый класс для всех компонентов
├── Button.ts             # Компонент кнопки
├── Input.ts              # Компонент поля ввода
├── Card.ts               # Компонент карточки
├── AuthScreen.ts         # Экран аутентификации
├── index.ts              # Экспорты всех компонентов
└── nativeX.config.ts     # Конфигурация компонентов
```

## Использование

```typescript
import { AuthScreen, AuthScreenEvents } from '@/components/nativeX';

// Создать экземпляр
const authScreen = new AuthScreen(document.body, {
  onLogin: async (email, password) => {
    // Логика входа
  },
  onRegister: async (email, password) => {
    // Логика регистрации
  },
  authLoading: false,
  authError: null,
});

// Подписаться на события
authScreen.on(AuthScreenEvents.LOGIN, (event) => {
  console.log('Login event:', event.data);
});

// Инициализировать
authScreen.init();

// Показать
authScreen.show();

// Скрыть
authScreen.hide();

// Уничтожить
authScreen.destroy();
```

## Архитектура

### Component (Базовый класс)

Все компоненты наследуются от базового класса `Component`, который предоставляет:

- Управление DOM элементами
- Методы `init()`, `render()`, `destroy()`
- Управление обработчиками событий
- Методы `show()`, `hide()`, `isVisible()`

### EventEmitter

Класс для коммуникации между компонентами:

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

Менеджер для управления экранами:

```typescript
import { ScreenManager } from '@/native/ScreenManager';

const manager = new ScreenManager(document.body);
manager.addScreen('login', loginScreen);
manager.addScreen('register', registerScreen);
manager.showScreen('login');
```

## Конвертация из React

При конвертации React компонента в нативный JS:

1. Создайте класс, наследующийся от `Component`
2. Переопределите `createRootElement()` для создания DOM
3. Переопределите `render()` для рендеринга состояния
4. Используйте `attachEventListeners()` и `detachEventListeners()` для событий
5. Используйте `EventEmitter` для коммуникации с другими компонентами

### Пример конвертации

React:
```tsx
const MyButton = ({ text, onClick }) => (
  <button className="my-button" onClick={onClick}>{text}</button>
);
```

Native JS:
```typescript
export class MyButton extends Component {
  private text: string;
  private onClick: () => void;

  constructor(parent: HTMLElement | null, text: string, onClick: () => void) {
    super(parent);
    this.text = text;
    this.onClick = onClick;
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const button = document.createElement('button');
    button.className = 'native-button';
    button.textContent = this.text;
    return button;
  }

  protected attachEventListeners(): void {
    this.element.addEventListener('click', this.onClick);
  }
}
```

## Использование вместе с React

Нативные компоненты могут использоваться параллельно с React:

```typescript
// В React компоненте
import { AuthScreen } from '@/components/nativeX';

export function MyReactComponent() {
  const authScreenRef = useRef<AuthScreen | null>(null);

  useEffect(() => {
    authScreenRef.current = new AuthScreen(document.getElementById('auth-container'), {
      onLogin: handleLogin,
    });
    authScreenRef.current.init();

    return () => {
      authScreenRef.current?.destroy();
    };
  }, []);

  return <div id="auth-container"></div>;
}
```

## Лучшие практики

1. **Используйте `init()` для инициализации** - вызывайте `init()` после создания компонента
2. **Очищайте ресурсы** - вызывайте `destroy()` при уничтожении компонента
3. **Используйте `EventEmitter`** для событий между компонентами
4. **Избегайте прямого доступа к DOM** - используйте методы компонента
5. **Следуйте命名 конвенции** - префикс `native-` для CSS классов