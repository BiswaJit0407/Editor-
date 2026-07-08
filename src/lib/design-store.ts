import type { Design, Template } from "./editor-types";
import { uid } from "./editor-types";

const KEY = "design-editor-projects";

// v1 designs stored `elements` directly; migrate to `pages`.
function migrate(raw: unknown): Design {
  const d = raw as Design & { elements?: unknown[] };
  if (!d.pages || !Array.isArray(d.pages)) {
    const elements = Array.isArray(d.elements) ? (d.elements as Design["pages"][number]["elements"]) : [];
    return { ...d, pages: [{ id: uid(), elements }], elements: undefined } as Design;
  }
  return d;
}

function read(): Design[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as unknown[]).map(migrate);
  } catch {
    return [];
  }
}

function write(list: Design[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function listDesigns(): Design[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDesign(id: string): Design | undefined {
  return read().find((d) => d.id === id);
}

export function saveDesign(design: Design) {
  const list = read();
  const idx = list.findIndex((d) => d.id === design.id);
  const next = { ...design, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  write(list);
}

export function deleteDesign(id: string) {
  write(read().filter((d) => d.id !== id));
}

export function createFromTemplate(tpl: Template, name?: string): Design {
  return {
    id: uid(),
    name: name || tpl.name,
    width: tpl.width,
    height: tpl.height,
    background: tpl.background,
    pages: [{
      id: uid(),
      elements: tpl.elements.map((el) => ({ ...el, id: uid() })) as Design["pages"][number]["elements"],
    }],
    updatedAt: Date.now(),
  };
}

export function createBlank(width = 1080, height = 1080, background = "#ffffff"): Design {
  return {
    id: uid(),
    name: "Untitled design",
    width, height, background,
    pages: [{ id: uid(), elements: [] }],
    updatedAt: Date.now(),
  };
}
