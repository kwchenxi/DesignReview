# 🎯 端口配置说明

## ⚠️ 重要提示

**原项目（旧版）必须在 3456 端口运行，供局域网访问！**

---

## 📊 端口分配

| 项目 | 端口 | 用途 | 状态 |
|------|------|------|------|
| **原项目（旧版）** | **3456** | 局域网共享 | ✅ 固定，不可修改 |
| **公开版（新项目）** | **3457** | 本地使用 | ✅ 可选修改 |

---

## 🚀 启动方式

### 启动原项目（3456 - 必须）

```bash
cd "/Users/hoho/Desktop/code/Claude/Design Review"
npm run web
```

**访问地址**: `http://your-ip:3456`
**说明**: 供局域网其他人访问

---

### 启动公开版（3457 - 可选）

```bash
cd "/Users/hoho/Desktop/code/Claude/Design Review Public"
npm run web
```

**访问地址**: `http://localhost:3457`
**说明**: 本地使用或测试

---

### 同时启动两个项目

```bash
cd "/Users/hoho/Desktop/code/Claude/Design Review"
bash start-both.sh
```

---

## 🌐 局域网访问

### 获取本机 IP

```bash
# macOS
ifconfig | grep "inet " | grep -v 127.0.0.1

# 或
ipconfig getifaddr en0
```

### 访问原项目

假设你的 IP 是 `192.168.1.100`：
```
http://192.168.1.100:3456
```

局域网内任何设备都可以访问！

---

## ✅ 检查端口状态

```bash
# 检查 3456 端口
lsof -i :3456

# 检查 3457 端口
lsof -i :3457
```

---

## 🔒 安全说明

- **原项目**: 含有私有配置，仅供团队使用
- **公开版**: 无硬编码配置，更安全

---

## 📚 相关文档

- `PORT_USAGE.md` - 详细端口使用说明
- `PROJECT_COMPARISON.md` - 项目对比
- `start-both.sh` - 同时启动脚本

---

## 🆘 常见问题

**Q: 为什么原项目必须在 3456 端口？**
A: 局域网其他人已经使用此端口访问，修改会影响团队。

**Q: 公开版可以修改端口吗？**
A: 可以，编辑 `.env` 文件中的 `PORT` 值。

**Q: 两个项目可以同时运行吗？**
A: 可以，使用 `start-both.sh` 脚本。

---

## 📞 需要帮助？

查看完整文档：`PORT_USAGE.md`
