# РњРёРіСЂР°С†РёСЏ РЅР° Native UI

Р­С‚РѕС‚ РґРѕРєСѓРјРµРЅС‚ РѕРїРёСЃС‹РІР°РµС‚ РїСЂРѕС†РµСЃСЃ РјРёРіСЂР°С†РёРё СЃ React РЅР° РЅР°С‚РёРІРЅС‹Р№ JavaScript UI.

## Р’РІРµРґРµРЅРёРµ

РљРѕРјРїР°РЅРёСЏ Kovax Game РїРѕСЃС‚РµРїРµРЅРЅРѕ РјРёРіСЂРёСЂСѓРµС‚ UI СЃ React РЅР° РЅР°С‚РёРІРЅС‹Р№ JavaScript. Р­С‚Рѕ СЂРµС€РµРЅРёРµ РѕР±СѓСЃР»РѕРІР»РµРЅРѕ СЃР»РµРґСѓСЋС‰РёРјРё РїСЂРёС‡РёРЅР°РјРё:

- **РџСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ**: РќР°С‚РёРІРЅС‹Р№ JS СЂР°Р±РѕС‚Р°РµС‚ Р±С‹СЃС‚СЂРµРµ Р±РµР· Virtual DOM
- **Р Р°Р·РјРµСЂ**: РњРµРЅСЊС€РёР№ СЂР°Р·РјРµСЂ bundle Р±РµР· React
- **РљРѕРЅС‚СЂРѕР»СЊ**: Р‘РѕР»СЊС€Рµ РєРѕРЅС‚СЂРѕР»СЏ РЅР°Рґ DOM Рё РїРѕРІРµРґРµРЅРёРµРј
- **РџСЂРѕСЃС‚РѕС‚Р°**: РњРµРЅСЊС€Рµ Р·Р°РІРёСЃРёРјРѕСЃС‚РµР№

## РђСЂС…РёС‚РµРєС‚СѓСЂР°

### NativeX Library

`src/components/nativeX/` СЃРѕРґРµСЂР¶РёС‚ РїРµСЂРµРёСЃРїРѕР»СЊР·СѓРµРјС‹Рµ UI РєРѕРјРїРѕРЅРµРЅС‚С‹:

```
nativeX/
в”њв”Ђв”Ђ Component.ts          # Р‘Р°Р·РѕРІС‹Р№ РєР»Р°СЃСЃ
в”њв”Ђв”Ђ Button.ts             # РљРЅРѕРїРєРё
в”њв”Ђв”Ђ Input.ts              # РџРѕР»СЏ РІРІРѕРґР°
в”њв”Ђв”Ђ Card.ts               # РљР°СЂС‚РѕС‡РєРё
в”њв”Ђв”Ђ AuthScreen.ts         # Р­РєСЂР°РЅ Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё
в”њв”Ђв”Ђ PlayerPanel.ts        # РџР°РЅРµР»СЊ РёРіСЂРѕРєР° (РІ СЂР°Р·СЂР°Р±РѕС‚РєРµ)
в”њв”Ђв”Ђ QuestPanel.ts         # РџР°РЅРµР»СЊ РєРІРµСЃС‚РѕРІ (РІ СЂР°Р·СЂР°Р±РѕС‚РєРµ)
в””в”Ђв”Ђ ChatPanel.ts          # Р§Р°С‚ (РІ СЂР°Р·СЂР°Р±РѕС‚РєРµ)
```

### Core Modules

`src/native/` СЃРѕРґРµСЂР¶РёС‚ СЏРґСЂРѕ РЅР°С‚РёРІРЅРѕР№ СЃРёСЃС‚РµРјС‹:

```
native/
в”њв”Ђв”Ђ ScreenManager.ts      # РЈРїСЂР°РІР»РµРЅРёРµ СЌРєСЂР°РЅР°РјРё
в”њв”Ђв”Ђ EventEmitter.ts       # РЎРёСЃС‚РµРјР° СЃРѕР±С‹С‚РёР№
в””в”Ђв”Ђ main.ts              # РџСЂРёРјРµСЂ РїСЂРёР»РѕР¶РµРЅРёСЏ
```

## РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ

### Р‘Р°Р·РѕРІС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚

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

### Р’СЃС‚СЂРѕРµРЅРЅС‹Рµ РєРѕРјРїРѕРЅРµРЅС‚С‹

```typescript
import { Button, Input, Card } from '@/components/nativeX';

// РљРЅРѕРїРєР°
const button = new Button(document.body, {
  text: 'РќР°Р¶РјРё РјРµРЅСЏ',
  onClick: () => console.log('РљР»РёРє!'),
});

// РџРѕР»Рµ РІРІРѕРґР°
const input = new Input(document.body, {
  placeholder: 'Р’РІРµРґРёС‚Рµ С‚РµРєСЃС‚',
  onChange: (value) => console.log(value),
});

// РљР°СЂС‚РѕС‡РєР°
const card = new Card(document.body, {
  title: 'Р—Р°РіРѕР»РѕРІРѕРє',
});
card.setContent('<p>РЎРѕРґРµСЂР¶РёРјРѕРµ</p>');
```

### РЎРѕР±С‹С‚РёСЏ

