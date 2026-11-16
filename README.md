# 中午吃什么 · 麓坊中心午餐地图

> 🔗 **在线预览（演示版）**：<https://tenet181.github.io/whats-for-lunch/> —— 不用装任何东西，手机也能直接点开。
> 演示版把店铺数据打包在前端、填报记录存在浏览器本地，**不含后台审核**；完整功能见下方「安装方法」。

一个「办公室中午吃啥」的小工具：把公司周边 15 分钟车程内的馆子收进一张地图，**同事可以随手报新店，管理员在后台审一遍再上架**，避免踩坑也避免选择困难。

## 1. 解决什么问题

- **选择困难**：临到饭点才想起「吃啥」，翻点评翻半天。这里一屏能看到周边所有馆子，还有「🎲 抽一家」帮你拍板。
- **信息散落**：好店都躺在各自的收藏夹和微信聊天记录里。这里统一收在一处，车程、人均、招牌菜、地址一眼可见。
- **新店没人维护**：改数据要动代码。这里改成**链接填报 + 后台审核**——把 `/submit` 发群里，同事自己报，管理员点一下通过就上线，不用改代码不用发版。
- **怕过期信息**：拆迁、搬迁这类提醒可以挂在店铺上（黄色警示条），下架也只是点一下。

## 2. 主要功能

### 前台（所有人）

| 页面 | 功能 |
| --- | --- |
| `/` | 三个 Tab：**地图**（手绘示意图 + 15 分钟圈，点圆点看详情）、**列表**（车程 + 地址 + 招牌菜）、**🎲 抽一家**（从 15 分钟内的店里随机抽） |
| 详情弹层 | 招牌菜、人均、车程、地址（一键复制）、一句话点评、拆迁提醒、大众点评跳转、**导航过去**（高德 / 百度） |
| `/submit` | 报一家新馆子：**在地图上点位置**（可搜店名、可用「我的位置」定位、自动带出门牌地址）→ 填招牌菜 / 人均 / 车程 / 点评链接 → 提交，拿到 6 位提交码 |
| `/status/:code` | 凭提交码查进度：待审核 / 已上架 / 已驳回（含驳回理由） |

- 车程超过 15 分钟（或没填）的店会显示为**虚线**，并且**不会进入随机抽取池**。
- 导航按钮在手机上直接拉起高德 / 百度 App；微信内置浏览器会拦截，页面会提示改用浏览器打开或复制地址。

### 后台（管理员）

| 功能 | 说明 |
| --- | --- |
| 审核 | 待审核列表，可改字段后「通过并上架」，或写理由驳回（提交人凭码能看到） |
| 店铺管理 | 上下架、编辑全部字段、补真实位置（会影响导航与车程）、手动微调示意图坐标 |
| 车程校准 | 编辑页里「按定位估算车程（直线距离）」，按真实坐标自动算 |
| 公司位置校准 | 设定换算基准点，新店按它换算到示意图的方位与距离 |
| 账号管理 | 超管 / 审核员两级，可加人、重置密码、停用 |

### 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | React 19 + TypeScript + Vite 7 + Tailwind v3 + shadcn/ui + Leaflet |
| 后端 | Node 20+ / Express 5，JSON 文件存储（原子写 + 串行写队列） |
| 鉴权 | scrypt 密码 + 服务端 Session（HttpOnly Cookie，token 只存哈希） |
| 地图 | Leaflet + 高德瓦片（GCJ-02）+ 高德 Web 服务 API（POI 搜索 / 逆地理编码） |
| 测试 | `node:test`，37 个后端用例 |

## 3. 安装方法

### 环境要求

- Node.js **20 或以上**（开发时用 24 验证）
- 一个高德「**Web 服务**」Key（可选：没有 Key 也能选点/导航，只是不能搜店名和自动反查地址）

### 步骤

```bash
git clone https://github.com/tenet181/whats-for-lunch.git
cd whats-for-lunch/app

npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 AMAP_WEB_KEY=你的高德Key
```

高德 Key 获取：<https://console.amap.com/dev/key/app> → 创建应用 → 添加 Key → 服务平台选「**Web 服务**」（不是 JS API）。

### 首次启动

```bash
npm run dev
```

- 会自动把 `shared/seed-restaurants.json` 里的 11 家店灌进数据库；
- 会自动创建一个超级管理员，用户名 `admin`；
- **没设 `ADMIN_PASSWORD` 时随机生成 12 位密码，只打印一次**，控制台里长这样：

```
[中午吃什么] API 已启动: http://127.0.0.1:8787
[中午吃什么] 数据文件: .../app/server/data/db.json
[中午吃什么] 已灌入种子数据 11 家
[中午吃什么] 已创建管理员: admin
[中午吃什么] 初始密码（只显示这一次，请立刻登录后台修改）: dHdozGYznyhS
```

