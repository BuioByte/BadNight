import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { LevelError, validateLevel } from './validate.js';

export async function loadLevelFile(path) {
  return parseLevel(await readFile(path, 'utf8'), path);
}

export function parseLevel(source, filename = '<string>') {
  let raw;
  try {
    raw = parse(source);
  } catch (e) {
    throw new LevelError([`${filename}: YAML non valido: ${e.message}`]);
  }
  return validateLevel(raw);
}
