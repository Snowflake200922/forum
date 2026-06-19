// ---- 状态管理 ----
let currentView = "home";
let currentPostId = null;
let siteConfig = { site_name: "论坛" };
let adminToken = null;

// ---- 页面初始化 ----
document.addEventListener("DOMContentLoaded", async function () {
  await loadConfig();
  navigate("home");
});

// ---- 加载站点配置 ----
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    if (data.ok) {
      siteConfig = data.config;
      document.getElementById("siteName").textContent = siteConfig.site_name;
      document.title = siteConfig.site_name;
    }
  } catch (e) {
    console.error("加载配置失败", e);
  }
}

// ---- 导航 ----
function navigate(view, postId) {
  currentView = view;
  currentPostId = postId || null;
  document.getElementById("view-home").classList.toggle("hidden", view !== "home");
  document.getElementById("view-post").classList.toggle("hidden", view !== "post");
  if (view === "home") renderHome();
  else if (view === "post" && postId) renderPostDetail(postId);
  window.scrollTo({ top: 0 });
  return false;
}

// ---- 工具函数 ----
function formatTime(dateStr) {
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  var h = String(d.getHours()).padStart(2, "0");
  var min = String(d.getMinutes()).padStart(2, "0");
  return m + "-" + day + " " + h + ":" + min;
}

function showToast(msg) {
  var old = document.querySelector(".toast");
  if (old) old.remove();
  var toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function () { toast.remove(); }, 2500);
}

function escapeHtml(text) {
  var div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

function closeModalOnOverlay(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

// ---- 管理员 ----
function toggleAdminPanel() {
  if (adminToken) {
    showAdminRename();
  } else {
    document.getElementById("adminLoginModal").classList.remove("hidden");
    document.getElementById("adminLoginForm").reset();
  }
}

async function adminLogin(e) {
  e.preventDefault();
  var password = document.getElementById("adminPassword").value;
  try {
    var res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password }),
    });
    var data = await res.json();
    if (!data.ok) throw new Error("密码错误");
    adminToken = data.token;
    closeModal("adminLoginModal");
    document.getElementById("adminRenamePanel").classList.remove("hidden");
    document.getElementById("renameInput").value = siteConfig.site_name;
    showToast("管理员登录成功");
  } catch (err) {
    showToast("登录失败：" + err.message);
  }
}

function adminLogout() {
  adminToken = null;
  document.getElementById("adminRenamePanel").classList.add("hidden");
  updateCurrentView();
  showToast("已退出管理");
}

function showAdminRename() {
  document.getElementById("adminRenamePanel").classList.remove("hidden");
  document.getElementById("renameInput").value = siteConfig.site_name;
}

async function renameSite() {
  var name = document.getElementById("renameInput").value.trim();
  if (!name) { showToast("名称不能为空"); return; }
  try {
    var res = await fetch("/api/admin/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": adminToken },
      body: JSON.stringify({ name: name }),
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error);
    siteConfig.site_name = data.config.site_name;
    document.getElementById("siteName").textContent = siteConfig.site_name;
    document.title = siteConfig.site_name;
    showToast("改名成功！");
  } catch (err) {
    showToast("改名失败：" + err.message);
  }
}

async function deletePost(postId) {
  if (!confirm("确定删除这个帖子吗？")) return;
  try {
    var res = await fetch("/api/admin/posts/" + postId, {
      method: "DELETE",
      headers: { "Authorization": adminToken },
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error);
    showToast("帖子已删除");
    navigate("home");
  } catch (err) {
    showToast("删除失败：" + err.message);
  }
}

async function deleteComment(commentId) {
  if (!confirm("确定删除这条评论吗？")) return;
  try {
    var res = await fetch("/api/admin/comments/" + commentId, {
      method: "DELETE",
      headers: { "Authorization": adminToken },
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error);
    showToast("评论已删除");
    renderPostDetail(currentPostId);
  } catch (err) {
    showToast("删除失败：" + err.message);
  }
}

function updateCurrentView() {
  if (currentView === "home") renderHome();
  else if (currentView === "post" && currentPostId) renderPostDetail(currentPostId);
}

// ---- 发帖弹窗 ----
function showNewPostModal() {
  document.getElementById("newPostModal").classList.remove("hidden");
  document.getElementById("newPostForm").reset();
  document.getElementById("imagePreview").classList.add("hidden");
  document.getElementById("postImage").value = "";
}

function closeNewPostModal() {
  document.getElementById("newPostModal").classList.add("hidden");
}

function removeImage() {
  document.getElementById("postImage").value = "";
  document.getElementById("imagePreview").classList.add("hidden");
}

document.getElementById("postImage").addEventListener("change", function () {
  var file = this.files[0];
  var preview = document.getElementById("imagePreview");
  var img = document.getElementById("previewImg");
  if (file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      img.src = e.target.result;
      preview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  } else {
    preview.classList.add("hidden");
  }
});

// ---- 发帖（base64 图片 → JSON API） ----
async function submitNewPost(e) {
  e.preventDefault();
  var title = document.getElementById("postTitle").value.trim();
  var content = document.getElementById("postContent").value.trim();
  var imageFile = document.getElementById("postImage").files[0];
  if (!title || !content) { showToast("标题和内容不能为空"); return; }
  try {
    var image_data = null;
    if (imageFile) {
      image_data = await new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = function () { reject(new Error("图片读取失败")); };
        reader.readAsDataURL(imageFile);
      });
    }
    var res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title, content: content, image_data: image_data }),
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error);
    showToast("发帖成功！");
    closeNewPostModal();
    navigate("home");
  } catch (err) {
    showToast("发帖失败：" + err.message);
  }
}