```typescript
import { EventEmitter } from '@/native/EventEmitter';

const emitter = new EventEmitter();

// РџРѕРґРїРёСЃР°С‚СЊСЃСЏ
const unsubscribe = emitter.on('myEvent', (event) => {
  console.log(event.type, event.data);
});

// РћС‚РїСЂР°РІРёС‚СЊ
emitter.emit('myEvent', { data: 'value' });

// РћС‚РїРёСЃР°С‚СЊСЃСЏ
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

## РљРѕРЅРІРµСЂС‚Р°С†РёСЏ РёР· React

### РЁР°Рі 1: РЎРѕР·РґР°С‚СЊ РєР»Р°СЃСЃ

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

### РЁР°Рі 2: РЈРїСЂР°РІР»РµРЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёРµРј

```typescript
// React СЃ useState
const [count, setCount] = useState(0);

// NativeX СЃ СЃРІРѕР№СЃС‚РІР°РјРё
private count = 0;
private updateCountDisplay() {
  this.countElement.textContent = this.count.toString();
}
```

### РЁР°Рі 3: РЎРѕР±С‹С‚РёСЏ

```typescript
// React
<button onClick={() => setCount(c => c + 1)}>

// NativeX
this.button.addEventListener('click', () => {
  this.count++;
  this.updateCountDisplay();
});
```

## РЎС‚СЂР°С‚РµРіРёСЏ РјРёРіСЂР°С†РёРё

### Р¤Р°Р·Р° 1: Р‘Р°Р·РѕРІС‹Рµ РєРѕРјРїРѕРЅРµРЅС‚С‹ вњ…
- [x] Component (Р±Р°Р·РѕРІС‹Р№ РєР»Р°СЃСЃ)
- [x] Button
- [x] Input
- [x] Card

### Р¤Р°Р·Р° 2: Р­РєСЂР°РЅС‹ Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё вњ…
- [x] AuthScreen

### Р¤Р°Р·Р° 3: РРіСЂРѕРІРѕР№ UI
- [ ] PlayerPanel
- [ ] QuestPanel
- [ ] ChatPanel
- [ ] SettingsMenu

### Р¤Р°Р·Р° 4: РРЅС‚РµРіСЂР°С†РёСЏ СЃ Phaser
- [ ] Game HUD
- [ ] Menu overlays
- [ ] Quest interface

## Р¤Р°Р№Р»С‹

| Р¤Р°Р№Р» | РћРїРёСЃР°РЅРёРµ |
|------|----------|
| `src/components/nativeX/` | UI РєРѕРјРїРѕРЅРµРЅС‚С‹ |
| `src/native/` | РЇРґСЂРѕ СЃРёСЃС‚РµРјС‹ |
| `docs/native.md` | Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ |
| `NATIVE_MIGRATION.md` | Р­С‚РѕС‚ С„Р°Р№Р» |
| `scripts/check-nativex.ts` | РЎРєСЂРёРїС‚ РїСЂРѕРІРµСЂРєРё |

## Р›СѓС‡С€РёРµ РїСЂР°РєС‚РёРєРё

1. **РСЃРїРѕР»СЊР·СѓР№С‚Рµ `init()` РїРѕСЃР»Рµ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂР°**
2. **Р’СЃРµРіРґР° РІС‹Р·С‹РІР°Р№С‚Рµ `destroy()` РїСЂРё РѕС‡РёСЃС‚РєРµ**
3. **РСЃРїРѕР»СЊР·СѓР№С‚Рµ `EventEmitter` РґР»СЏ СЃРѕР±С‹С‚РёР№**
4. **РњРёРЅРёРјРёР·РёСЂСѓР№С‚Рµ РїСЂСЏРјРѕР№ DOM РґРѕСЃС‚СѓРї**
5. **РСЃРїРѕР»СЊР·СѓР№С‚Рµ `native-` РїСЂРµС„РёРєСЃ РґР»СЏ CSS**

## Troubleshooting

### РљРѕРјРїРѕРЅРµРЅС‚ РЅРµ РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ

- РЈР±РµРґРёС‚РµСЃСЊ, С‡С‚Рѕ РІС‹Р·РІР°Р»Рё `init()`
- РџСЂРѕРІРµСЂСЊС‚Рµ, С‡С‚Рѕ СЂРѕРґРёС‚РµР»СЊСЃРєРёР№ СЌР»РµРјРµРЅС‚ СЃСѓС‰РµСЃС‚РІСѓРµС‚
- РЈР±РµРґРёС‚РµСЃСЊ, С‡С‚Рѕ `render()` РІС‹Р·РІР°РЅ

### РЎРѕР±С‹С‚РёСЏ РЅРµ СЃСЂР°Р±Р°С‚С‹РІР°СЋС‚

- РџСЂРѕРІРµСЂСЊС‚Рµ `attachEventListeners()`
- РЈР±РµРґРёС‚РµСЃСЊ, С‡С‚Рѕ `destroy()` РЅРµ РІС‹Р·РІР°РЅ
- РџСЂРѕРІРµСЂСЊС‚Рµ `detachEventListeners()`

## Р РµСЃСѓСЂСЃС‹

- [Docs/native.md](docs/native.md)
- [nativeX/README.md](src/components/nativeX/README.md)
- [examples.ts](src/components/nativeX/examples.ts)

## Р’РѕРїСЂРѕСЃС‹?

РЎРјРѕС‚СЂРёС‚Рµ `docs/native.md` РёР»Рё Р·Р°РґР°Р№С‚Рµ РІРѕРїСЂРѕСЃ РІ Discord.