### 常用命令（在 `app/` 下执行）

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 同时起 API（:8787）和 Vite（:3000），`/api` 自动代理到后端 |
| `npm run dev:web` / `npm run dev:server` | 只起其中一个 |
| `npm test` | 跑后端测试（37 个） |
| `npm run build` | 类型检查 + 构建前端到 `dist/` |
| `npm run build:demo` | 构建**演示版**（`--mode demo`：店铺数据打包进前端、填报存 localStorage），产物在 `dist/`，用于 GitHub Pages |
| `npm run deploy:demo` | 构建演示版并强推 `gh-pages` 分支，约 1 分钟后 https://tenet181.github.io/whats-for-lunch/ 生效 |
| `npm start` | 生产模式：单端口同时提供页面和 API |
| `npm run share` | 生产模式 + Cloudflare 临时公网链接，把填报页发给不在同一网络的人（先 `npm run build`；进程一停链接失效，重启会换新域名） |

### 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `8787` | 服务端口 |
| `DATA_DIR` | `app/server/data` | 数据目录（里面就一个 `db.json`） |
| `ADMIN_USERNAME` | `admin` | 仅首次建号时使用 |
| `ADMIN_PASSWORD` | 随机生成 | 仅首次建号时使用 |
| `AMAP_WEB_KEY` | 空 | 高德 Web 服务 Key，配了才能搜店名 / 反查地址 |
| `COOKIE_SECURE` | 关 | 走 HTTPS 时设 `1` |
| `TRUST_PROXY` | 关 | 在 Nginx 等反代后面时设 `1`，限流才认得到真实 IP |
| `SUBMIT_PER_HOUR` | `5` | 单 IP 每小时提交上限 |
| `LOGIN_PER_15MIN` | `10` | 单 IP 每 15 分钟登录尝试上限 |
| `GEO_PER_MINUTE` | `30` | 单 IP 每分钟地图接口上限 |

## 4. 使用方法

### 日常使用（普通同事）

1. 打开首页，用「地图 / 列表 / 抽一家」找店；点任意一家看详情，点「高德地图 / 百度地图」直接导航。
2. 发现新店 → 点右上角「**＋ 报一家**」（或收藏 `/submit` 链接）。
3. 填店名 → **在地图上点一下店的位置**（可搜店名直接定位）→ 填招牌菜、人均、车程 → 提交。
4. 记住页面给的 6 位提交码，随时到 `/status` 查进度。

### 管理员日常

1. 打开 `/admin`，用管理员账号登录（首次见上面控制台打印的密码，登录后可在「改密码」里换掉）。
2. 「**待审核**」里逐条看：信息对 → 「通过并上架」；要改 → 点「审核」改完再通过；不收录 → 「驳回」并写理由。
3. 「**店铺管理**」里可以下架、重新上架、编辑任意字段、补真实位置。
4. 把 `/submit` 链接（审核台右上角「填报链接」可一键复制）发到群里，同事就能报店了。

### 部署到服务器

```bash
cd app
npm ci
npm run build
ADMIN_PASSWORD='你的强密码' PORT=8787 npm start
```

- 单进程同时提供页面和接口，默认端口 8787。
- 建议放在 Nginx 后面并上 HTTPS；反代时设 `TRUST_PROXY=1`、`COOKIE_SECURE=1`。
- 数据就是一个文件：`app/server/data/db.json`，**备份 = 复制它**。
- 忘记管理员密码：停服务，把 `db.json` 里的 `"admins": []`、`"sessions": []` 清空，重启后会按 `ADMIN_PASSWORD` 重建。

## 5. 输入输出示例

### 5.1 网页

**报一家（`/submit`）的输入**：店名 `示例小馆`、地图点位 `30.49, 104.057786`、招牌菜 `回锅肉`、人均 `30`、车程 `20`、点评链接留空。

**输出**：跳转 `/status/8DFFKV`，显示

```
✅ 提交成功，已经进入待审核队列
示例小馆      提交码 8DFFKV      [待审核]
管理员还没处理，通常一两天内会有结果。
```

管理员通过后，同一页面变成 `[已上架]`「已经出现在地图和列表里了」，首页列表里多出一条：

```
示例小馆
回锅肉
20分钟 · 双流区华阳街道示例路 1 号
```

### 5.2 接口

统一返回 `{ ok: true, data }` 或 `{ ok: false, error: { code, message, fields? } }`。

**列出在架店铺**

```bash
curl http://127.0.0.1:8787/api/restaurants
```

```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "name": "江油肥肠",
      "direction": "华阳",
      "signature": ["红烧肥肠", "凉拌肥肠", "火爆肥肠", "肥肠豆汤"],
      "perCapita": 35,
      "driveTime": "10–13分钟",
      "address": "双流区华阳街道广都中街255号",
      "note": "华阳老街苍蝇馆子，本地人的食堂，肥肠全席闭眼点，饭点爆满要赶早。",
      "alert": null,
      "dp": "https://m.dianping.com/chengdu/ch10/g101?q=...",
      "imageUrl": null,
      "far": false,
      "x": 268, "y": 72,
      "lat": null, "lng": null
    }
  ]
}
```

