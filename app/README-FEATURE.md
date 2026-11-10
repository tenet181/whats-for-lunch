# 报馆子 · 填报与审核上架

在原有「中午吃什么」H5 版（React + Vite）上增加的一条闭环：

**同事/店家打开分享链接填表 → 后台待审核 → 管理员审核（可改字段）→ 通过后自动上架到地图 / 列表 / 抽一家 → 随时可下架。**

---

## 1. 跑起来

```bash
cd app
npm install

# 开发：同时启动 API(8787) 和 Vite(3000)，/api 由 Vite 代理到 8787
npm run dev

# 生产：构建后单进程同时提供页面与接口
npm run build
ADMIN_PASSWORD=换成你的密码 npm start   # http://127.0.0.1:8787
```

首次启动会：

1. 把 `shared/seed-restaurants.json` 里的 11 家老店灌进数据库；
2. 创建一个超级管理员（默认用户名 `admin`）。**没设置 `ADMIN_PASSWORD` 时会随机生成 12 位密码并只打印一次到控制台**，请立刻登录改掉。

单独启动：

```bash
npm run dev:web      # 只起 Vite
npm run dev:server   # 只起 API（node --watch）
npm test             # 后端测试（node:test，28 个用例）
```

## 2. 页面

| 地址 | 说明 |
| --- | --- |
| `/` | 主应用：地图 / 列表 / 抽一家 |
| `/submit` | **填报页**。管理员在审核台点「填报链接」即可复制这个完整地址转发到群里 |
| `/status` `/status/:code` | 凭 6 位提交码查进度（待审核 / 已上架 / 已驳回 + 驳回理由） |
| `/admin` | 审核台（未登录自动跳登录） |
| `/admin/login` | 管理员登录 |

审核台分五个标签：**待审核 / 已通过 / 已驳回 / 店铺管理 / 账号**（账号页仅超级管理员可见）。
待审核卡片可直接「直接通过」，或点「审核」打开抽屉改字段、写驳回理由后处理。

## 3. 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8787` | API / 生产页面端口 |
| `DATA_DIR` | `server/data` | 数据目录，里面就一个 `db.json` |
| `ADMIN_USERNAME` | `admin` | 仅在「库里没有任何管理员」时用于创建首个超管 |
| `ADMIN_PASSWORD` | 随机生成并打印 | 同上 |
| `COOKIE_SECURE` | 关闭 | 走 HTTPS 时设为 `1`，Cookie 加 Secure |
| `TRUST_PROXY` | 关闭 | 放在 Nginx 等反向代理后面时设为 `1`，限流才认得到真实 IP |
| `AMAP_WEB_KEY` | 空 | 高德「Web 服务」Key。配上后填报页可「搜店名 → 选中即得坐标和地址」，不配也能地图选点/导航 |
| `GEO_PER_MINUTE` | `30` | 每个 IP 每分钟地图搜索/反查上限 |
| `SUBMIT_PER_HOUR` | `5` | 单个 IP 每小时最多提交数 |
| `LOGIN_PER_15MIN` | `10` | 单个 IP 每 15 分钟登录尝试上限 |

## 4. 数据与备份

- 全部数据在 `app/server/data/db.json`：`restaurants` / `submissions` / `admins` / `sessions` / `auditLog`。
- 写入是「临时文件 + rename」原子替换，并串行化；解析失败会**直接报错退出**而不是清库——先拷一份出来看。
- 备份 = 复制这个文件。恢复 = 停服务、覆盖回文件、重启。
- **忘记管理员密码**：停服务，把 `db.json` 里的 `admins` 和 `sessions` 清空（`"admins": []`、`"sessions": []`），重启后会用 `ADMIN_PASSWORD` 重新创建首个超管。

## 5. 安全设计

- 密码：`scrypt`（N=16384）+ 每账号独立盐，`timingSafeEqual` 比对。
- 会话：32 字节随机 token，库里只存 SHA-256；Cookie `lw_admin` 为 HttpOnly + SameSite=Lax + 7 天。
- 改密码 / 停用账号会立刻踢掉该账号的所有会话。
- 管理端写接口要求 `Content-Type: application/json` 且同源（挡表单型 CSRF）。
- 填报接口：IP 限流 + 蜜罐字段 + 店名归一化防重（已上架/审核中同名直接 409）。
- 外部链接只接受 `http(s)://`，避免 `javascript:` 注入。
- 所有审核动作写 `auditLog`（保留最近 500 条）。

