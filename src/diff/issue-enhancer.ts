// ============================================================
// 问题增强器 - 基于 design-implementation-review-main skill 标准
// 为 Design Review 项目提供更详细、更结构化的问题报告
// ============================================================

import { Issue, IssueLevel, IssueCategory, NormalizedStyles, ToleranceConfig } from '../types';

// ============================================================
// 技能标准配置 (基于 issue_categories.md)
// ============================================================

export interface IssueClassificationConfig {
  // 颜色差异标准 (ΔE - CIEDE2000)
  colorDeltaEThresholds: {
    suggestion: number;   // 1.0 - 2.0
    minor: number;        // 2.0 - 10.0
    major: number;        // 10.0 - 20.0
    critical: number;     // > 20.0
  };
  
  // 尺寸和间距容差 (px)
  sizeTolerance: {
    mainComponent: number;    // 主要组件: ≤ 5px
    secondaryComponent: number; // 次要组件: ≤ 10px
    decorativeElement: number;  // 装饰元素: ≤ 15px
  };
  
  // 像素相似度分级
  pixelSimilarityThresholds: {
    excellent: number;   // ≥95%: 优秀 - 高度还原
    good: number;        // 90-94%: 良好 - 基本还原
    fair: number;        // 80-89%: 一般 - 部分差异
    poor: number;        // <80%: 较差 - 显著差异
  };
}

// 默认配置
export const DEFAULT_CLASSIFICATION_CONFIG: IssueClassificationConfig = {
  colorDeltaEThresholds: {
    suggestion: 2.0,
    minor: 10.0,
    major: 20.0,
    critical: 20.0
  },
  sizeTolerance: {
    mainComponent: 5,
    secondaryComponent: 10,
    decorativeElement: 15
  },
  pixelSimilarityThresholds: {
    excellent: 95,
    good: 90,
    fair: 80,
    poor: 80
  }
};

// ============================================================
// 问题分类器
// ============================================================

export class IssueClassifier {
  constructor(private config: IssueClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG) {}
  
  /**
   * 根据技能标准分类数值差异
   */
  classifyNumericDiff(
    delta: number,
    threshold: number,
    property: string,
    componentType: 'main' | 'secondary' | 'decorative' = 'main'
  ): IssueLevel {
    const tolerance = componentType === 'main' ? this.config.sizeTolerance.mainComponent
      : componentType === 'secondary' ? this.config.sizeTolerance.secondaryComponent
      : this.config.sizeTolerance.decorativeElement;
    
    // 决策树 (基于技能标准)
    // 1. 是否影响核心功能或可用性？
    if (this.isCriticalNumericIssue(property, delta, threshold)) {
      return 'critical';
    }
    
    // 2. 是否影响主要视觉外观或品牌识别？
    if (delta > tolerance * 2 || this.isMajorVisualIssue(property)) {
      return 'major';
    }
    
    // 3. 是否存在可察觉的视觉差异？
    if (delta > threshold) {
      return 'minor';
    }
    
    // 4. 是否可以优化改进？
    if (delta > threshold * 0.5) {
      return 'suggestion';
    }
    
    return 'suggestion';
  }
  
  /**
   * 根据技能标准分类颜色差异
   */
  classifyColorDiff(deltaE: number): IssueLevel {
    const { suggestion, minor, major, critical } = this.config.colorDeltaEThresholds;
    
    if (deltaE > critical) return 'critical';
    if (deltaE > major) return 'major';
    if (deltaE > minor) return 'minor';
    if (deltaE > suggestion) return 'suggestion';
    return 'suggestion';
  }
  
  /**
   * 分类像素相似度
   */
  classifyPixelSimilarity(similarity: number): IssueLevel {
    const { excellent, good, fair, poor } = this.config.pixelSimilarityThresholds;
    
    if (similarity < poor) return 'critical';
    if (similarity < fair) return 'major';
    if (similarity < good) return 'minor';
    if (similarity < excellent) return 'suggestion';
    return 'suggestion';
  }
  
