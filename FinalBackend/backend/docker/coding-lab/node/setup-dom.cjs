// Preloaded (node --require) for FRONTEND assessments: gives tests a browser-like global environment.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

let htmlContent = "<!doctype html><html><head></head><body></body></html>";
const htmlPath = path.resolve(process.cwd(), "index.html");
if (fs.existsSync(htmlPath)) {
  try {
    const raw = fs.readFileSync(htmlPath, "utf-8").trim();
    if (raw) htmlContent = raw;
  } catch {}
}

const dom = new JSDOM(htmlContent, {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
const { window } = dom;

// Inject styles.css if present
const cssPath = path.resolve(process.cwd(), "styles.css");
if (fs.existsSync(cssPath)) {
  try {
    const cssContent = fs.readFileSync(cssPath, "utf-8");
    const styleEl = window.document.createElement("style");
    styleEl.textContent = cssContent;
    window.document.head.appendChild(styleEl);
  } catch {}
}

// Inject script.js if present
const jsPath = path.resolve(process.cwd(), "script.js");
if (fs.existsSync(jsPath)) {
  try {
    const jsContent = fs.readFileSync(jsPath, "utf-8");
    const scriptEl = window.document.createElement("script");
    scriptEl.textContent = jsContent;
    window.document.body.appendChild(scriptEl);
  } catch {}
}

globalThis.window = window;
globalThis.document = window.document;
for (const k of ["HTMLElement", "Element", "Node", "Event", "MouseEvent", "KeyboardEvent", "MutationObserver",
                 "getComputedStyle", "DocumentFragment", "HTMLInputElement", "CustomEvent"]) {
  globalThis[k] = window[k];
}
try { Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true }); } catch {}
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
