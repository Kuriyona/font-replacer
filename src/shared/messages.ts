/** 内容脚本 ↔ service worker 的消息形状 */
export type FetchCssResult = { ok: true; css: string } | { ok: false; error: string };

export type CssOpResult = { ok: boolean; error?: string };