// ---- 渲染首页（帖子列表） ----
async function renderHome() {
  var container = document.getElementById("view-home");
  container.innerHTML = '<div class="loading">加载中...</div>';
  try {
    var res = await fetch("/api/posts");
    var data = await res.json();
    if (!data.ok) throw new Error(data.error);
    var posts = data.posts;
    if (posts.length === 0) {
      container.innerHTML = [
        '<div class="empty-state">',
        "  <p>暂无帖子，快来发布第一个帖子吧！</p>",
        '  <button class="btn-primary" onclick="showNewPostModal()">+ 发帖</button>',
        "</div>",
      ].join("\n");
      return;
    }
    var html = [
      '<div class="posts-header">',
      "  <h1>最新帖子</h1>",
      '  <span class="post-count">共 ' + posts.length + " 条</span>",
      "</div>",
    ].join("\n");
    var i;
    for (i = 0; i < posts.length; i++) {
      var post = posts[i];
      var titleHtml = escapeHtml(post.title);
      var contentHtml = escapeHtml(post.content || "");
      var timeStr = formatTime(post.created_at);
      var imgHtml = post.image_url
        ? '<img class="post-card-image" src="' + post.image_url + '" alt="' + titleHtml + '" onerror="this.style.display=\'none\'" loading="lazy" />'
        : "";
      html += [
        '<div class="post-card" onclick="navigate(\'post\', ' + post.id + ')">',
        imgHtml,
        '  <div class="post-card-title">' + titleHtml + "</div>",
        '  <div class="post-card-content">' + contentHtml + "</div>",
        '  <div class="post-card-meta">',
        "    <span>" + timeStr + "</span>",
        '    <span class="comment-count">💬 ' + (post.comment_count || 0) + "</span>",
        "  </div>",
        adminToken
          ? '  <div class="post-card-actions"><button class="btn-delete" onclick="event.stopPropagation();deletePost(' + post.id + ')">删除</button></div>'
          : "",
        "</div>",
      ].join("\n");
    }
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = [
      '<div class="empty-state">',
      "  <p>加载失败：" + escapeHtml(err.message) + "</p>",
      '  <button class="btn-secondary" onclick="renderHome()">重试</button>',
      "</div>",
    ].join("\n");
  }
}

// ---- 渲染帖子详情 ----
async function renderPostDetail(postId) {
  var container = document.getElementById("view-post");
  container.innerHTML = '<div class="loading">加载中...</div>';
  try {
    var res = await fetch("/api/posts/" + postId);
    var data = await res.json();
    if (!data.ok) throw new Error(data.error);
    var post = data.post;
    var comments = data.comments;
    var titleHtml = escapeHtml(post.title);
    var contentHtml = escapeHtml(post.content || "");
    var timeStr = formatTime(post.created_at);
    var imgHtml = post.image_url
      ? '<img class="post-detail-image" src="' + post.image_url + '" alt="' + titleHtml + '" onerror="this.style.display=\'none\'" />'
      : "";
    var commentsHtml = "";
    if (comments.length === 0) {
      commentsHtml = '<div class="no-comments">暂无评论，来抢沙发吧</div>';
    } else {
      var j;
      for (j = 0; j < comments.length; j++) {
        var c = comments[j];
        var authorHtml = escapeHtml(c.author || "匿名用户");
        var commentContentHtml = escapeHtml(c.content);
        var cTime = formatTime(c.created_at);
        commentsHtml += [
          '<div class="comment-item">',
          '  <div class="comment-author">' + authorHtml + '<span class="comment-time">' + cTime + "</span></div>",
          '  <div class="comment-content">' + commentContentHtml + "</div>",
          adminToken
            ? '  <div class="comment-actions"><button class="btn-delete" onclick="deleteComment(' + c.id + ')">删除</button></div>'
            : "",
          "</div>",
        ].join("\n");
      }
    }
    container.innerHTML = [
      '<a class="back-link" onclick="navigate(\'home\')">← 返回列表</a>',
      '<div class="post-detail">',
      "  <h1>" + titleHtml + "</h1>",
      '  <div class="post-detail-meta">发布于 ' + timeStr + "</div>",
      imgHtml,
      '  <div class="post-detail-content">' + contentHtml + "</div>",
      "</div>",
      '<div class="comments-section">',
      "  <h3>评论（" + comments.length + "）</h3>",
      commentsHtml,
      '  <div class="comment-form">',
      '    <div class="comment-form-row">',
      '      <input type="text" id="commentAuthor" class="form-input" placeholder="你的昵称（可选）" maxlength="30" />',
      '      <textarea id="commentContent" class="form-textarea" placeholder="写下你的评论..." rows="2" required></textarea>',
      '      <button class="btn-primary" onclick="submitComment(' + post.id + ')">发表</button>',
      "    </div>",
      "  </div>",
      "</div>",
    ].join("\n");
  } catch (err) {
    container.innerHTML = [
      '<a class="back-link" onclick="navigate(\'home\')">← 返回列表</a>',
      '<div class="empty-state">',
      "  <p>加载失败：" + escapeHtml(err.message) + "</p>",
      '  <button class="btn-secondary" onclick="renderPostDetail(' + postId + ')">重试</button>',
      "</div>",
    ].join("\n");
  }
}

// ---- 提交评论 ----
async function submitComment(postId) {
  var authorInput = document.getElementById("commentAuthor");
  var contentInput = document.getElementById("commentContent");
  var author = (authorInput.value || "").trim();
  var content = (contentInput.value || "").trim();
  if (!content) { showToast("评论内容不能为空"); return; }
  try {
    var res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, author: author || "匿名用户", content: content }),
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error);
    showToast("评论成功！");
    renderPostDetail(postId);
  } catch (err) {
    showToast("评论失败：" + err.message);
  }
}
