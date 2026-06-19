import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, extname } from "path";
import crypto from "crypto";
import { initDB, getAllPosts, getPost, createPost, getCommentsByPost, createComment, getConfig, updateConfig, deletePost, deleteComment } from "./db.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3000", 10);
const PUBLIC_DIR = join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || null;
const UPLOADS_DIR = DATA_DIR ? join(DATA_DIR, "uploads") : join(__dirname, "uploads");
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}
// ---- MIME 映射 ----
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};
// ---- 解析 JSON 请求体 ----
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("无效的 JSON 格式"));
      }
    });
    req.on("error", reject);
  });
}
// ---- 解析查询字符串 ----
function parseURL(url) {
  const idx = url.indexOf("?");
  const pathname = idx === -1 ? url : url.slice(0, idx);
  const searchParams = {};
  if (idx !== -1) {
    const qs = url.slice(idx + 1);
    for (const part of qs.split("&")) {
      const [k, v] = part.split("=").map(decodeURIComponent);
      searchParams[k] = v;
    }
  }
  return { pathname, searchParams };
}
// ---- Admin 会话管理 ----
const adminTokens = new Map();
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 小时
function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}
function verifyAdminToken(token) {
  if (!token) return false;
  const entry = adminTokens.get(token);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TOKEN_EXPIRY_MS) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}
// ---- 保存上传的图片（base64） ----
function saveBase64Image(dataUrl) {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  if (!["png", "jpg", "gif", "webp"].includes(ext)) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 5 * 1024 * 1024) return null; // 5MB
  const filename = Date.now() + "-" + Math.round(Math.random() * 1e9) + "." + ext;
  writeFileSync(join(UPLOADS_DIR, filename), buffer);
  return "/uploads/" + filename;
}
// ---- 静态文件服务 ----
function serveStatic(res, filePath) {
  try {
    if (!existsSync(filePath)) return false;
    const stat = statSync(filePath);
    if (!stat.isFile()) return false;
    const ext = extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    const content = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mime, "Content-Length": content.length });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}
// ---- 发送 JSON 响应 ----
function json(res, status, body) {
  const str = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(str) });
  res.end(str);
}
// ---- 创建 HTTP 服务器 ----
const server = createServer(async (req, res) => {
  try {
    const { pathname } = parseURL(req.url);
    const method = req.method;
    // CORS headers（本地开发）
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    // ---- API 路由 ----
    // GET /api/posts - 获取所有帖子
    if (method === "GET" && pathname === "/api/posts") {
      const posts = getAllPosts();
      return json(res, 200, { ok: true, posts });
    }
    // GET /api/posts/:id - 获取单个帖子
    const postMatch = pathname.match(/^\/api\/posts\/(\d+)$/);
    if (method === "GET" && postMatch) {
      const id = Number(postMatch[1]);
      const post = getPost(id);
      if (!post) return json(res, 404, { ok: false, error: "帖子不存在" });
      const comments = getCommentsByPost(id);
      return json(res, 200, { ok: true, post, comments });
    }
    // GET /api/config - 获取站点配置
    if (method === "GET" && pathname === "/api/config") {
      const config = getConfig();
      // 不暴露密码
      const { admin_password, ...safeConfig } = config;
      return json(res, 200, { ok: true, config: safeConfig });
    }
    // POST /api/posts - 创建帖子（支持 base64 图片）
    if (method === "POST" && pathname === "/api/posts") {
      const body = await parseBody(req);
      const { title, content, image_data } = body;
      if (!title || !content) {
        return json(res, 400, { ok: false, error: "标题和内容不能为空" });
      }
      let imageUrl = null;
      if (image_data) {
        imageUrl = saveBase64Image(image_data);
        if (!imageUrl) {
          return json(res, 400, { ok: false, error: "图片格式不支持或超过 5MB 限制" });
        }
      }
      const post = createPost(title, content, imageUrl);
      return json(res, 201, { ok: true, post });
    }
    // POST /api/comments - 创建评论
    if (method === "POST" && pathname === "/api/comments") {
      const body = await parseBody(req);
      const { post_id, author, content } = body;
      if (!post_id || !content) {
        return json(res, 400, { ok: false, error: "评论内容和帖子 ID 不能为空" });
      }
      const post = getPost(Number(post_id));
      if (!post) return json(res, 404, { ok: false, error: "帖子不存在" });
      const comment = createComment(Number(post_id), author || "匿名用户", content);
      return json(res, 201, { ok: true, comment });
    }
    // POST /api/admin/login - 管理员登录
    if (method === "POST" && pathname === "/api/admin/login") {
      const body = await parseBody(req);
      const config = getConfig();
      if (body.password === config.admin_password) {
        const token = generateToken();
        adminTokens.set(token, { createdAt: Date.now() });
        return json(res, 200, { ok: true, token });
      }
      return json(res, 403, { ok: false, error: "密码错误" });
    }
    // 以下路由需要 Admin Token 验证
    function adminOnly(fn) {
      return async () => {
        const auth = req.headers["authorization"] || req.headers["Authorization"];
        if (!auth || !verifyAdminToken(auth)) {
          return json(res, 403, { ok: false, error: "需要管理员权限" });
        }
        await fn();
      };
    }
    // POST /api/admin/rename - 修改站点名称
    if (method === "POST" && pathname === "/api/admin/rename") {
      return await adminOnly(async () => {
        const body = await parseBody(req);
        if (!body.name || !body.name.trim()) {
          return json(res, 400, { ok: false, error: "名称不能为空" });
        }
        const config = updateConfig("site_name", body.name.trim());
        return json(res, 200, { ok: true, config: { site_name: config.site_name } });
      })();
    }
    // DELETE /api/admin/posts/:id - 删除帖子
    const delPostMatch = pathname.match(/^\/api\/admin\/posts\/(\d+)$/);
    if (method === "DELETE" && delPostMatch) {
      return await adminOnly(async () => {
        const id = Number(delPostMatch[1]);
        if (!deletePost(id)) {
          return json(res, 404, { ok: false, error: "帖子不存在" });
        }
        return json(res, 200, { ok: true });
      })();
    }
    // DELETE /api/admin/comments/:id - 删除评论
    const delCommentMatch = pathname.match(/^\/api\/admin\/comments\/(\d+)$/);
    if (method === "DELETE" && delCommentMatch) {
      return await adminOnly(async () => {
        const id = Number(delCommentMatch[1]);
        if (!deleteComment(id)) {
          return json(res, 404, { ok: false, error: "评论不存在" });
        }
        return json(res, 200, { ok: true });
      })();
    }
    // ---- 静态文件服务 ----
    // 优先尝试 /uploads/
    if (pathname.startsWith("/uploads/")) {
      const filePath = join(UPLOADS_DIR, pathname.slice("/uploads/".length));
      if (serveStatic(res, filePath)) return;
      return json(res, 404, { ok: false, error: "文件不存在" });
    }
    // 尝试 public/ 目录
    const staticPath = pathname === "/" ? join(PUBLIC_DIR, "index.html") : join(PUBLIC_DIR, pathname);
    if (serveStatic(res, staticPath)) return;
    // 404
    json(res, 404, { ok: false, error: "Not Found" });
  } catch (err) {
    console.error("Server error:", err);
    json(res, 500, { ok: false, error: "服务器内部错误" });
  }
});
// ---- 启动 ----
initDB();
server.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 论坛已启动 → http://localhost:" + PORT);
});
