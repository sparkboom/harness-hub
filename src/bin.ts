#!/usr/bin/env node
// src/bin.ts
import { main } from './cli';

main(process.argv.slice(2)).then(
  (exitCode) => process.exit(exitCode),
  (err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
);
