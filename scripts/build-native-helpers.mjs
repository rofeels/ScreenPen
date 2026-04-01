import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { chmod, mkdir } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const nativeRoot = path.join(projectRoot, 'electron', 'native');

if (process.platform !== 'darwin') {
  console.log('[build-native-helpers] Skipping: host platform is not macOS.');
  process.exit(0);
}

// Use the host macOS version as the deployment target so ScreenCaptureKit
// binaries are linked correctly for the running OS (critical on macOS 26+).
const hostMacosVersion = os.release().split('.').map(Number);
const darwinMajor = hostMacosVersion[0] ?? 24;
// Darwin 25 = macOS 26, Darwin 24 = macOS 15, Darwin 23 = macOS 14
const macosMinTarget = darwinMajor >= 25 ? '26.0' : darwinMajor >= 24 ? '15.0' : '14.0';

const archTag = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
const outputDir = path.join(nativeRoot, 'bin', archTag);

const helpers = [
  {
    source: 'ScreenCaptureKitRecorder.swift',
    output: 'openscreen-screencapturekit-helper',
  },
  {
    source: 'ScreenCaptureKitWindowList.swift',
    output: 'openscreen-window-list',
  },
  {
    source: 'SystemCursorAssets.swift',
    output: 'openscreen-system-cursors',
  },
  {
    source: 'NativeCursorMonitor.swift',
    output: 'openscreen-native-cursor-monitor',
  },
];

const swiftcCheck = spawnSync('swiftc', ['--version'], { encoding: 'utf8' });
if (swiftcCheck.status !== 0) {
  const details = [swiftcCheck.stderr, swiftcCheck.stdout].filter(Boolean).join('\n').trim();
  throw new Error(details || 'swiftc is unavailable; install Xcode Command Line Tools.');
}

await mkdir(outputDir, { recursive: true });

for (const helper of helpers) {
  const sourcePath = path.join(nativeRoot, helper.source);
  const outputPath = path.join(outputDir, helper.output);

  const frameworks = helper.source === 'ScreenCaptureKitRecorder.swift'
    ? ['-framework', 'ScreenCaptureKit', '-framework', 'AppKit', '-framework', 'CoreMedia', '-framework', 'AVFoundation']
    : [];

  const result = spawnSync('swiftc', [
    '-O',
    '-target', process.arch === 'arm64' ? `arm64-apple-macos${macosMinTarget}` : `x86_64-apple-macos${macosMinTarget}`,
    sourcePath,
    '-o', outputPath,
    ...frameworks
  ], {
    encoding: 'utf8',
    timeout: 120000,
  });

  if (result.status !== 0) {
    const details = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    throw new Error(details || `Failed to compile ${helper.source}`);
  }

  await chmod(outputPath, 0o755);
  console.log(`[build-native-helpers] Built ${helper.output} -> ${outputPath}`);
}

