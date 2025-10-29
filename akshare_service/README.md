# AkShare Fund Service

基于 AkShare 的基金数据 API 服务，为前端提供：
- 基金实时估算数据
- 市场核心指标（纳斯达克、标普500、黄金、上证指数）
- QDII 基金列表

## 安装依赖

```bash
# 使用 pip 安装
pip install -r requirements.txt

# 或使用 uv (推荐，更快)
uv pip install -r requirements.txt
```

## 启动服务

### 开发模式（支持热重载）
```bash
python main.py
```

服务将运行在 `http://127.0.0.1:8000`

### 生产模式
```bash
uvicorn akshare_service.main:app --host 0.0.0.0 --port 8000
```

### 指定监听地址
```bash
# 监听所有网络接口
python main.py --host 0.0.0.0

# 监听特定 IP
python main.py --host 192.2.123.34
```

## API 文档

启动服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 端点

### 1. 获取基金信息
```
GET /fund/{code}
```

### 2. 获取基金实时估算
```
GET /fund/{code}/estimate
```

### 3. 获取 QDII 基金列表
```
GET /fund/qdii?region=欧美
```

### 4. 获取市场核心指标
```
GET /market/indexes
```
返回：纳斯达克、标普500、LBMA金价、上证指数

### 5. 服务元信息
```
GET /meta
```

## 配置前端连接

在 `example-wxt/.env.development` 中配置：
```
VITE_API_URL=http://192.2.123.34:8000
```

## 注意事项

1. AkShare 依赖网络爬虫，可能受到源站限速影响
2. 服务内置缓存机制，降低对源站压力
3. 建议在生产环境使用反向代理（Nginx）
4. 跨域问题：浏览器插件需要在 manifest 中添加 host_permissions
