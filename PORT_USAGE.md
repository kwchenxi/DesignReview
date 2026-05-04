# 📍 端口使用说明

## 端口分配

| 项目 | 端口 | 用途 | 访问方式 |
|------|------|------|----------|
| **原项目（旧版）** | **3456** | 局域网访问 | `http://your-ip:3456` |
| **公开版（新项目）** | **3457** | 本地/局域网 | `http://localhost:3457` |

## 🚀 启动方式

### 方式一：分别启动（推荐）

#### 启动原项目（旧版）
```bash
cd "/Users/hoho/Desktop/code/Claude/Design Review"
npm run web
```
**访问地址**: `http://your-ip:3456`
**说明**: 供局域网其他人访问

#### 启动公开版（新项目）
```bash
cd "/Users/hoho/Desktop/code/Claude/Design Review Public"
npm run web
```
**访问地址**: `http://localhost:3457`
**说明**: 本地使用或分享

---

### 方式二：使用管理脚本

```bash
cd "/Users/hoho/Desktop/code/Claude/Design Review"
bash manage.sh
```

然后选择：
- **选项 1**: 仅启动原项目（3456 端口）
- **选项 2**: 仅启动公开版（3457 端口）
- **选项 3**: 同时启动两个项目

---

## 🌐 局域网访问

### 原项目（旧版）- 3456 端口

**访问方式**:
```
http://your-ip:3456
```

**获取本机 IP**:
```bash
# macOS
ifconfig | grep "inet " | grep -v 127.0.0.1

# 或者
ipconfig getifaddr en0
```

**示例**:
- 如果你的 IP 是 `192.168.1.100`
- 访问地址: `http://192.168.1.100:3456`
- 局域网内其他设备可以访问

---

### 公开版（新项目）- 3457 端口

**本地访问**:
```
http://localhost:3457
```

**局域网访问**（可选）:
```
http://your-ip:3457
```

---

## ⚙️ 端口冲突处理

### 如果端口被占用

#### 修改原项目端口（不推荐）
```bash
cd "/Users/hoho/Desktop/code/Claude/Design Review"
# 编辑 .env 文件，修改 PORT=3456 为其他端口
```

#### 修改公开版端口（推荐）
```bash
cd "/Users/hoho/Desktop/code/Claude/Design Review Public"
# 编辑 .env 文件，修改 PORT=3457 为其他端口
```

---

## 🔍 检查端口占用

```bash
# 检查 3456 端口
lsof -i :3456

# 检查 3457 端口
lsof -i :3457

# 检查所有 Node.js 端口
lsof -i -P | grep LISTEN | grep node
```

---

## 📊 端口对比表

| 特性 | 原项目 (3456) | 公开版 (3457) |
|------|--------------|--------------|
| **主要用途** | 局域网共享 | 本地使用 |
| **目标用户** | 团队成员 | 个人/测试 |
| **配置方式** | 环境变量 | Web 界面 |
| **固定配置** | 硬编码公司规范 | 动态配置 |
| **访问权限** | 局域网开放 | 局域网可选 |
| **稳定性** | 高（团队使用） | 中（测试用） |

---

## 🎯 推荐使用场景

### 原项目 (3456) - 适合：
- ✅ 团队日常使用
- ✅ 固定配置的审查
- ✅ 生产环境检查
- ✅ 与设计师协作

### 公开版 (3457) - 适合：
- ✅ 个人测试新功能
- ✅ 演示给客户
- ✅ 临时审查任务
- ✅ 无配置环境使用

---

## 🔒 安全建议

### 原项目（3456）
- 📝 已配置公司规范
- 🔒 含有私有 API Key
- 🌐 局域网开放
- ⚠️ 仅限团队使用

### 公开版（3457）
- ✅ 无硬编码配置
- 🔐 用户自行配置
- 🌐 可选局域网开放
- ✅ 安全性较高

---

## 🚀 快速启动脚本

### 原项目启动脚本
```bash
cd "/Users/hoho/Desktop/code/Claude/Design Review"
npm run web
```

### 公开版启动脚本
```bash
cd "/Users/hoho/Desktop/code/Claude/Design Review Public"
npm run web
```

### Mac 双击启动
```bash
# 原项目
open "启动设计审查.command"

# 公开版
open "/Users/hoho/Desktop/code/Claude/Design Review Public/start.command"
```

---

## 📝 注意事项

1. **原项目端口 3456 必须保持不变**
   - 团队成员已习惯此端口
   - 文档和分享链接使用此端口
   - 不要随意修改

2. **公开版使用 3457 端口**
   - 避免与原项目冲突
   - 便于区分两个版本
   - 可随时修改（不推荐）

3. **同时运行两个项目**
   - 确保 CPU 和内存足够
   - 注意 Puppeteer 实例管理
   - 监控系统资源

---

## 🆘 常见问题

### Q: 局域网无法访问 3456 端口？
A: 检查防火墙设置，确保端口开放：
```bash
# macOS 检查防火墙
sudo pfctl -sr | grep 3456
```

### Q: 如何停止某个项目？
A: 使用 `Ctrl+C` 停止，或查找进程：
```bash
# 查找 3456 端口进程
lsof -ti :3456 | xargs kill -9

# 查找 3457 端口进程
lsof -ti :3457 | xargs kill -9
```

### Q: 可以修改公开版端口吗？
A: 可以，编辑 `.env` 文件中的 `PORT` 值

### Q: 两个项目可以同时运行吗？
A: 可以，但建议确保系统资源充足

---

## 📞 技术支持

如有问题，请查看：
- `PROJECT_COMPARISON.md` - 项目对比
- `PORT_USAGE.md` - 本文档

---

## 🎉 总结

- **原项目**: 3456 端口，局域网共享，团队使用
- **公开版**: 3457 端口，本地使用，灵活配置

**两个项目互不影响，可以同时运行！**
