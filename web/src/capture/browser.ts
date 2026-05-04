// ============================================================
// 线上页面采集器
// ============================================================

import puppeteer, { Browser, Page } from 'puppeteer';
import {
  PageCaptureData,
  CapturedElement,
  NormalizedStyles,
  BoundingBox,
  CaptureConfig,
} from '../types';
import { DEFAULT_CAPTURE } from '../config';
import * as fs from 'fs';
import * as path from 'path';

// ---- 启动浏览器 ----

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
}

// ---- 页面截图 ----

export async function captureScreenshot(
  page: Page,
  outputPath: string,
  fullPage = true
): Promise<string> {
  await page.screenshot({
    path: outputPath,
    fullPage,
    type: 'png',
  });
  return outputPath;
}

// ---- 提取 DOM 元素样式 ----

const STYLE_EXTRACTION_SCRIPT = () => {
  const elements: CapturedElement[] = [];

  // 生成 CSS 选择器
  function getSelector(el: Element): string {
    if (el.id) return `#${el.id}`;
    const tag = el.tagName.toLowerCase();
    if (tag === 'body' || tag === 'html') return tag;

    const parent = el.parentElement;
    if (!parent) return tag;

    const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
    if (siblings.length === 1) {
      return `${getSelector(parent)} > ${tag}`;
    }
    const index = siblings.indexOf(el) + 1;
    return `${getSelector(parent)} > ${tag}:nth-of-type(${index})`;
  }

  // 遍历可见元素
  function walk(root: Element) {
    const rect = root.getBoundingClientRect();
    // 跳过不可见元素
    if (rect.width === 0 && rect.height === 0) return;
    if (rect.width > 5000 || rect.height > 5000) return; // 跳过超大容器

    const computed = getComputedStyle(root);
    const hidden = computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0';
    if (hidden) return;

    const selector = getSelector(root);
    const bbox: BoundingBox = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };

    const styles: NormalizedStyles = {
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      borderColor: computed.borderColor,
      fontFamily: computed.fontFamily,
      fontSize: parseFloat(computed.fontSize),
      fontWeight: parseInt(computed.fontWeight),
      lineHeight: parseFloat(computed.lineHeight),
      letterSpacing: parseFloat(computed.letterSpacing),
      paddingTop: parseFloat(computed.paddingTop),
      paddingRight: parseFloat(computed.paddingRight),
      paddingBottom: parseFloat(computed.paddingBottom),
      paddingLeft: parseFloat(computed.paddingLeft),
      gap: parseFloat(computed.gap) || undefined,
      marginTop: parseFloat(computed.marginTop),
      marginRight: parseFloat(computed.marginRight),
      marginBottom: parseFloat(computed.marginBottom),
      marginLeft: parseFloat(computed.marginLeft),
      borderRadius: parseFloat(computed.borderRadius) || undefined,
      borderWidth: parseFloat(computed.borderWidth) || undefined,
      boxShadow: computed.boxShadow !== 'none' ? computed.boxShadow : undefined,
      display: computed.display,
      flexDirection: computed.flexDirection,
      justifyContent: computed.justifyContent,
      alignItems: computed.alignItems,
      opacity: parseFloat(computed.opacity),
      zIndex: computed.zIndex !== 'auto' ? parseInt(computed.zIndex) : undefined,
    };

    // 只收集有一定面积的元素 (过滤掉微小的装饰元素)
    if (rect.width > 5 && rect.height > 5) {
      elements.push({
        selector,
        tagName: root.tagName.toLowerCase(),
        text: root.textContent?.slice(0, 100) || undefined,
        bbox,
        styles,
      });
    }

    // 递归子元素 (限制深度)
    for (const child of Array.from(root.children)) {
      walk(child);
    }
  }

  walk(document.body);
  return elements;
};

// ---- 主采集流程 ----

export class PageCapture {
  static async capture(
    pageUrl: string,
    config: CaptureConfig = DEFAULT_CAPTURE,
    outputDir = './output'
  ): Promise<PageCaptureData> {
    const capConfig = { ...DEFAULT_CAPTURE, ...config };

    // 确保输出目录存在
    fs.mkdirSync(outputDir, { recursive: true });

    console.log(`🌐 正在打开页面: ${pageUrl}`);

    const browser = await launchBrowser();
    const page = await browser.newPage();

    try {
      // 设置视口
      await page.setViewport({
        width: capConfig.viewportWidth,
        height: capConfig.viewportHeight,
      });

      // 导航到页面
      await page.goto(pageUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // 等待页面渲染完成
      await new Promise(resolve => setTimeout(resolve, capConfig.waitBeforeCapture));

      const title = await page.title();
      console.log(`📄 页面标题: ${title}`);

      // 截图
      const fullScreenshotPath = path.join(outputDir, 'page-full.png');
      const viewportScreenshotPath = path.join(outputDir, 'page-viewport.png');

      await captureScreenshot(page, fullScreenshotPath, true);
      await captureScreenshot(page, viewportScreenshotPath, false);
      console.log('📸 截图完成');

      // 提取样式
      console.log('🔍 正在提取页面元素样式...');
      const elements = await page.evaluate(STYLE_EXTRACTION_SCRIPT) as CapturedElement[];
      console.log(`✅ 提取到 ${elements.length} 个元素样式`);

      return {
        url: pageUrl,
        title,
        fullScreenshot: fullScreenshotPath,
        viewportScreenshot: viewportScreenshotPath,
        elements,
      };
    } finally {
      await browser.close();
    }
  }
}
