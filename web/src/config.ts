// ============================================================
// Design Review Public - 默认配置
// ============================================================

import { ToleranceConfig, OutputConfig, CaptureConfig, ReviewOptions } from './types';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

export const DEFAULT_TOLERANCE: ToleranceConfig = {
  defaultNumeric: 2,
  width: 2,
  height: 2,
  fontSize: 1,
  fontWeight: 0,
  lineHeight: 2,
  letterSpacing: 0.5,
  padding: 2,
  gap: 2,
  borderRadius: 2,
  borderWidth: 1,
  opacity: 0.05,
  positionOffset: 4,
  colorDeltaE: 3.0,
  pixelMatchThreshold: 0.1,
  antialiasingTolerance: 0.1,
};

export const DEFAULT_OUTPUT: OutputConfig = {
  dir: './output',
  formats: ['html', 'markdown'],
  screenshotScale: 2,
};

export const DEFAULT_CAPTURE: CaptureConfig = {
  viewportWidth: 1440,
  viewportHeight: 900,
  waitBeforeCapture: 2000,
  interactionStates: ['hover', 'focus'],
};

export const DEFAULT_OPTIONS: ReviewOptions = {
  tolerance: DEFAULT_TOLERANCE,
  output: DEFAULT_OUTPUT,
  capture: DEFAULT_CAPTURE,
};

// ---- 运行时用户配置管理 ----

export interface UserConfig {
  figmaToken?: string;
  aiApiKey?: string;
  aiApiBase?: string;
  aiModel?: string;
  aiProvider?: string;
  designSpecUrl?: string;
}

const USER_CONFIG_FILE = 'user-config.json';

export function loadUserConfig(): UserConfig {
  try {
    const configPath = path.resolve(process.cwd(), USER_CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (error) {
    console.error('加载用户配置失败:', error);
  }
  return {};
}

export function saveUserConfig(config: UserConfig): void {
  try {
    const configPath = path.resolve(process.cwd(), USER_CONFIG_FILE);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('保存用户配置失败:', error);
  }
}

export function clearUserConfig(): void {
  try {
    const configPath = path.resolve(process.cwd(), USER_CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } catch (error) {
    console.error('清除用户配置失败:', error);
  }
}
