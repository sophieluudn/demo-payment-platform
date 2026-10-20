const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = 4173;
const HOST = "127.0.0.1";
const ROOT_DIR = __dirname;

// MIME Types 支援對照表
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
};

/**
  驗證請求檔案路徑是否安全（防止 Path Traversal 攻擊）
 */
const isPathSafe = (filePath) => {
  const normalizedRoot = path.resolve(ROOT_DIR).toLowerCase();
  const normalizedFile = path.resolve(filePath).toLowerCase();

  // 1. 確保檔案落在根目錄之內
  if (!normalizedFile.startsWith(normalizedRoot + path.sep)) {
    return false;
  }
  // 2. 排除 node_modules 目錄
  if (normalizedFile.includes(`${path.sep}node_modules${path.sep}`)) {
    return false;
  }
  return true;
};

// 建立 HTTP 伺服器
const server = http.createServer(async (req, res) => {
  const sendError = (statusCode) => {
    res.writeHead(statusCode).end();
  };

  // 1. 解析 URL 路徑
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
  } catch {
    return sendError(400);
  }

  // 2. 對應真實檔案路徑 (預設為 /index.html)
  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(ROOT_DIR, relativePath);
  const ext = path.extname(filePath).toLowerCase();

  // 3. 安全與副檔名檢查
  if (!isPathSafe(filePath) || !MIME_TYPES[ext]) {
    return sendError(404);
  }

  // 4. 讀取並回應檔案內容
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext],
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch {
    sendError(404);
  }
});

// 啟動伺服器
server.listen(PORT, HOST, () => {
  console.log(`金流平台 Demo：http://${HOST}:${PORT}`);
});