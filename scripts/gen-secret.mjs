#!/usr/bin/env node
import { randomBytes } from "node:crypto";

function parseArgs(argv) {
  const options = {
    bytes: 48,
    count: 1
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--bytes" && argv[index + 1]) {
      options.bytes = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--count" && argv[index + 1]) {
      options.count = Number(argv[index + 1]);
      index += 1;
      continue;
    }
  }

  if (!Number.isInteger(options.bytes) || options.bytes < 16) {
    throw new Error("--bytes must be an integer >= 16");
  }

  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new Error("--count must be an integer >= 1");
  }

  return options;
}

function toBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

try {
  const { bytes, count } = parseArgs(process.argv.slice(2));
  for (let index = 0; index < count; index += 1) {
    console.log(toBase64Url(randomBytes(bytes)));
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
