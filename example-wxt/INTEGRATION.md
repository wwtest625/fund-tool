# AkShare 后端集成说明

## 概述

插件已配置支持连接本地 AkShare 后端服务，用于获取：
1. **市场核心指标**：纳斯达克、标普500、LBMA金价、上证指数
2. **基金数据**：实时估算、基础信息、QDII列表

## 配置步骤

### 1. 启动 AkShare 后端服务

```bash
cd akshare_service
python start.bat
```

服务将运行在 `http://0.0.0.0:8000` (可从局域网访问)

### 2. 环境配置

开发环境已自动配置使用本地服务：

**`.env.development`**
```env
VITE_API_URL=http://192.2.123.34:8000
```

生产环境回退到默认服务：

**`.env.production`**
```env
VITE_API_URL=https://fund.pescms.com
```

### 3. 权限配置

`wxt.config.ts` 已添加必要的网络权限：
```typescript
host_permissions: [
  'http://192.2.123.34:8000/*'  // AkShare 服务
]
```

### 4. 重新构建插件

```bash
cd example-wxt
pnpm run dev
```

## 功能验证

### 1. 检查后端服务
访问 http://192.2.123.34:8000/docs 查看 API 文档

### 2. 测试核心指标
```bash
curl http://192.2.123.34:8000/market/indexes
```

应返回：
```json
[
  {
    "id": "nasdaq",
    "name": "纳斯达克指数",
    "symbol": "^IXIC",
    "last": 18000.0,
    "change": 120.5,
    "change_percent": 0.67,
    ...
  }
]
```

### 3. 测试基金数据
```bash
curl http://192.2.123.34:8000/fund/161725/estimate
```

## 数据流向

```
浏览器插件 (PopupApp.vue)
  ↓ fetchMarketIndexes()
lib/fund-service.ts
  ↓ fetch(${API_URL}/market/indexes)
lib/constants.ts
  ↓ API_URL = import.meta.env.VITE_API_URL
.env.development
  ↓ VITE_API_URL=http://192.2.123.34:8000
AkShare 后端服务 (main.py)
  ↓ 调用 AkShare、Yahoo Finance、东方财富等数据源
返回 JSON 数据
```

## 故障排查

### 问题1: CORS 错误
**症状**: 控制台报 "Access-Control-Allow-Origin" 错误
**解决**: 
- 浏览器插件不受 CORS 限制（已在 manifest 中配置 host_permissions）
- 如果仍有问题，检查 manifest.json 是否包含正确的权限

### 问题2: 连接超时
**症状**: 控制台报 "指数数据获取失败"
**检查**:
1. 后端服务是否运行: `curl http://192.2.123.34:8000/meta`
2. 网络连接: `ping 192.2.123.34`
3. 防火墙设置: 确保 8000 端口开放

### 问题3: 数据显示 "--"
**原因**: 
- Yahoo Finance 或其他数据源限流
- 网络波动导致请求失败
**解决**: 
- 等待缓存过期后重试（60秒）
- 查看后端日志了解详细错误

## API 端点说明

| 端点 | 用途 | 使用位置 |
|------|------|----------|
| `/market/indexes` | 获取核心指标 | PopupApp.vue |
| `/fund/{code}` | 获取基金完整信息 | 待实现 |
| `/fund/{code}/estimate` | 获取实时估算 | 待实现 |
| `/fund/qdii` | QDII基金列表 | 待实现 |

## 性能优化

1. **缓存策略**
   - 市场指数: 60秒 TTL
   - 基金信息: 3600秒 TTL
   - 实时估算: 120秒 TTL

2. **并发请求**
   - 使用 Promise.all 并行获取数据
   - 单个请求失败不影响其他数据显示

3. **错误处理**
   - 友好的错误提示
   - 降级显示策略（显示 "--" 而非报错）
