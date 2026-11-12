import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentStoredConfig } from './types';

export function getDefaultConfigDir(): string {
  return process.env.FAULTLAB_HOME || path.join(os.homedir(), '.faultlab');
}

export function getDefaultConfigFile(): string {
  return path.join(getDefaultConfigDir(), 'agent-config.json');
}

export function getConfigPath(customPath?: string): string {
  return customPath || process.env.FAULTLAB_CONFIG_PATH || getDefaultConfigFile();
}

export function loadConfig(customPath?: string): AgentStoredConfig | null {
  const filePath = getConfigPath(customPath);
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as AgentStoredConfig;
  } catch (err) {
    return null;
  }
}

export function saveConfig(config: AgentStoredConfig, customPath?: string): void {
  const filePath = getConfigPath(customPath);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const data = JSON.stringify(config, null, 2);
  fs.writeFileSync(filePath, data, { encoding: 'utf-8', mode: 0o600 });
  try {
    // Ensure 0600 file permissions on POSIX
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Windows chmod may be a no-op or throw on some filesystems, ignore safely
  }
}

export function clearConfig(customPath?: string): boolean {
  const filePath = getConfigPath(customPath);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

