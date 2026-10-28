import { describe, expect, it } from "vite-plus/test";
import { absolutizeCssUrls } from "../src/shared/css-urls";

const base = "https://cdn.example.com/fonts/main.css";

describe("absolutizeCssUrls", () => {
  it("重写相对字号文件地址", () => {
    expect(absolutizeCssUrls("@font-face { src: url(font.woff2); }", base)).toContain(
      "url(https://cdn.example.com/fonts/font.woff2)",
    );
  });

  it("保留引号类型", () => {
    const css = absolutizeCssUrls(`@font-face { src: url("./a.woff2"); }`, base);
    expect(css).toContain('url("https://cdn.example.com/fonts/a.woff2")');
    const single = absolutizeCssUrls(`@font-face { src: url('./a.woff2'); }`, base);
    expect(single).toContain("url('https://cdn.example.com/fonts/a.woff2')");
  });

  it("处理 @import 目标", () => {
    const css = absolutizeCssUrls("@import url(./extra.css);", base);
    expect(css).toContain("@import url(https://cdn.example.com/fonts/extra.css)");
  });

  it("跳过已带 scheme、data、fragment", () => {
    const source = [
      "@font-face { src: url(https://other.example/a.woff2); }",
      ".a { background: url(data:image/png;base64,AAA); }",
      ".b { fill: url(#gradient); }",
      "@font-face { src: url(file:///C:/fonts/a.woff2); }",
      ".c { background: url(blob:https://x/y); }",
    ].join("\n");
    const css = absolutizeCssUrls(source, base);
    expect(css).toContain("url(https://other.example/a.woff2)");
    expect(css).toContain("url(data:image/png;base64,AAA)");
    expect(css).toContain("url(#gradient)");
    expect(css).toContain("url(file:///C:/fonts/a.woff2)");
    expect(css).toContain("url(blob:https://x/y)");
  });

  it("解析失败时抛出", () => {
    expect(() => absolutizeCssUrls(".a { color: red;", base)).toThrow();
  });
});
