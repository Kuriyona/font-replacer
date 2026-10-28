export type RuleFont = { family: string; source: "system" | "custom" };

export type SelectorMode = "none" | "blacklist" | "whitelist";

/** 内置选择器预设 id；当前规则可额外挂一个预设，与自定义选择器合并生效 */
export type SelectorPresetId = "regular-blacklist" | "mono-whitelist";

export type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  /** 顺序即回退优先级 */
  fonts: RuleFont[];
  /** 100..900；设置后强制覆盖 */
  fontWeight?: number;
  cssUrls: string[];
  selectors: { mode: SelectorMode; list: string[]; preset?: SelectorPresetId };
  createdAt: number;
  updatedAt: number;
};

export type SiteRule = {
  /** host 模式：主机名；domain 模式：可注册域名 */
  pattern: string;
  match: "host" | "domain";
  /** 顺序即优先级，靠前者优先 */
  ruleIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type FontFamilyInfo = { family: string; styles: string[] };

export type FontCache = {
  families: FontFamilyInfo[];
  source: "local-fonts" | "font-settings";
  updatedAt: number;
};

export type PageIssue =
  | { kind: "font-missing"; ruleId: string; ruleName: string; family: string }
  | { kind: "css-failed"; ruleId: string; ruleName: string; url: string; message: string }
  | { kind: "css-inject-failed"; message: string };
