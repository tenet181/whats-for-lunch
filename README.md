# 中午吃什么 · 麓坊中心午餐地图

麓坊中心周边「15 分钟车程」午餐地图。同事可以打开链接填报新馆子，管理员在后台审核上架，通过后自动出现在地图 / 列表 / 抽一家三处。

## 功能

- **地图 / 列表 / 抽一家**：手绘示意图呈现周边 15 分钟圈，按车程自动区分「圈内」与「超过 15 分钟」；列表展示车程与地址；抽签只从 15 分钟内的店里抽。
- **报一家（`/submit`）**：真实地图选点（高德底图），可搜店名直接定位、用「我的位置」定位、自动反查门牌地址。无需注册，提交后返回 6 位提交码。
- **查进度（`/status/:code`）**：凭提交码查看待审核 / 已上架 / 已驳回（含理由）。
- **管理后台（`/admin`）**：登录后审核（可改字段、写驳回理由）、店铺上下架与编辑、按真实位置校准车程、公司位置校准、管理员账号管理（超管 / 审核员两级）。
- **导航**：详情页可一键跳高德 / 百度地图发起导航（移动端走 App 深链，失败回落网页版）。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | React 19 + TypeScript + Vite 7 + Tailwind v3 + shadcn/ui + Leaflet |
| 后端 | Node 20+ / Express 5，JSON 文件存储（原子写 + 写队列） |
| 鉴权 | scrypt 密码 + 服务端 Session（HttpOnly Cookie） |
| 地图 | 高德瓦片（Leaflet 渲染）+ 高德 Web 服务 API（POI 搜索 / 逆地理编码） |
| 测试 | node:test（后端 37 个用例） |

## 快速开始

```bash
cd app
npm install
cp .env.example .env     # 填入 AMAP_WEB_KEY
npm run dev              # API :8787 + Vite :3000
```

首次启动会灌入种子数据并创建管理员（用户名默认 `admin`，密码读 `ADMIN_PASSWORD`；未设置则随机生成并打印一次）。

```bash
npm test                 # 后端测试
npm run build            # 构建前端
npm start                # 生产模式，单端口同时提供页面与 API
```

环境变量见 [app/README-FEATURE.md](app/README-FEATURE.md)。

## 目录

```
app/                       H5 主应用
├── src/                   前端（pages / components / lib / hooks）
├── server/                Express 后端（路由 / 校验 / 认证 / 地图换算）
├── shared/                前后端共享的种子数据与字段上限
└── README-FEATURE.md      功能与运维说明
中午吃什么-微信小程序/        早期小程序版（静态数据，未接后端）
```

## 安全

- 密码 scrypt + 独立盐，会话 token 只存哈希；改密码/停用账号立即失效。
- 填报接口有 IP 限流、蜜罐字段、店名归一化防重。
- 外部链接只接受 http(s)；管理端写接口要求 JSON + 同源。
- 高德 Key 只在服务端使用，`.env` 与本地数据库 `server/data/db.json` 均已在 `.gitignore` 中。

## 许可

内部工具，未指定开源许可。
