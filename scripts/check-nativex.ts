/**
 * Скрипт для проверки нативных компонентов
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const nativeXPath = join(process.cwd(), 'src', 'components', 'nativeX');
const nativePath = join(process.cwd(), 'src', 'native');

function checkFiles() {
  console.log('Checking NativeX files...\n');

  // Проверить файлы nativeX
  const nativeXFiles = [
    'Component.ts',
    'Button.ts',
    'Input.ts',
    'Card.ts',
    'AuthScreen.ts',
    'index.ts',
    'types.ts',
    'nativeX.config.ts',
    'examples.ts',
    'README.md',
  ];

  let missing: string[] = [];
  nativeXFiles.forEach(file => {
    if (!existsSync(join(nativeXPath, file))) {
      missing.push(file);
    }
  });

  if (missing.length > 0) {
    console.log('⚠️ Missing files in nativeX:');
    missing.forEach(f => console.log(`  - ${f}`));
  } else {
    console.log('✅ All nativeX files present');
  }

  // Проверить файлы native
  const nativeFiles = [
    'ScreenManager.ts',
    'EventEmitter.ts',
    'index.ts',
    'main.ts',
  ];

  missing = [];
  nativeFiles.forEach(file => {
    if (!existsSync(join(nativePath, file))) {
      missing.push(file);
    }
  });

  if (missing.length > 0) {
    console.log('\n⚠️ Missing files in native:');
    missing.forEach(f => console.log(`  - ${f}`));
  } else {
    console.log('✅ All native files present');
  }

  console.log('\nNativeX structure check complete!');
}

checkFiles();