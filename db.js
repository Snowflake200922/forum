import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "data.json");
const DATA_DIR = process.env.DATA_DIR || null;
const STORAGE_PATH = DATA_DIR ? join(DATA_DIR, "data.json") : DATA_PATH;

let data = null;

function loadData() {
  if (data) return data;
  if (DATA_DIR && !existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (existsSync(STORAGE_PATH)) {
    const raw = readFileSync(STORAGE_PATH, "utf-8");
    data = JSON.parse(raw);
    // 确保较新版字段存在
    if (!data.config) data.config = { site_name: "论坛", admin_password: "22" };
  } else {
    data = { posts: [], comments: [], nextPostId: 1, nextCommentId: 1, config: { site_name: "论坛", admin_password: "22" } };
    saveData();
  }
  return data;
}

function saveData() {
  if (DATA_DIR && !existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function initDB() {
  loadData();
}

// ---- Post APIs ----

export function getAllPosts() {
  const d = loadData();
  return d.posts
    .map((p) => ({
      ...p,
      comment_count: d.comments.filter((c) => c.post_id === p.id).length,
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function getPost(id) {
  const d = loadData();
  return d.posts.find((p) => p.id === id) || null;
}

export function createPost(title, content, image_url) {
  const d = loadData();
  const post = {
    id: d.nextPostId++,
    title,
    content,
    image_url: image_url || null,
    created_at: new Date().toISOString(),
  };
  d.posts.push(post);
  saveData();
  return { ...post, comment_count: 0 };
}

// ---- Comment APIs ----

export function getCommentsByPost(postId) {
  const d = loadData();
  return d.comments
    .filter((c) => c.post_id === postId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export function createComment(postId, author, content) {
  const d = loadData();
  const comment = {
    id: d.nextCommentId++,
    post_id: postId,
    author: author || "匿名用户",
    content,
    created_at: new Date().toISOString(),
  };
  d.comments.push(comment);
  saveData();
  return comment;
}

// ---- Config APIs ----

export function getConfig() {
  const d = loadData();
  return { ...d.config };
}

export function updateConfig(key, value) {
  const d = loadData();
  d.config[key] = value;
  saveData();
  return { ...d.config };
}

// ---- Admin APIs ----

export function deletePost(id) {
  const d = loadData();
  const idx = d.posts.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  d.posts.splice(idx, 1);
  // 同时删除该帖的所有评论
  d.comments = d.comments.filter((c) => c.post_id !== id);
  saveData();
  return true;
}

export function deleteComment(id) {
  const d = loadData();
  const idx = d.comments.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  d.comments.splice(idx, 1);
  saveData();
  return true;
}
