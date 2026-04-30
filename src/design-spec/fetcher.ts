// ============================================================
// 设计规范数据源 - 从 npm registry 提取 yzj-ui 设计 token
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import * as tar from 'child_process';

import {
  DesignSpecSource,
  DesignToken,
  ComponentSpec,
  DesignSpecData,
} from '../types';

const CACHE_DIR = path.resolve(process.cwd(), '.design-spec-cache');

export class DesignSpecFetcher {
  private source: DesignSpecSource;

  constructor(source?: DesignSpecSource) {
    this.source = source || {
      registry: 'http://npm.yzjop.com',
      packageName: 'yzj-ui',
    };
  }

  /**
   * 获取设计规范数据（带缓存）
   */
  async fetch(forceRefresh = false): Promise<DesignSpecData> {
    fs.mkdirSync(CACHE_DIR, { recursive: true });

    const cacheKey = `${this.source.packageName}@${this.source.version || 'latest'}`;
    const cacheFile = path.join(CACHE_DIR, `${cacheKey.replace(/[^a-zA-Z0-9@._-]/g, '_')}.json`);

    // 缓存 1 小时
    if (!forceRefresh && fs.existsSync(cacheFile)) {
      const stat = fs.statSync(cacheFile);
      const age = Date.now() - stat.mtimeMs;
      if (age < 60 * 60 * 1000) {
        return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      }
    }

    // 下载并解析包
    const extractDir = await this.downloadPackage();
    const specData = this.parsePackage(extractDir);

    // 写入缓存
    fs.writeFileSync(cacheFile, JSON.stringify(specData, null, 2));

    return specData;
  }

  /**
   * 从 registry 下载 tgz 并解压
   */
  private async downloadPackage(): Promise<string> {
    const { registry, packageName, version } = this.source;
    const v = version || await this.getLatestVersion();

    const tgzUrl = `${registry.replace(/\/$/, '')}/${packageName}/-/${packageName}-${v}.tgz`;
    const extractDir = path.join(CACHE_DIR, `${packageName}-${v}`);
    const tgzFile = path.join(CACHE_DIR, `${packageName}-${v}.tgz`);

    if (fs.existsSync(extractDir) && fs.readdirSync(extractDir).length > 0) {
      return extractDir;
    }

    fs.mkdirSync(extractDir, { recursive: true });

    // 下载 tgz
    await this.downloadFile(tgzUrl, tgzFile);

    // 解压
    await new Promise<void>((resolve, reject) => {
      const child = require('child_process').spawn('tar', ['xzf', tgzFile, '-C', extractDir, '--strip-components=1']);
      child.on('close', (code: number) => code === 0 ? resolve() : reject(new Error(`tar exited with code ${code}`)));
      child.on('error', reject);
    });

    // 清理 tgz
    try { fs.unlinkSync(tgzFile); } catch {}

    return extractDir;
  }

  /**
   * 获取最新版本号
   */
  private async getLatestVersion(): Promise<string> {
    const { registry, packageName } = this.source;
    const url = `${registry.replace(/\/$/, '')}/${packageName}`;

    const data = await this.fetchJSON<any>(url);
    const distTags = data['dist-tags'] || {};
    return distTags.latest || Object.keys(data.versions || {}).pop() || '1.0.0';
  }

  /**
   * 解析下载的包，提取设计 token
   */
  private parsePackage(extractDir: string): DesignSpecData {
    const tokens: DesignToken[] = [];
    const components: ComponentSpec[] = [];
    const rawParts: string[] = [];

    // 递归查找 .less / .css / .scss 文件
    const styleFiles = this.findFiles(extractDir, /\.(less|css|scss)$/);

    for (const filePath of styleFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relPath = path.relative(extractDir, filePath);

      // 提取变量定义 (@var: value; 或 --var: value;)
      const varMatches = content.matchAll(/@([\w-]+)\s*:\s*([^;]+);/g);
      const fileTokens: DesignToken[] = [];
      for (const m of varMatches) {
        const token = this.classifyToken(m[1], m[2].trim(), relPath);
        tokens.push(token);
        fileTokens.push(token);
      }

      // CSS 变量 (--var: value;)
      const cssVarMatches = content.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g);
      for (const m of cssVarMatches) {
        const token = this.classifyToken(m[1], m[2].trim(), relPath);
        tokens.push(token);
        fileTokens.push(token);
      }

      // 判断是否为组件文件（含 class 定义）
      if (content.match(/\.[\w-]+\s*\{/)) {
        const componentName = path.basename(path.dirname(filePath));
        if (componentName !== 'esm' && componentName !== 'dist') {
          components.push({
            name: componentName,
            path: relPath,
            styles: content.trim(),
            tokens: fileTokens,
          });
        }
      }

      rawParts.push(`/* ${relPath} */\n${content.trim()}`);
    }

    return {
      source: this.source,
      tokens,
      components,
      rawStyleText: rawParts.join('\n\n'),
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * 自动归类 token
   */
  private classifyToken(name: string, value: string, source: string): DesignToken {
    const nl = name.toLowerCase();
    let category: DesignToken['category'] = 'other';

    if (/color|colour|bg|background|border-color|primary|secondary|accent|success|warn|error|danger|text-color|font-color/.test(nl)) {
      category = 'color';
    } else if (/spacing|padding|margin|gap|space|offset|width|height|size/.test(nl)) {
      category = 'spacing';
    } else if (/font|text|line-height|letter/.test(nl)) {
      category = 'font';
    } else if (/radius|round|corner/.test(nl)) {
      category = 'radius';
    } else if (/shadow|elevation|depth/.test(nl)) {
      category = 'shadow';
    }

    return { name, value, category, source };
  }

  /**
   * 递归查找文件
   */
  private findFiles(dir: string, pattern: RegExp): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        results.push(...this.findFiles(fullPath, pattern));
      } else if (entry.isFile() && pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /**
   * 下载文件
   */
  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? https : http;
      const file = createWriteStream(destPath);
      mod.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            this.downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
            return;
          }
        }
        if (response.statusCode !== 200) {
          reject(new Error(`下载失败: HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', (err) => {
        try { fs.unlinkSync(destPath); } catch {}
        reject(err);
      });
    });
  }

  /**
   * Fetch JSON
   */
  private fetchJSON<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? https : http;
      mod.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            this.fetchJSON<T>(redirectUrl).then(resolve).catch(reject);
            return;
          }
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
  }
}
