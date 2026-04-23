// ============================================================
// Design Review MVP - 默认配置
// ============================================================

import { ToleranceConfig, OutputConfig, CaptureConfig, ReviewOptions } from './types';

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
