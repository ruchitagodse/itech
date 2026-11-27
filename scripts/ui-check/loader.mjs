import ts from "typescript";
import postcss from "postcss";
import { compileString } from "sass";
import { relative } from "node:path";

export default function loader(source) {
  if (/\.(css|scss)$/.test(this.resourcePath)) {
    let css = this.resourcePath.endsWith(".scss") ? compileString(source).css : source;
    const names = {};
    if (this.resourcePath.endsWith(".module.css")) {
      const prefix = relative(process.cwd(), this.resourcePath).replace(/\W/g, "_");
      const root = postcss.parse(css);
      root.walkRules(rule => {
        const globals = [];
        rule.selector = rule.selector.replace(/:global\(([^)]+)\)/g, (_, selector) => { globals.push(selector); return `GLOBAL${globals.length - 1}`; })
          .replace(/\.([a-zA-Z_][\w-]*)/g, (_, name) => { names[name] = `${prefix}_${name}`; return `.${names[name]}`; })
          .replace(/GLOBAL(\d+)/g, (_, index) => globals[Number(index)]);
      });
      css = root.toString();
    }
    return `const style = document.createElement('style'); style.textContent = ${JSON.stringify(css)}; document.head.appendChild(style); export default ${JSON.stringify(names)};`;
  }
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
}
