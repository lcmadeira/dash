// Os cards usam window.nf (definido em src/core.js) para escrever números em pt-PT.
// Os testes correm cada card num contexto vm próprio sem core.js; este módulo dá a todos
// esses contextos a mesma implementação, lida do próprio core.js.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const core = readFileSync(new URL("../src/core.js", import.meta.url), "utf8");
const start = core.indexOf("window.nf = ");
const end = core.indexOf("window.chg = ", start);
if (start < 0 || end < start) throw new Error("window.nf/nfr não encontrados em src/core.js");
const holder = { window: {} };
vm.runInNewContext(core.slice(start, end), holder);
export const { nf, nfr } = holder.window;

const createContext = vm.createContext.bind(vm);
vm.createContext = (sandbox = {}, ...rest) => {
  if (sandbox && typeof sandbox === "object") {
    if (!("nf" in sandbox)) Object.assign(sandbox, { nf, nfr });
    if (sandbox.window && typeof sandbox.window === "object" && !("nf" in sandbox.window)) Object.assign(sandbox.window, { nf, nfr });
  }
  return createContext(sandbox, ...rest);
};
