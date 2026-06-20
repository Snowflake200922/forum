# 论坛 - 贴吧风格社区网站

一个轻量级的贴吧风格论坛，支持发帖（含图片）、评论、管理员管理。

## 技术栈

- **后端**: Node.js（纯内置模块，零外部依赖）
- **数据存储**: JSON 文件
- **前端**: 原生 HTML + CSS + JavaScript

## 本地运行

```bash
node server.js
```

然后浏览器打开 http://localhost:3000

## 管理员功能

点击页面右上角的 **「管理」**，输入密码 **22** 即可：
- 修改站点名称
- 删除帖子
- 删除评论

## 部署到云端（24小时在线）

### 方式一：Zeabur（推荐国内用户）

1. 访问 https://zeabur.com 注册账号
2. 创建新项目 → 选择「部署服务」
3. 选择「从 GitHub 导入」或「上传项目文件夹」
4. 系统会自动识别 Dockerfile
5. 添加环境变量：`DATA_DIR=/data`
6. 添加持久化存储，挂载到 `/data`，1GB 即可
7. 部署完成后会得到一个 `*.zeabur.app` 域名

### 方式二：Render

1. 将代码推送到 GitHub 仓库
2. 打开 https://dashboard.render.com/blueprint
3. 连接你的 GitHub 仓库
4. Render 会自动读取 `render.yaml` 配置
5. 部署完成后会得到一个 `*.onrender.com` 域名

### 方式三：Railway

1. 将代码推送到 GitHub 仓库
2. 打开 https://railway.app 并登录
3. 点击「New Project」→「Deploy from GitHub repo」
4. 选择你的仓库
5. 添加环境变量：`DATA_DIR=/data`
6. 添加卷（Volume）挂载到 `/data`
7. 部署完成

## 项目结构

```
├── server.js        # HTTP 服务器
├── db.js            # JSON 文件数据库
├── Dockerfile       # Docker 部署配置
├── render.yaml      # Render Blueprint 配置
├── public/          # 前端静态文件
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
└── uploads/         # 上传的图片
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务器端口 | `3000` |
| `DATA_DIR` | 数据持久化目录（容器部署时必填） | 项目目录 |

---

## 一键部署

[![Deploy to Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/new?repo=Snowflake200922/forum)

## 环境变量

部署后需设置：

| 变量 | 值 |
|---|---|
| `DATA_DIR` | `/data` |

## 持久化存储

挂载 `/data` 目录用于保存图片和数据。