import { buildFontStack, pickRule } from "../shared/rules";
import type { Rule } from "../shared/types";

type InlineValue = { value: string; priority: string };

type ElementState = {
  originalChain: string;
  familyInline?: InlineValue;
  weightInline?: InlineValue;
};

/** 这些标签不渲染文本，跳过以省开销 */
const SKIP_TAGS: Record<string, true> = {
  SCRIPT: true,
  STYLE: true,
  LINK: true,
  META: true,
  TITLE: true,
  BASE: true,
  NOSCRIPT: true,
  TEMPLATE: true,
};

const FAMILY = "font-family";
const WEIGHT = "font-weight";

export type Engine = {
  setRules(rules: Rule[]): void;
  /** DOM 就绪后调用：全量扫描并建立监听 */
  start(): void;
  /** 重新采集并应用（晚到样式表、配置变化后） */
  reapply(): void;
  /** 恢复全部 inline 并停止监听 */
  dispose(): void;
};

export function createEngine(onApplied: () => void): Engine {
  const states = new Map<Element, ElementState>();
  const applied = new Set<Element>();
  const observedRoots = new Set<Document | ShadowRoot>();
  let observers: MutationObserver[] = [];
  let rules: Rule[] = [];
  let running = false;
  let reapplyTimer: number | undefined;

  const inlineStyle = (el: Element): CSSStyleDeclaration | null => {
    if (!("style" in el)) return null;
    const style = el.style;
    return style instanceof CSSStyleDeclaration ? style : null;
  };

  const readInline = (el: Element, property: string): InlineValue => {
    const style = inlineStyle(el);
    return {
      value: style?.getPropertyValue(property) ?? "",
      priority: style?.getPropertyPriority(property) ?? "",
    };
  };

  const restoreInline = (el: Element, property: string, record: InlineValue): void => {
    const style = inlineStyle(el);
    if (!style) return;
    if (record.value === "") style.removeProperty(property);
    else style.setProperty(property, record.value, record.priority);
  };

  const restoreElement = (el: Element, state: ElementState): void => {
    if (state.familyInline) {
      restoreInline(el, FAMILY, state.familyInline);
      state.familyInline = undefined;
    }
    if (state.weightInline) {
      restoreInline(el, WEIGHT, state.weightInline);
      state.weightInline = undefined;
    }
  };

  const parentOf = (el: Element): Element | null => {
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode();
    return root instanceof ShadowRoot ? root.host : null;
  };

  /** 收集 root 下的全部元素（含开放 Shadow DOM），按文档顺序 */
  const collectElements = (root: ParentNode): Element[] => {
    const result: Element[] = [];
    for (const el of root.querySelectorAll("*")) {
      result.push(el);
      if (el.shadowRoot) result.push(...collectElements(el.shadowRoot));
    }
    return result;
  };

  const elementsInSubtree = (root: Element): Element[] => [root, ...collectElements(root)];

  const processBatch = (elements: Element[]): void => {
    if (elements.length === 0) return;

    // 阶段一：采集每个元素的原始字体栈
    const batchChains = new Map<Element, string>();
    const target: Array<{ el: Element; state: ElementState }> = [];

    for (const el of elements) {
      if (SKIP_TAGS[el.tagName] === true) continue;
      let chain: string;
      try {
        chain = getComputedStyle(el).fontFamily;
      } catch {
        continue;
      }
      batchChains.set(el, chain);

      const parent = parentOf(el);
      let parentChain = "";
      if (parent) {
        try {
          parentChain = batchChains.get(parent) ?? getComputedStyle(parent).fontFamily;
        } catch {
          parentChain = "";
        }
      }
      const parentState = parent ? states.get(parent) : undefined;
      const originalChain =
        chain === parentChain && parentState ? parentState.originalChain : chain;

      let state = states.get(el);
      if (!state) {
        state = { originalChain };
        states.set(el, state);
      }
      target.push({ el, state });
    }

    // 阶段二：应用最高优先级的命中规则
    for (const { el, state } of target) {
      const picked = pickRule(rules, el);
      if (!picked) continue;
      const stack = buildFontStack(picked.rule, state.originalChain);
      if (stack === "") continue;
      const style = inlineStyle(el);
      if (!style) continue;

      if (!state.familyInline) state.familyInline = readInline(el, FAMILY);
      style.setProperty(FAMILY, stack, "important");

      if (picked.rule.fontWeight !== undefined) {
        if (!state.weightInline) state.weightInline = readInline(el, WEIGHT);
        style.setProperty(WEIGHT, String(picked.rule.fontWeight), "important");
      } else if (state.weightInline) {
        restoreInline(el, WEIGHT, state.weightInline);
        state.weightInline = undefined;
      }

      applied.add(el);
    }

    observeShadowRoots(target.map((item) => item.el));
    onApplied();
  };

  const observeShadowRoots = (elements: Element[]): void => {
    for (const el of elements) {
      const root = el.shadowRoot;
      if (!root || observedRoots.has(root)) continue;
      observeRoot(root);
      processBatch(collectElements(root));
    }
  };

  const cleanupSubtree = (roots: Element[]): void => {
    for (const root of roots) {
      for (const el of elementsInSubtree(root)) {
        const state = states.get(el);
        if (!state) continue;
        if (applied.has(el)) restoreElement(el, state);
        states.delete(el);
        applied.delete(el);
      }
    }
  };

  const needsReapply = (node: Element): boolean => {
    if (node.tagName === "STYLE") return true;
    if (node instanceof HTMLLinkElement && node.relList.contains("stylesheet")) return true;
    return node.querySelector('style, link[rel~="stylesheet"]') !== null;
  };

  const scheduleReapply = (): void => {
    clearTimeout(reapplyTimer);
    reapplyTimer = window.setTimeout(() => {
      reapplyTimer = undefined;
      reapply();
    }, 500);
  };

  const handleMutations = (records: MutationRecord[]): void => {
    const added: Element[] = [];
    const removed: Element[] = [];
    let refresh = false;

    for (const record of records) {
      if (record.type !== "childList") continue;
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        added.push(...elementsInSubtree(node));
        if (!refresh && needsReapply(node)) refresh = true;
      }
      for (const node of record.removedNodes) {
        if (!(node instanceof Element)) continue;
        removed.push(node);
      }
    }

    if (removed.length > 0) cleanupSubtree(removed);
    if (added.length > 0) processBatch(added);
    if (refresh) scheduleReapply();
  };

  const observeRoot = (root: Document | ShadowRoot): void => {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    const observer = new MutationObserver(handleMutations);
    observer.observe(root, { childList: true, subtree: true });
    observers.push(observer);
  };

  const scanAll = (): void => {
    observeRoot(document);
    processBatch(collectElements(document));
  };

  function reapply(): void {
    if (!running) return;
    for (const [el, state] of states) {
      if (applied.has(el)) restoreElement(el, state);
    }
    states.clear();
    applied.clear();
    for (const observer of observers) observer.disconnect();
    observers = [];
    observedRoots.clear();
    scanAll();
  }

  return {
    setRules(next) {
      rules = next;
    },
    start() {
      if (running) return;
      running = true;
      scanAll();
    },
    reapply,
    dispose() {
      for (const [el, state] of states) {
        if (applied.has(el)) restoreElement(el, state);
      }
      states.clear();
      applied.clear();
      for (const observer of observers) observer.disconnect();
      observers = [];
      observedRoots.clear();
      running = false;
      if (reapplyTimer !== undefined) {
        clearTimeout(reapplyTimer);
        reapplyTimer = undefined;
      }
    },
  };
}
