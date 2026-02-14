#!/usr/bin/env node
"use strict";
// Загружаем обработчики ДО импорта bootstrap (импорты выполняются первыми)
process.on("uncaughtException", (err) => {
  console.error("UncaughtException:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("UnhandledRejection:", reason, promise);
  process.exit(1);
});
require("./dist/bootstrap.js");
