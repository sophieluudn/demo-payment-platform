const esbuild = require("esbuild");

const isProduction = process.env.NODE_ENV === "production" || true;

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ["ui/element-app.js", "ui/access-app.js"],
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction, // 開發模式下可自動開啟 Sourcemap
  outdir: "ui/dist",
  format: "iife",
  target: ["es2020"],
  loader: {
    ".ttf": "file",
  },
  assetNames: "assets/[name]-[hash]",
  define: {
    "process.env.NODE_ENV": JSON.stringify(isProduction ? "production" : "development"),
    __VUE_OPTIONS_API__: "true",
    __VUE_PROD_DEVTOOLS__: "false",
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
  },
};

async function runBuild() {
  console.log("⚡ 開始使用 esbuild 打包前端資源...");
  const startTime = Date.now();

  try {
    const result = await esbuild.build(buildOptions);
    const duration = Date.now() - startTime;
    console.log(`✅ 打包完成！耗時：${duration}ms`);
  } catch (error) {
    console.error("❌ 打包過程中發生錯誤：", error);
    process.exit(1);
  }
}

runBuild();