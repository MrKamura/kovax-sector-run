import { createRoot } from "react-dom/client";
import { AppConfig, getEntryPoint, isUsingNative } from "./config";
import "./globals.css";

// Если используется нативный JS, не запускать React
if (isUsingNative()) {
  console.log('Native JS mode enabled - React not loaded');
  // Здесь можно добавить импорт native entry point
  // import('./main-native').then(({ startNativeApp }) => startNativeApp());
  // Но для постепенной миграции лучше оставить React как fallback
}

// Загрузить App компонент
import App from "./App";

// Создать React root
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
} else {
  console.error("Root element not found");
}
