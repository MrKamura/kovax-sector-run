#!/usr/bin/env node
"use strict";
console.log("[loader] Starting bootstrap-loader...");
process.on("uncaughtException", (err) => {
  console.error("UncaughtException:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("UnhandledRejection:", reason, promise);
  process.exit(1);
});
console.log("[loader] Loading bootstrap...");
require("./dist/bootstrap.js");