  /**
   * 确定问题优先级 (CRITICAL/HIGH/MEDIUM/LOW)
   */
  determineSeverity(level: IssueLevel): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    switch (level) {
      case 'critical': return 'CRITICAL';
      case 'major': return 'HIGH';
      case 'minor': return 'MEDIUM';
      case 'suggestion': return 'LOW';
    }
  }
  
  /**
   * 生成问题标题
   */
  generateTitle(category: IssueCategory, property: string, componentName?: string): string {
    const categoryMap: Record<IssueCategory, string> = {
      size: '尺寸',
      color: '颜色',
      font: '字体',
      spacing: '间距',
      radius: '圆角',
      shadow: '阴影',
      layout: '布局',
      state: '交互状态'
    };
    
    const catName = categoryMap[category] || category;
    
    if (componentName) {
      return `${componentName}${property ? ` ${property}` : ''}${catName ? ` ${catName}` : ''}差异`;
    }
    
    return `${property ? property : catName}不一致`;
  }
  
  /**
   * 生成影响分析
   */
  generateImpact(level: IssueLevel, category: IssueCategory, property: string): string {
    const impactTemplates = {
      critical: {
        size: '尺寸错误导致功能无法正常使用或内容溢出',
        color: '颜色完全错误，影响可访问性和品牌识别',
        font: '字体缺失导致内容无法阅读',
        layout: '布局严重错乱，影响用户操作流程',
        spacing: '间距过大或过小导致内容重叠或无法点击',
        default: '严重影响核心功能和用户体验'
      },
      major: {
        size: '尺寸偏差明显，影响视觉平衡和美观度',
        color: '颜色偏差影响品牌一致性和专业感',
        font: '字体样式不匹配，影响阅读体验和设计统一性',
        layout: '布局错位破坏设计的视觉层次和信息结构',
        spacing: '间距不一致，影响内容的节奏感和阅读流',
        default: '显著影响视觉外观和专业印象'
      },
      minor: {
        size: '细微尺寸差异，影响设计细节的完美度',
        color: '轻微颜色偏差，在特定光照下可能被察觉',
        font: '字体细节偏差，不影响整体阅读体验',
        layout: '轻微对齐偏差，不影响功能和主要内容',
        spacing: '小间距偏差，不影响整体布局',
        default: '存在可察觉的视觉差异，但不影响核心功能'
      },
      suggestion: {
        default: '可优化项，提升设计细节和用户体验'
      }
    };
    
    const template = impactTemplates[level] as Record<string, string>;
    const impact = template[category] || template.default;
    return impact;
  }
  
  /**
   * 生成详细观察描述
   */
  generateObserved(actual: string, property: string, context?: string): string {
    const propertyMap: Record<string, string> = {
      width: '宽度',
      height: '高度',
      fontSize: '字号',
      fontWeight: '字重',
      lineHeight: '行高',
      color: '文字颜色',
      backgroundColor: '背景颜色',
      borderRadius: '圆角大小',
      padding: '内边距',
      margin: '外边距',
      gap: '间距'
    };
    
    const propName = propertyMap[property] || property;
    let observed = `观察到${propName}为 ${actual}`;
    
    if (context) {
      observed += `（${context}）`;
    }
    
    return observed;
  }
  
  /**
   * 生成修复建议
   */
  generateRecommendation(expected: string, actual: string, property: string, category: IssueCategory): string {
    const propertyMap: Record<string, string> = {
      width: 'width',
      height: 'height',
      fontSize: 'font-size',
      fontWeight: 'font-weight',
      lineHeight: 'line-height',
      color: 'color',
      backgroundColor: 'background-color',
      borderRadius: 'border-radius',
      padding: 'padding',
      margin: 'margin',
      gap: 'gap'
    };
    
    const cssProp = propertyMap[property] || property;
    
    if (category === 'layout') {
      return this.generateLayoutRecommendation(property, expected, actual);
    }
    
    if (category === 'color') {
      return `更新CSS: \`${cssProp}: ${expected};\`（当前为 ${actual}）`;
    }
    
    if (category === 'font') {
      return `更新字体样式: \`${cssProp}: ${expected};\`（当前为 ${actual}）`;
    }
    
    return `将 ${property} 从 ${actual} 调整为 ${expected}`;
  }
  
  /**
   * 生成布局相关的修复建议
   */
  private generateLayoutRecommendation(property: string, expected: string, actual: string): string {
    if (property.includes('flex') || property.includes('justify') || property.includes('align')) {
      return `更新布局属性: \`${property}: ${expected};\``;
    }
    
    if (property.includes('position') || property.includes('display')) {
      return `检查布局模型，确保使用正确的 ${property} 值: ${expected}`;
    }
    
    return `调整布局参数，从 ${actual} 改为 ${expected}`;
  }
  
  /**
   * 判断是否为严重的数值问题
   */
  private isCriticalNumericIssue(property: string, delta: number, threshold: number): boolean {
    // 影响核心功能的属性
    const criticalProperties = ['width', 'height', 'display', 'position'];
    if (criticalProperties.includes(property) && delta > threshold * 3) {
      return true;
    }
    
    // 导致内容不可读的字体问题
    if (property === 'fontSize' && delta > threshold * 4) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 判断是否为主要的视觉问题
   */
  private isMajorVisualIssue(property: string): boolean {
    const majorProperties = ['fontSize', 'fontWeight', 'color', 'backgroundColor', 'borderRadius'];
    return majorProperties.includes(property);
  }
}

// ============================================================
// 问题增强器主类
// ============================================================

export class IssueEnhancer {
  private classifier: IssueClassifier;
  