## 6. 接口一览

公开：`GET /api/restaurants`、`POST /api/submissions`、`GET /api/submissions/:code`

管理：`POST /api/admin/login|logout`、`GET /api/admin/me`、`POST /api/admin/me/password`、
`GET /api/admin/stats`、`GET /api/admin/submissions`、`GET|PATCH /api/admin/submissions/:id`、
`POST /api/admin/submissions/:id/approve|reject`、`GET /api/admin/restaurants`、
`PATCH /api/admin/restaurants/:id`、`GET|POST /api/admin/accounts`、`PATCH /api/admin/accounts/:id`。

统一返回 `{ ok: true, data }` 或 `{ ok: false, error: { code, message, fields? } }`。

## 7. 填报字段与地图选点

填报页（`/submit`）现在收：**店名 → 在地图上选位置 → 招牌菜 → 人均 / 车程 → 大众点评链接**。
没有「方向」也没有「联系方式」：方向由坐标自动反推。

选点用的是真实地图（Leaflet + 高德瓦片，GCJ-02）：

- 点地图落针，或点「我的位置」用浏览器定位（WGS-84 会自动转 GCJ-02，不转会偏几百米）；
- 已配好 `AMAP_WEB_KEY`（写在 `app/.env`，已 gitignore）：顶部搜索框输入店名 → 选中 → 坐标和「区+门牌」一起带回来；
  拖动/点选后也会自动反查地址（2 次重试，失败就保持手填，不打断填报）；
- 选完可再点别处换位置，地址仍可手改；
- 详情页给出「高德地图 / 百度地图」两个导航按钮：手机上先抛官方 App 深链直接拉起导航，1.4 秒没跳走就回落到网页版；桌面端直接开网页。
- 百度跳转用的是 BD-09 坐标（已从 GCJ-02 转换），否则会偏几百米。
- **微信内置浏览器会拦截 App 深链**，所以检测到微信时按钮会给出提示：复制地址去地图 App 搜，或「··· → 在浏览器打开」后再点。要做成微信里点一下就能导航，得有小程序或公众号 JS-SDK 资质。

**坐标怎么进示意图**：首页仍是那张手绘「15 分钟圈」示意图（按需求保持不变）。新店通过审核时，
用真实坐标相对「公司位置」的方位和距离换算成示意图的 `x/y`（1 分钟 ≈ 400 米，11px/分钟），
方向按方位角落到华阳/正兴/万安/略远。公司位置已校准到高德返回的「麓坊街 93 号 麓坊中心」（104.057786, 30.463952）；要是搬了办公地点，
在审核台「店铺管理 → 公司位置 → 校准」重新点一次即可。

改这条逻辑时要同时改 `server/geo.js` 和 `src/lib/geo.ts`。

## 8. 已知边界

- 单进程 + JSON 文件，适合「一个办公室的午餐清单」这个量级（几十到几百家店）。真要上量，把 `server/db.js` 换成 SQLite/Postgres 即可，其余代码不用动。
- 图片只收链接，不做上传。
- 地图底图用的是高德公开瓦片地址（免 Key），个人小工具够用；要完全走官方渠道可以换成高德 JS API（需另申请「Web端(JS API)」Key）。
- 浏览器定位需要 HTTPS + 用户授权；桌面浏览器常常拿不到，手机和微信内置浏览器一般没问题。
- 小程序版（`中午吃什么-微信小程序/`）本次未改，仍是静态数据；后续可以让它读 `GET /api/restaurants`。

## 9. 临时公网预览（Cloudflare 快速隧道）

想把页面发给别人看、又不部署服务器时：

```bash
# 1) 先起生产服务（或 npm run dev）
npm run build && ADMIN_PASSWORD=你的密码 npm start

# 2) 另开一个终端，把 8787 暴露成 https 公网地址
cloudflared tunnel --url http://127.0.0.1:8787 --protocol http2
# 输出里那行 https://xxx-xxx.trycloudflare.com 就是可分享的地址
```

- 每次重启地址都会变；官方明确不保证在线时长，只适合临时预览。
- 走 HTTPS 时建议给服务加 `COOKIE_SECURE=1`；反过来，如果在 http 地址上访问，加了 Secure 会登录不上。
- 隧道会把**整个站点**（含 `/admin`）暴露到公网，预览期请用强密码，看完记得关掉进程。
- `--protocol http2` 在部分网络下比默认 quic 稳；如果连不上就两个都试试。