> `x/y` 是示意图上的像素坐标；`lat/lng` 是真实坐标（老数据为 null）；`far` 表示车程超过 15 分钟或未知。

**提交一家新店**

```bash
curl -X POST http://127.0.0.1:8787/api/submissions \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "示例小馆",
    "address": "双流区华阳街道示例路 1 号",
    "signature": ["回锅肉"],
    "perCapita": 30,
    "driveTime": "20",
    "lat": 30.49,
    "lng": 104.057786
  }'
```

```json
{ "ok": true, "data": { "code": "8DFFKV", "id": "1344e898-..." } }
```

**查提交进度**

```bash
curl http://127.0.0.1:8787/api/submissions/8DFFKV
```

```json
{
  "ok": true,
  "data": {
    "code": "8DFFKV",
    "status": "pending",
    "name": "示例小馆",
    "direction": "华阳",
    "address": "双流区华阳街道示例路 1 号",
    "signature": ["回锅肉"],
    "createdAt": "2026-11-10T09:07:22.380Z",
    "reviewedAt": null,
    "rejectReason": null,
    "restaurantId": null,
    "history": [{ "at": "2026-11-10T09:07:22.380Z", "action": "submitted" }]
  }
}
```

**校验失败时**（缺店名、缺招牌菜、没选位置）

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION",
    "message": "表单还没填对，请检查标红的字段",
    "fields": {
      "name": "请填写店名",
      "signature": "至少填 1 个招牌菜",
      "pick": "请在地图上点一下这家店的位置"
    }
  }
}
```

**管理员登录并审核**

```bash
# 1) 登录，拿到 Cookie
curl -c cookie.txt -X POST http://127.0.0.1:8787/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"readme123"}'

# 2) 看待审核
curl -b cookie.txt 'http://127.0.0.1:8787/api/admin/submissions?status=pending'

# 3) 通过上架
curl -b cookie.txt -X POST \
  http://127.0.0.1:8787/api/admin/submissions/<id>/approve \
  -H 'Content-Type: application/json' -d '{}'
```

通过后返回新建的店铺（注意 `driveTime` 被归一化成 `20分钟`，`far` 为 `true`，坐标由真实位置换算而来）：

```json
{
  "ok": true,
  "data": {
    "submission": { "id": "1344e898-...", "status": "approved", "restaurantId": 12 },
    "restaurant": {
      "id": 12,
      "name": "示例小馆",
      "driveTime": "20分钟",
      "far": true,
      "x": 340, "y": 90,
      "lat": 30.49, "lng": 104.057786
    }
  }
}
```

**估算车程**

```bash
curl 'http://127.0.0.1:8787/api/geo/estimate?lat=30.49&lng=104.057786'
```

```json
{ "ok": true, "data": { "minutes": 7, "meters": 2896, "direction": "华阳" } }
```

### 5.3 字段限制

| 字段 | 规则 |
| --- | --- |
| 店名 | 必填，2–20 字 |
| 地图点位 | 必填（提交时自动推导方向） |
| 招牌菜 | 1–4 个，每个 1–12 字 |
| 人均 | 可选，0–999 的整数 |
| 车程 | 可选，`20` / `10-13` 会自动补成「20分钟」「10-13分钟」；空则记「待确认」 |
| 详细地址 | 可选，4–80 字 |
| 大众点评 / 图片链接 | 可选，必须是 http(s)，≤300 字符 |
| 驳回理由 | 2–200 字 |

## 目录结构

```
.
├── app/                       H5 主应用（前后端同仓）
│   ├── src/                   前端：pages / components / lib / hooks
│   ├── server/                Express 后端：routes / 校验 / 认证 / 地图换算
│   ├── shared/                前后端共享：种子数据、字段上限
│   ├── scripts/               dev 启动器、测试入口
│   └── README-FEATURE.md      更详细的运维说明（含公网临时预览）
├── .github/workflows/ci.yml   CI：npm ci + 测试 + 构建
└── 中午吃什么-微信小程序/        早期小程序版（静态数据，未接后端）
```

## 安全说明

- 密码 scrypt + 每账号独立盐，会话 token 库里只存 SHA-256；改密码 / 停用账号立即踢掉全部会话。
- 填写接口有 IP 限流、隐藏蜜罐字段、店名归一化查重（已上架或审核中同名直接 409）。
- 外部链接只接受 `http(s)://`；管理端写接口要求 `Content-Type: application/json` 且同源。
- 高德 Key 只在服务端使用，不会出现在前端；`.env` 与本地库 `server/data/db.json` 均已 `.gitignore`。

## 许可

[MIT](LICENSE) © 2026 tenet181