  constructor(config?: IssueClassificationConfig) {
    this.classifier = new IssueClassifier(config);
  }
  
  /**
   * 增强现有问题，添加技能标准的详细信息
   */
  enhanceIssue(
    baseIssue: Pick<Issue, 'level' | 'category' | 'property' | 'expected' | 'actual' | 'deviation' | 'suggestion' | 'id'>,
    componentName?: string,
    location?: string,
    confidence = 85
  ): Issue {
    const { level, category, property, expected, actual, deviation, suggestion, id } = baseIssue;
    
    // 生成增强字段
    const title = this.classifier.generateTitle(category, property, componentName);
    const impact = this.classifier.generateImpact(level, category, property);
    const observed = this.classifier.generateObserved(actual, property);
    const recommendation = suggestion || this.classifier.generateRecommendation(expected, actual, property, category);
    const severity = this.classifier.determineSeverity(level);
    
    // 构建增强后的问题
    const enhancedIssue: Issue = {
      id,
      level,
      category,
      property,
      expected,
      actual,
      deviation,
      suggestion: recommendation, // 使用生成的推荐
      
      // 增强字段
      title,
      location: location || componentName || '未知位置',
      observed,
      impact,
      recommendation,
      severity,
      componentName,
      confidence
    };
    
    return enhancedIssue;
  }
  
  /**
   * 从样式差异创建增强问题
   */
  createEnhancedIssueFromStyleDiff(
    property: string,
    category: IssueCategory,
    expected: string,
    actual: string,
    deviation: string,
    level: IssueLevel,
    componentName?: string,
    location?: string
  ): Issue {
    const baseId = `${componentName || 'global'}-${property}-${Date.now()}`;
    
    return this.enhanceIssue({
      id: baseId,
      level,
      category,
      property,
      expected,
      actual,
      deviation,
      suggestion: '' // 将由enhanceIssue生成
    }, componentName, location);
  }
  
  /**
   * 批量增强问题
   */
  enhanceIssues(
    issues: Array<Pick<Issue, 'level' | 'category' | 'property' | 'expected' | 'actual' | 'deviation' | 'suggestion' | 'id'>>,
    componentName?: string,
    location?: string
  ): Issue[] {
    return issues.map(issue => this.enhanceIssue(issue, componentName, location));
  }
  
  /**
   * 根据像素相似度创建整体视觉问题
   */
  createVisualDiffIssue(
    similarity: number,
    componentName: string = '整体页面',
    location: string = '整体视觉'
  ): Issue {
    const level = this.classifier.classifyPixelSimilarity(similarity);
    const title = `视觉还原度${level === 'critical' ? '严重不足' : level === 'major' ? '明显差异' : '存在差异'}`;
    const diffPct = (100 - similarity).toFixed(2);
    
    return {
      id: `visual-diff-${Date.now()}`,
      level,
      category: 'layout',
      property: '像素相似度',
      expected: '≥95%',
      actual: `${similarity.toFixed(2)}%`,
      deviation: `差异率 ${diffPct}%`,
      suggestion: '逐模块检查尺寸、颜色、间距等属性，确保与设计稿一致',
      
      // 增强字段
      title,
      location,
      observed: `页面像素级相似度为 ${similarity.toFixed(2)}%`,
      impact: this.classifier.generateImpact(level, 'layout', '像素相似度'),
      recommendation: '使用工具进行模块级对比，定位具体差异位置',
      severity: this.classifier.determineSeverity(level),
      componentName,
      confidence: 95
    };
  }
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 将技能级别转换为显示标签
 */
export function getSeverityLabel(severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'): string {
  const labels = {
    CRITICAL: '🔴 严重',
    HIGH: '🟠 主要', 
    MEDIUM: '🟡 次要',
    LOW: '🟢 建议'
  };
  return labels[severity] || severity;
}

/**
 * 获取问题类别显示名称
 */
export function getCategoryDisplayName(category: IssueCategory): string {
  const names: Record<IssueCategory, string> = {
    size: '尺寸',
    color: '颜色',
    font: '字体',
    spacing: '间距',
    radius: '圆角',
    shadow: '阴影',
    layout: '布局',
    state: '交互状态'
  };
  return names[category] || category;
}

/**
 * 计算问题优先级分数（用于排序）
 */
export function calculatePriorityScore(issue: Issue): number {
  const levelScore = {
    critical: 100,
    major: 70,
    minor: 40,
    suggestion: 10
  };
  
  const severityScore = {
    CRITICAL: 100,
    HIGH: 70,
    MEDIUM: 40,
    LOW: 10
  };
  
  const baseScore = levelScore[issue.level] || 50;
  const severityMult = severityScore[issue.severity || 'MEDIUM'] / 100;
  const confidenceMult = (issue.confidence || 50) / 100;
  
  return Math.round(baseScore * severityMult * confidenceMult);
}