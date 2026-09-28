#!/usr/bin/env node
/**
 * GitHub 中文化扩展 —— 端到端验证
 *
 * 光有"语法正确"不算数：必须证明它**真的把 GitHub 界面翻译成了中文**。
 * 本测试用 jsdom 构造一个仿 GitHub 页面，按 manifest 声明顺序加载三个
 * content script，然后检查英文文案有没有被替换。
 *
 * 用法：node tools/verify-github-cn.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

// 默认扩展目录：优先取环境变量，否则取 D:\github-chinese-extension
const DEFAULT_EXT = process.env.GHCN_EXT || 'D:\\github-chinese-extension';
const EXT = process.argv[2] || DEFAULT_EXT;

const results = [];
const check = (name, pass, detail) => results.push({ name, pass: !!pass, detail: detail || '' });

// 仿 GitHub 仓库页（含导航、按钮、侧栏等真实英文文案）
//
// 关键：必须包含 GitHub 真实页面上的两个特征，否则脚本识别不出页面类型、
// 直接跳过翻译（实测踩过）：
//   1. <meta name="analytics-location" content="/<user-name>/<repo-name>">
//      —— 脚本靠它判断这是仓库页
//   2. <body class="logged-in">
//      —— 脚本靠它判断登录态（影响首页是 dashboard 还是 homepage）
const HTML = `<!DOCTYPE html>
<html lang="en"><head><title>test/repo: test</title>
<meta name="analytics-location" content="/&lt;user-name&gt;/&lt;repo-name&gt;">
</head>
<body class="logged-in">
  <header class="AppHeader">
    <nav>
      <a href="/">Home</a>
      <a href="/pulls">Pull requests</a>
      <a href="/issues">Issues</a>
      <a href="/marketplace">Marketplace</a>
      <a href="/explore">Explore</a>
    </nav>
    <button>Sign in</button>
    <button>Sign up</button>
  </header>
  <main>
    <div class="repository-content">
      <span>Watch</span>
      <span>Fork</span>
      <span>Star</span>
      <button>Code</button>
      <h2>About</h2>
      <p>Releases</p>
      <p>Packages</p>
      <p>Contributors</p>
      <p>Languages</p>
    </div>
    <div class="file-navigation">
      <button>Go to file</button>
      <button>Add file</button>
      <span>Latest commit</span>
      <span>History</span>
    </div>
    <section class="settings">
      <h3>Settings</h3>
      <span>Notifications</span>
      <span>Appearance</span>
      <span>Accessibility</span>
    </section>
  </main>
  <footer>
    <a href="/site/terms">Terms</a>
    <a href="/site/privacy">Privacy</a>
    <a href="/site/security">Security</a>
    <a href="/site/status">Status</a>
  </footer>
</body></html>`;

// jsdom 缺少的浏览器 API，按需补上（不补会误判成脚本缺陷）
function makeDom(url) {
    const dom = new JSDOM(HTML, {
        url,
        pretendToBeVisual: true,
        runScripts: 'outside-only',
    });
    const w = dom.window;
    w.scrollTo = () => {};
    if (!w.requestIdleCallback) w.requestIdleCallback = (cb) => w.setTimeout(() => cb({ didTimeout: false }), 0);
    if (!w.cancelIdleCallback) w.cancelIdleCallback = (id) => w.clearTimeout(id);
    return dom;
}

/** 按 manifest 顺序加载 content scripts（与浏览器行为一致：同一隔离世界） */
function loadExtension(dom, extDir) {
    const manifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
    const files = manifest.content_scripts[0].js;
    const ctx = dom.getInternalVMContext();
    const loaded = [];
    for (const f of files) {
        const src = fs.readFileSync(path.join(extDir, f), 'utf8');
        try {
            vm.runInContext(src, ctx, { filename: f });
            loaded.push(f);
        } catch (e) {
            // 记下失败的文件与原因，便于定位
            loaded.push(`${f} [ERROR: ${e.message.slice(0, 80)}]`);
        }
    }
    return { loaded, files };
}

