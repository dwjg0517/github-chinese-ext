// ============================================================================
// 油猴 API 垫片（GM_* shim）
//
// 本扩展把 maboloshi/github-chinese 这个油猴脚本移植成标准 Chrome/Edge 扩展，
// 因此需要在这里提供脚本依赖的 GM_* 接口。
//
// 为什么要移植、而不是直接用油猴装脚本：
//   原脚本用 `@require` 从 raw.githubusercontent.com 下载 2 MB 词库。
//   该域名在本机网络环境下不可达，脚本装上后拿不到词库，会直接抛
//   「词库文件 locals.js 未加载」。移植后词库内嵌，零外部依赖。
//
// 覆盖的 API（按原脚本实际用到的最小集合）：
//   GM_addStyle / GM_getValue / GM_setValue / GM_xmlhttpRequest
//   GM_notification / GM_registerMenuCommand / GM_unregisterMenuCommand
//   GM_info
//
// 未实现菜单类 API 的原因：扩展没有油猴那种「脚本菜单」宿主，
// 原脚本用菜单做的开关（未命中词条记录/远程翻译引擎）在扩展里改为
// 直接读 localStorage，默认关闭 —— 不影响主翻译功能。
// ============================================================================
(function () {
    'use strict';

    const NS = 'ghcn:';          // localStorage 命名空间，避免污染页面存储
    const STYLE_ID = 'ghcn-injected-style';

    /** 安全读取 localStorage（隐私模式下可能抛异常） */
    function lsGet(key) {
        try { return localStorage.getItem(NS + key); } catch (_) { return null; }
    }
    function lsSet(key, val) {
        try { localStorage.setItem(NS + key, val); } catch (_) { /* 忽略配额/隐私模式错误 */ }
    }

    /**
     * 读取配置值。与原脚本语义一致：支持默认值，
     * 且默认值可能带类型信息（用 Object 包装），字符串结果需还原类型。
     */
    globalThis.GM_getValue = function (key, defaultValue) {
        let raw = lsGet(key);
        if (raw === null) return defaultValue;

        // 原脚本用 GM_getValue(key, {a:1}) 这种写法传默认值来推断类型
        if (typeof defaultValue === 'boolean') return raw === 'true';
        if (typeof defaultValue === 'number') {
            const n = Number(raw);
            return Number.isNaN(n) ? defaultValue : n;
        }
        if (defaultValue !== null && typeof defaultValue === 'object') {
            try { return JSON.parse(raw); } catch (_) { return defaultValue; }
        }
        return raw;
    };

    globalThis.GM_setValue = function (key, value) {
        lsSet(key, typeof value === 'string' ? value : JSON.stringify(value));
    };

    /** 注入 CSS。document-start 阶段 head 可能还不存在，需兜底。 */
    globalThis.GM_addStyle = function (css) {
        const put = () => {
            if (document.getElementById(STYLE_ID)) return;
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = css;
            (document.head || document.documentElement).appendChild(style);
        };
        if (document.documentElement) put();
        else document.addEventListener('DOMContentLoaded', put, { once: true });
        return null;
    };

    /**
     * 跨域请求。仅被「未命中词条的远程翻译」用到（默认关闭）。
     * 用 fetch 实现，并适配原脚本依赖的 onload/onerror/ontimeout 回调风格。
     */
    globalThis.GM_xmlhttpRequest = function (opt) {
        const ac = new AbortController();
        const timer = setTimeout(() => {
            ac.abort();
            if (opt.ontimeout) opt.ontimeout({ status: 0, responseText: '' });
        }, opt.timeout || 10000);

        let url = opt.url;
        if (opt.params && opt.method === 'GET') {
            const qs = new URLSearchParams(opt.params).toString();
            url += (url.includes('?') ? '&' : '?') + qs;
        }

        fetch(url, {
            method: opt.method || 'GET',
            headers: opt.headers || {},
            body: opt.data || undefined,
            signal: ac.signal,
        })
            .then(async (res) => {
                const responseText = await res.text();
                clearTimeout(timer);
                if (opt.onload) opt.onload({ status: res.status, responseText, finalUrl: res.url });
            })
            .catch((err) => {
                clearTimeout(timer);
                if (ac.signal.aborted) return;   // 超时已回调，避免重复
                if (opt.onerror) opt.onerror({ status: 0, error: String(err) });
            });

        return { abort: () => { clearTimeout(timer); ac.abort(); } };
    };

    // 无宿主可承载脚本菜单：记下来但静默忽略，避免原脚本抛错中断。
    globalThis.GM_registerMenuCommand = function () { return null; };
    globalThis.GM_unregisterMenuCommand = function () { /* no-op */ };

    /** 通知：没有原生通道时退化为控制台输出，避免弹窗打断浏览。 */
    globalThis.GM_notification = function (text) {
        const msg = typeof text === 'string' ? text : (text && text.text) || '';
        if (msg) console.info('[GitHub 中文化] ' + msg);
    };

    globalThis.GM_info = {
        script: { name: 'GitHub 中文化插件', version: '1.9.4.4', version_embed: true },
        scriptHandler: 'local-extension',
        version: '1.9.4.4',
    };
})();