/** 让 MutationObserver / 定时器跑完 */
const settle = (ms = 400) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const manifestPath = path.join(EXT, 'manifest.json');
    check('扩展目录存在', fs.existsSync(EXT), EXT);
    check('manifest.json 存在', fs.existsSync(manifestPath), manifestPath);
    if (!fs.existsSync(manifestPath)) { report(); return; }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    check('manifest_version 为 3', manifest.manifest_version === 3, String(manifest.manifest_version));
    check('匹配 github.com', (manifest.content_scripts[0].matches || []).includes('https://github.com/*'));
    check('run_at 为 document_start（原脚本要求）',
        manifest.content_scripts[0].run_at === 'document_start', manifest.content_scripts[0].run_at);

    // 三个脚本都必须存在（缺一个都会让翻译或垫片失效）
    const jsFiles = manifest.content_scripts[0].js;
    check('声明了 3 个脚本', jsFiles.length === 3, jsFiles.join(', '));
    for (const f of jsFiles) {
        check(`脚本存在: ${f}`, fs.existsSync(path.join(EXT, f)));
    }
    // 顺序至关重要：词库必须在主脚本之前
    check('加载顺序正确（词库 → 垫片 → 主逻辑）',
        jsFiles[0].includes('i18n') && jsFiles[1].includes('shim') && jsFiles[2].includes('main'),
        jsFiles.join(' → '));

    // ---------- 核心：实际翻译能力 ----------
    const dom = makeDom('https://github.com/test/repo');
    const w = dom.window;
    const errors = [];
    w.addEventListener('error', (e) => errors.push(String(e.message)));
    const origError = w.console.error;
    w.console.error = (...a) => { errors.push(a.join(' ')); };

    const { loaded } = loadExtension(dom, EXT);
    await settle(600);

    check('三个脚本均无异常加载',
        loaded.length === 3 && !loaded.some((l) => l.includes('ERROR')),
        loaded.join(' | '));

    // 垫片是否就位
    check('GM_getValue 垫片已注入', typeof w.GM_getValue === 'function');
    check('GM_setValue 垫片已注入', typeof w.GM_setValue === 'function');
    check('GM_addStyle 垫片已注入', typeof w.GM_addStyle === 'function');
    check('GM_xmlhttpRequest 垫片已注入', typeof w.GM_xmlhttpRequest === 'function');

    // 词库是否被主脚本读到
    check('词库 I18N 可被主脚本访问（typeof 检查通过）',
        !errors.some((e) => e.includes('词库') || e.includes('I18N')),
        errors.filter((e) => e.includes('词库') || e.includes('I18N')).join(' | ') || '无相关错误');

    // 真实翻译结果。
    // 期望值必须取自词库实际译法（用 grep 从 00-i18n.js 核对过），
    // 不能凭想象写 —— 曾把 Marketplace 期望成"应用市场"，
    // 而词库实际是"市场"，导致误判为扩展失效。
    const bodyText = w.document.body.textContent;
    const EXPECT = [
        ['Pull requests', '拉取请求'],
        ['Issues', '议题'],
        ['Marketplace', '市场'],
        ['Explore', '探索'],
        ['Sign in', '登录'],
        ['Sign up', '注册'],
    ];
    for (const [en, zh] of EXPECT) {
        const translated = bodyText.includes(zh);
        check(`翻译生效: "${en}" → "${zh}"`, translated,
            translated ? '' : '未找到中文，界面仍是英文');
    }

    // 结构完整性：翻译不应破坏 DOM
    check('DOM 未被破坏（导航仍存在）', w.document.querySelectorAll('header nav a').length === 5,
        String(w.document.querySelectorAll('header nav a').length));
    check('未误删正文元素', w.document.querySelectorAll('main *').length > 10,
        String(w.document.querySelectorAll('main *').length));

    // 无致命错误
    const fatal = errors.filter((e) => /is not a function|undefined is not|Cannot read/.test(e));
    check('无致命运行时错误', fatal.length === 0, fatal.slice(0, 3).join(' | '));

    report();

    function report() {
        const pass = results.filter((r) => r.pass).length;
        const fail = results.length - pass;
        console.log('===== GitHub 中文化扩展验证 =====');
        for (const r of results) {
            console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '   [' + r.detail + ']' : ''}`);
        }
        console.log(`\n${pass}/${results.length} 通过${fail ? `  (${fail} 项失败)` : ''}`);
        try { dom && dom.window.close(); } catch (_) {}
        process.exit(fail ? 1 : 0);
    }
})();
