import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import jsPDF from "jspdf";
import type {
  CanvasElement, Design, Page,
  TextElement, RectElement, CircleElement, ImageElement,
  TriangleElement, StarElement, LineElement, ArrowElement,
} from "@/lib/editor-types";
import { uid } from "@/lib/editor-types";
import { saveDesign } from "@/lib/design-store";
import { templates } from "@/lib/templates";
import { useHistoryState } from "@/hooks/use-history-state";
import PropertiesPanel from "./PropertiesPanel";
import {
  Undo2, Redo2, Save, Share2, Download, Sparkles,
  LayoutTemplate, Upload, Type as TypeIcon, Shapes, ImageIcon, Palette,
  Settings, HelpCircle, Plus, Copy, Trash2, ChevronRight, ChevronDown, Minus,
  Pentagon, Layers,
  Square, Circle as CircleIcon, Triangle, Star as StarIcon, Minus as LineIcon, MoveRight,
} from "lucide-react";

// Konva touches window at import time — load only on client.
const CanvasStage = lazy(() => import("./CanvasStage"));

type Props = { initial: Design };

const BG_SWATCHES = ["#ffffff", "#0f172a", "#f8fafc", "#111827", "#fde68a", "#a855f7", "#ff6b6b", "#10b981", "#e0f2fe", "#dbeafe", "#fef3c7", "#fce7f3"];
const STYLE_PALETTES: string[][] = [
  ["#1e3a8a", "#3b82f6", "#93c5fd", "#dbeafe", "#ffffff"],
  ["#0f766e", "#14b8a6", "#5eead4", "#ccfbf1", "#f0fdfa"],
  ["#b45309", "#f59e0b", "#fcd34d", "#fef3c7", "#fffbeb"],
  ["#be185d", "#ec4899", "#f9a8d4", "#fce7f3", "#fdf2f8"],
  ["#111827", "#374151", "#9ca3af", "#e5e7eb", "#ffffff"],
];

const SIZE_PRESETS = [
  { label: "Instagram Post", w: 1080, h: 1080 },
  { label: "Instagram Story", w: 1080, h: 1920 },
  { label: "Poster", w: 1200, h: 1600 },
  { label: "Presentation 16:9", w: 1920, h: 1080 },
  { label: "Business Card", w: 1050, h: 600 },
  { label: "A4 Portrait", w: 2480, h: 3508 },
];

const STOCK_PHOTOS = [
  "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=800",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
  "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800",
  "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=800",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800",
];

type Tool = "templates" | "uploads" | "text" | "elements" | "photos" | "background";

export default function Editor({ initial }: Props) {
  const history = useHistoryState<Design>(initial);
  const design = history.state;
  const setDesign = history.set;

  const [activePageIdx, setActivePageIdx] = useState(0);
  const activePage: Page = design.pages[activePageIdx] ?? design.pages[0];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("templates");
  const [panelOpen, setPanelOpen] = useState(true);
  const [rightTab, setRightTab] = useState<"design" | "properties">("design");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const [uploads, setUploads] = useState<string[]>([]);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isSpaceDown, setIsSpaceDown] = useState(false);

  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  // ResizeObserver for canvas container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setContainerSize({ w: el.clientWidth, h: el.clientHeight }));
    obs.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  const fitScale = useMemo(() => {
    const pad = 96;
    const sx = (containerSize.w - pad) / design.width;
    const sy = (containerSize.h - 160) / design.height;
    return Math.min(sx, sy, 1);
  }, [containerSize, design.width, design.height]);

  const scale = zoom === "fit" ? fitScale : zoom;

  const selected = activePage.elements.find((e) => e.id === selectedId) || null;

  useEffect(() => {
    if (selectedId) setRightTab("properties");
    else setRightTab("design");
  }, [selectedId]);

  // Clamp active page when pages array shrinks, clear selection on page swap
  useEffect(() => {
    if (activePageIdx >= design.pages.length) setActivePageIdx(Math.max(0, design.pages.length - 1));
  }, [design.pages.length, activePageIdx]);
  useEffect(() => { setSelectedId(null); }, [activePageIdx]);

  // -- helpers to mutate the active page's elements ------------------------
  const patchPage = useCallback((pageIdx: number, fn: (p: Page) => Page) => {
    setDesign((d) => ({
      ...d,
      pages: d.pages.map((p, i) => (i === pageIdx ? fn(p) : p)),
    }));
  }, [setDesign]);

  const updateEl = useCallback((id: string, patch: Partial<CanvasElement>) => {
    patchPage(activePageIdx, (p) => ({
      ...p,
      elements: p.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as CanvasElement) : e)),
    }));
  }, [patchPage, activePageIdx]);

  const addEl = (el: CanvasElement) => {
    patchPage(activePageIdx, (p) => ({ ...p, elements: [...p.elements, el] }));
    setSelectedId(el.id);
  };

  const centerX = design.width / 2;
  const centerY = design.height / 2;

  // -- add elements --------------------------------------------------------
  const addText = (preset: "heading" | "sub" | "body") => {
    const sizes = { heading: 96, sub: 48, body: 28 };
    const t: TextElement = {
      id: uid(), type: "text",
      x: centerX - 300, y: centerY - 60,
      text: preset === "heading" ? "Add a headline" : preset === "sub" ? "Add a subheading" : "Add body text",
      fontSize: sizes[preset], fontFamily: "Hanken Grotesk",
      fontStyle: preset === "heading" ? "bold" : "normal",
      fill: "#0f172a", width: 600, align: "left",
      rotation: 0, opacity: 1, draggable: true,
    };
    addEl(t);
  };

  const addRect = (color = "#2563eb") => {
    const r: RectElement = {
      id: uid(), type: "rect",
      x: centerX - 150, y: centerY - 100,
      width: 300, height: 200, fill: color, stroke: "", strokeWidth: 0, cornerRadius: 12,
      rotation: 0, opacity: 1, draggable: true,
    };
    addEl(r);
  };
  const addCircle = (color = "#2563eb") => {
    const c: CircleElement = {
      id: uid(), type: "circle", x: centerX, y: centerY,
      radius: 140, fill: color, stroke: "", strokeWidth: 0,
      rotation: 0, opacity: 1, draggable: true,
    };
    addEl(c);
  };
  const addTriangle = (color = "#2563eb") => {
    const t: TriangleElement = {
      id: uid(), type: "triangle", x: centerX, y: centerY, radius: 160,
      fill: color, stroke: "", strokeWidth: 0, rotation: 0, opacity: 1, draggable: true,
    };
    addEl(t);
  };
  const addStar = (color = "#f59e0b") => {
    const s: StarElement = {
      id: uid(), type: "star", x: centerX, y: centerY,
      numPoints: 5, innerRadius: 70, outerRadius: 150,
      fill: color, stroke: "", strokeWidth: 0, rotation: 0, opacity: 1, draggable: true,
    };
    addEl(s);
  };
  const addLine = () => {
    const l: LineElement = {
      id: uid(), type: "line", x: centerX - 150, y: centerY,
      points: [0, 0, 300, 0], stroke: "#0f172a", strokeWidth: 8,
      rotation: 0, opacity: 1, draggable: true,
    };
    addEl(l);
  };
  const addArrow = () => {
    const a: ArrowElement = {
      id: uid(), type: "arrow", x: centerX - 150, y: centerY,
      points: [0, 0, 300, 0], stroke: "#0f172a", fill: "#0f172a", strokeWidth: 8,
      pointerLength: 20, pointerWidth: 20,
      rotation: 0, opacity: 1, draggable: true,
    };
    addEl(a);
  };

  const addImageFromSrc = (src: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxW = design.width * 0.6;
      const ratio = img.height / img.width;
      const w = Math.min(img.width, maxW);
      const h = w * ratio;
      const el: ImageElement = {
        id: uid(), type: "image",
        x: (design.width - w) / 2, y: (design.height - h) / 2,
        width: w, height: h, src,
        rotation: 0, opacity: 1, draggable: true,
      };
      addEl(el);
    };
    img.src = src;
  };

  const onUpload = async (file: File) => {
    const dataUrl = await new Promise<string>((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
    setUploads((u) => [dataUrl, ...u].slice(0, 24));
    addImageFromSrc(dataUrl);
  };

  // -- selection actions ---------------------------------------------------
  const deleteSel = () => {
    if (!selectedId) return;
    patchPage(activePageIdx, (p) => ({ ...p, elements: p.elements.filter((e) => e.id !== selectedId) }));
    setSelectedId(null);
  };
  const duplicateSel = () => {
    if (!selected) return;
    const copy = { ...(selected as CanvasElement), id: uid(), x: selected.x + 40, y: selected.y + 40 };
    addEl(copy);
  };
  const reorder = (dir: "up" | "down") => {
    if (!selectedId) return;
    patchPage(activePageIdx, (p) => {
      const i = p.elements.findIndex((e) => e.id === selectedId);
      if (i < 0) return p;
      const j = dir === "up" ? Math.min(p.elements.length - 1, i + 1) : Math.max(0, i - 1);
      if (i === j) return p;
      const next = p.elements.slice();
      const [item] = next.splice(i, 1);
      next.splice(j, 0, item);
      return { ...p, elements: next };
    });
  };
  const nudge = (dx: number, dy: number) => {
    if (!selectedId) return;
    updateEl(selectedId, { x: (selected?.x ?? 0) + dx, y: (selected?.y ?? 0) + dy });
  };

  // -- pages ---------------------------------------------------------------
  const addPage = () => {
    setDesign((d) => ({ ...d, pages: [...d.pages, { id: uid(), elements: [] }] }));
    setActivePageIdx(design.pages.length);
    setSelectedId(null);
  };
  const duplicatePage = (idx: number) => {
    setDesign((d) => {
      const src = d.pages[idx];
      const clone: Page = { id: uid(), elements: src.elements.map((e) => ({ ...e, id: uid() })) };
      const pages = [...d.pages];
      pages.splice(idx + 1, 0, clone);
      return { ...d, pages };
    });
    setActivePageIdx(idx + 1);
    setSelectedId(null);
  };
  const deletePage = (idx: number) => {
    if (design.pages.length <= 1) return;
    setDesign((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== idx) }));
    setSelectedId(null);
  };

  // -- save / autosave -----------------------------------------------------
  const save = useCallback(() => {
    let thumbnail: string | undefined;
    try {
      thumbnail = stageRef.current?.toDataURL({ pixelRatio: 0.2, mimeType: "image/jpeg", quality: 0.6 });
    } catch { /* tainted */ }
    saveDesign({ ...design, thumbnail });
    setSavedAt(Date.now());
  }, [design]);
  useEffect(() => {
    const t = setTimeout(save, 800);
    return () => clearTimeout(t);
  }, [design, save]);

  // -- export --------------------------------------------------------------
  const exportPNG = () => {
    const stage = stageRef.current;
    if (!stage) return;
    setSelectedId(null);
    requestAnimationFrame(() => {
      const url = stage.toDataURL({ pixelRatio: 1 / scale, mimeType: "image/png" });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${design.name}-page-${activePageIdx + 1}.png`;
      a.click();
    });
  };

  const exportPDF = () => {
    const stage = stageRef.current;
    if (!stage) return;
    setSelectedId(null);
    const originalPage = activePageIdx;
    const pdf = new jsPDF({
      orientation: design.width > design.height ? "l" : "p",
      unit: "px",
      format: [design.width, design.height],
    });
    // Render each page sequentially
    const renderPage = (i: number) => {
      setActivePageIdx(i);
      requestAnimationFrame(() => {
        // Wait one more frame for layer redraw
        requestAnimationFrame(() => {
          const url = stage.toDataURL({ pixelRatio: 1 / scale, mimeType: "image/png" });
          if (i > 0) pdf.addPage([design.width, design.height], design.width > design.height ? "l" : "p");
          pdf.addImage(url, "PNG", 0, 0, design.width, design.height);
          if (i + 1 < design.pages.length) {
            renderPage(i + 1);
          } else {
            pdf.save(`${design.name}.pdf`);
            setActivePageIdx(originalPage);
          }
        });
      });
    };
    renderPage(0);
  };

  // -- keyboard shortcuts --------------------------------------------------
  useEffect(() => {
    const isTypingIn = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTypingIn(e.target)) {
        e.preventDefault();
        setIsSpaceDown(true);
        return;
      }
      if (isTypingIn(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); history.undo(); return; }
      if (meta && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); history.redo(); return; }
      if (meta && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return; }
      if (meta && e.key.toLowerCase() === "d" && selectedId) { e.preventDefault(); duplicateSel(); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { e.preventDefault(); deleteSel(); return; }
      if (selectedId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft") nudge(-step, 0);
        if (e.key === "ArrowRight") nudge(step, 0);
        if (e.key === "ArrowUp") nudge(0, -step);
        if (e.key === "ArrowDown") nudge(0, step);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpaceDown(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  // -- wheel zoom & pan ----------------------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom((z) => {
          const cur = z === "fit" ? fitScale : z;
          return Math.min(4, Math.max(0.05, cur * factor));
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fitScale]);

  // Pan drag when space is down
  const panRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const onPanMouseDown = (e: React.MouseEvent) => {
    if (!isSpaceDown) return;
    panRef.current = { startX: e.clientX, startY: e.clientY, ox: panOffset.x, oy: panOffset.y };
  };
  const onPanMouseMove = (e: React.MouseEvent) => {
    if (!panRef.current) return;
    const p = panRef.current;
    setPanOffset({ x: p.ox + (e.clientX - p.startX), y: p.oy + (e.clientY - p.startY) });
  };
  const onPanMouseUp = () => { panRef.current = null; };

  // -- templates / palettes ------------------------------------------------
  const applyTemplate = (tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    setDesign((d) => ({
      ...d,
      width: tpl.width, height: tpl.height, background: tpl.background,
      pages: [{
        id: uid(),
        elements: tpl.elements.map((el) => ({ ...el, id: uid() })) as Page["elements"],
      }, ...d.pages.slice(1)],
    }));
    setActivePageIdx(0);
    setSelectedId(null);
  };
  const setSize = (w: number, h: number) => {
    setDesign((d) => ({ ...d, width: w, height: h }));
    setSizeMenuOpen(false);
  };
  const applyPalette = (palette: string[]) => {
    setDesign((d) => ({
      ...d,
      background: palette[palette.length - 1],
      pages: d.pages.map((pg) => ({
        ...pg,
        elements: pg.elements.map((el, i) => {
          const c = palette[i % (palette.length - 1)];
          if (el.type === "text") return { ...el, fill: palette[0] };
          if (el.type === "rect" || el.type === "circle" || el.type === "triangle" || el.type === "star") return { ...el, fill: c };
          return el;
        }),
      })),
    }));
  };

  const zoomIn = () => setZoom(Math.min(4, scale + 0.1));
  const zoomOut = () => setZoom(Math.max(0.05, scale - 0.1));

  return (
    <div className={`h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden ${isSpaceDown ? "cursor-grab" : ""}`}>
      {/* Top bar */}
      <header className="h-16 border-b border-border flex items-center px-4 gap-4 bg-card shrink-0 relative z-20">
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="w-9 h-9 rounded-full border-2 border-primary flex items-center justify-center text-primary">
            <Pentagon className="w-4 h-4" strokeWidth={2.2} />
          </span>
          <span className="text-[17px] font-semibold text-primary tracking-tight">Design Editor</span>
        </div>

        <div className="flex items-center gap-4 ml-2">
          <button className="text-sm font-medium text-primary border-b-2 border-primary py-0.5">File</button>
          <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setSizeMenuOpen((v) => !v)}>Resize</button>
        </div>

        <div className="flex items-center gap-1 ml-2">
          <IconBtn title="Undo (⌘Z)" onClick={history.undo}><Undo2 className="w-[18px] h-[18px]" /></IconBtn>
          <IconBtn title="Redo (⌘⇧Z)" onClick={history.redo}><Redo2 className="w-[18px] h-[18px]" /></IconBtn>
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Save className="w-4 h-4" />
          <span>{savedAt ? "Saved" : "Saving…"}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button className="h-10 px-4 rounded-lg font-medium text-sm flex items-center gap-2 bg-[color:var(--highlight)] text-[color:var(--highlight-foreground)] hover:brightness-95">
            <Sparkles className="w-4 h-4" /> Upgrade
          </button>
          <button className="h-10 px-4 rounded-lg font-medium text-sm flex items-center gap-2 bg-card border border-border hover:bg-secondary">
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button onClick={exportPNG} className="h-10 px-4 rounded-lg font-medium text-sm flex items-center gap-2 bg-card border border-border hover:bg-secondary">
            <Download className="w-4 h-4" /> Download
          </button>
          <button onClick={exportPDF} className="h-10 px-5 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:opacity-90">
            Publish
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f9c6a7] to-[#c98a6b] ml-1" />
        </div>
      </header>

      {sizeMenuOpen && (
        <div className="absolute z-30 top-16 left-[220px] bg-popover border border-border rounded-xl shadow-lg p-2 w-64">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 py-1">Resize canvas</div>
          {SIZE_PRESETS.map((p) => (
            <button key={p.label} onClick={() => setSize(p.w, p.h)}
              className="w-full flex items-center justify-between px-2 py-2 rounded-md hover:bg-secondary text-sm">
              <span>{p.label}</span>
              <span className="text-xs text-muted-foreground">{p.w}×{p.h}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Left icon rail */}
        <nav className="w-[76px] border-r border-border bg-sidebar flex flex-col items-center py-2 shrink-0">
          <RailBtn active={tool === "templates"} onClick={() => { setTool("templates"); setPanelOpen(true); }} icon={<LayoutTemplate className="w-[22px] h-[22px]" />} label="Templates" />
          <RailBtn active={tool === "uploads"} onClick={() => { setTool("uploads"); setPanelOpen(true); }} icon={<Upload className="w-[22px] h-[22px]" />} label="Uploads" />
          <RailBtn active={tool === "text"} onClick={() => { setTool("text"); setPanelOpen(true); }} icon={<TypeIcon className="w-[22px] h-[22px]" />} label="Text" />
          <RailBtn active={tool === "elements"} onClick={() => { setTool("elements"); setPanelOpen(true); }} icon={<Shapes className="w-[22px] h-[22px]" />} label="Elements" />
          <RailBtn active={tool === "photos"} onClick={() => { setTool("photos"); setPanelOpen(true); }} icon={<ImageIcon className="w-[22px] h-[22px]" />} label="Photos" />
          <RailBtn active={tool === "background"} onClick={() => { setTool("background"); setPanelOpen(true); }} icon={<Palette className="w-[22px] h-[22px]" />} label="Background" />
          <div className="flex-1" />
          <RailBtn onClick={() => {}} icon={<Settings className="w-[22px] h-[22px]" />} label="Settings" />
          <RailBtn onClick={() => {}} icon={<HelpCircle className="w-[22px] h-[22px]" />} label="Help" />
        </nav>

        {/* Left flyout */}
        {panelOpen && (
          <aside className="w-[280px] border-r border-border bg-card overflow-y-auto shrink-0">
            {tool === "templates" && (
              <div className="p-4">
                <PanelHeading>Templates</PanelHeading>
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((t) => (
                    <button key={t.id} onClick={() => applyTemplate(t.id)}
                      className="rounded-lg border border-border overflow-hidden hover:border-primary transition text-left bg-card">
                      <div className="w-full flex items-center justify-center" style={{ aspectRatio: t.width / t.height, background: t.background }}>
                        {t.elements.find((e) => e.type === "text") && (
                          <div className="text-[11px] font-bold px-2 text-center leading-tight" style={{ color: (t.elements.find((e) => e.type === "text") as TextElement).fill }}>
                            {(t.elements.find((e) => e.type === "text") as TextElement).text.split("\n")[0]}
                          </div>
                        )}
                      </div>
                      <div className="px-2 py-1.5 text-[11px] truncate">{t.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {tool === "uploads" && (
              <div className="p-4">
                <PanelHeading>Uploads</PanelHeading>
                <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary hover:bg-secondary/50 transition mb-4">
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
                  <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm font-medium">Upload an image</div>
                  <div className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG</div>
                </label>
                {uploads.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {uploads.map((src) => (
                      <button key={src} onClick={() => addImageFromSrc(src)}
                        className="aspect-square rounded-md overflow-hidden border border-border hover:border-primary">
                        <img src={src} alt="upload" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tool === "text" && (
              <div className="p-4 space-y-2">
                <PanelHeading>Text</PanelHeading>
                <button onClick={() => addText("heading")} className="w-full text-left px-4 py-4 rounded-xl bg-secondary hover:bg-muted transition">
                  <div className="text-2xl font-bold leading-tight">Add a headline</div>
                </button>
                <button onClick={() => addText("sub")} className="w-full text-left px-4 py-3 rounded-xl bg-secondary hover:bg-muted transition">
                  <div className="text-lg font-medium">Add a subheading</div>
                </button>
                <button onClick={() => addText("body")} className="w-full text-left px-4 py-3 rounded-xl bg-secondary hover:bg-muted transition">
                  <div className="text-sm">Add body text</div>
                </button>
              </div>
            )}
            {tool === "elements" && (
              <div className="p-4">
                <PanelHeading>Shapes</PanelHeading>
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <ShapeBtn onClick={() => addRect()} label="Rectangle"><Square className="w-6 h-6" /></ShapeBtn>
                  <ShapeBtn onClick={() => addCircle()} label="Circle"><CircleIcon className="w-6 h-6" /></ShapeBtn>
                  <ShapeBtn onClick={() => addTriangle()} label="Triangle"><Triangle className="w-6 h-6" /></ShapeBtn>
                  <ShapeBtn onClick={() => addStar()} label="Star"><StarIcon className="w-6 h-6" /></ShapeBtn>
                  <ShapeBtn onClick={addLine} label="Line"><LineIcon className="w-6 h-6" /></ShapeBtn>
                  <ShapeBtn onClick={addArrow} label="Arrow"><MoveRight className="w-6 h-6" /></ShapeBtn>
                </div>
                <PanelHeading>Color fills</PanelHeading>
                <div className="grid grid-cols-6 gap-2">
                  {["#2563eb", "#0f766e", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#7c3aed", "#0ea5e9", "#f43f5e", "#0f172a", "#64748b", "#ffffff"].map((c) => (
                    <button key={c} onClick={() => addRect(c)} className="aspect-square rounded-md border border-border hover:scale-105 transition" style={{ background: c }} />
                  ))}
                </div>
              </div>
            )}
            {tool === "photos" && (
              <div className="p-4">
                <PanelHeading>Photos</PanelHeading>
                <div className="grid grid-cols-2 gap-2">
                  {STOCK_PHOTOS.map((src) => (
                    <button key={src} onClick={() => addImageFromSrc(src)}
                      className="aspect-square rounded-md overflow-hidden border border-border hover:border-primary">
                      <img src={src} alt="stock" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground mt-2">Free photos via Unsplash</div>
              </div>
            )}
            {tool === "background" && (
              <div className="p-4">
                <PanelHeading>Background</PanelHeading>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {BG_SWATCHES.map((c) => (
                    <button key={c} onClick={() => setDesign((d) => ({ ...d, background: c }))}
                      className="aspect-square rounded-md border border-border" style={{ background: c }} />
                  ))}
                </div>
                <input type="color" value={design.background.startsWith("#") ? design.background : "#ffffff"}
                  onChange={(e) => setDesign((d) => ({ ...d, background: e.target.value }))}
                  className="w-full h-10 rounded-md bg-secondary border border-border cursor-pointer" />
              </div>
            )}
          </aside>
        )}

        {/* Canvas */}
        <main
          className="flex-1 relative canvas-dotgrid overflow-hidden"
          onMouseDown={onPanMouseDown}
          onMouseMove={onPanMouseMove}
          onMouseUp={onPanMouseUp}
          onMouseLeave={onPanMouseUp}
        >
          <div ref={containerRef} className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <div className="relative" style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)` }}>
              <Suspense fallback={<div className="text-muted-foreground">Loading canvas…</div>}>
                <CanvasStage
                  design={design}
                  page={activePage}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onChange={updateEl}
                  scale={scale}
                  offset={{ x: 0, y: 0 }}
                  stageRef={stageRef}
                />
              </Suspense>

              {/* Floating actions */}
              <div className="absolute top-0 -right-14 flex flex-col gap-2">
                <FloatAction title="Add page" onClick={addPage}><Plus className="w-4 h-4" /></FloatAction>
                <FloatAction title="Duplicate page" onClick={() => duplicatePage(activePageIdx)}><Copy className="w-4 h-4" /></FloatAction>
                <FloatAction title="Delete page" onClick={() => deletePage(activePageIdx)}><Trash2 className="w-4 h-4" /></FloatAction>
              </div>
            </div>
          </div>

          {/* Bottom: page indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-card border border-border rounded-full shadow-sm px-2 py-1.5">
            <button onClick={addPage} className="h-8 px-3 rounded-full text-sm flex items-center gap-1.5 hover:bg-secondary">
              <span className="w-5 h-5 rounded-full border border-border flex items-center justify-center"><Plus className="w-3 h-3" /></span>
              Add page
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <button onClick={() => setActivePageIdx((i) => Math.max(0, i - 1))} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-secondary" title="Previous page">‹</button>
            <button className="h-8 px-3 rounded-full text-sm flex items-center gap-1.5 hover:bg-secondary">
              <ChevronDown className="w-4 h-4" />
              Page {activePageIdx + 1} of {design.pages.length}
            </button>
            <button onClick={() => setActivePageIdx((i) => Math.min(design.pages.length - 1, i + 1))} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-secondary" title="Next page">›</button>
          </div>

          {/* Zoom */}
          <div className="absolute bottom-4 right-4 flex flex-col items-center bg-card border border-border rounded-full shadow-sm py-1">
            <button onClick={zoomOut} className="w-9 h-9 flex items-center justify-center hover:bg-secondary rounded-full"><Minus className="w-4 h-4" /></button>
            <button onClick={() => setZoom("fit")} className="text-xs px-2 py-0.5 hover:bg-secondary rounded-md">{Math.round(scale * 100)}%</button>
            <button onClick={zoomIn} className="w-9 h-9 flex items-center justify-center hover:bg-secondary rounded-full"><Plus className="w-4 h-4" /></button>
          </div>
        </main>

        {/* Right panel */}
        <aside className="w-[320px] border-l border-border bg-card overflow-y-auto shrink-0 flex flex-col">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-4">
              <button onClick={() => setRightTab("design")}
                className={`text-[17px] font-semibold tracking-tight ${rightTab === "design" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                Design
              </button>
              <button onClick={() => setRightTab("properties")}
                className={`text-[17px] font-semibold tracking-tight ${rightTab === "properties" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                Properties
              </button>
            </div>
            <button className="text-muted-foreground hover:text-foreground text-xl leading-none">···</button>
          </div>

          {rightTab === "design" ? (
            <div className="px-5 pb-5 flex-1">
              <PanelLabel>Size</PanelLabel>
              <button onClick={() => setSizeMenuOpen((v) => !v)}
                className="w-full flex items-center justify-between bg-secondary border border-border rounded-xl px-4 py-3 mb-6 hover:bg-muted transition">
                <div className="text-left">
                  <div className="text-[15px] font-semibold">{sizeName(design.width, design.height)}</div>
                  <div className="text-xs text-muted-foreground">{design.width}px × {design.height}px</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>

              <div className="flex items-center justify-between mb-2">
                <PanelLabel className="mb-0">Background</PanelLabel>
                <button className="text-xs text-accent flex items-center gap-1 hover:underline">
                  <Palette className="w-3.5 h-3.5" /> Solid Color
                </button>
              </div>
              <div className="border border-border rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
                <span className="text-sm">Color</span>
                <label className="w-7 h-7 rounded-md border border-border cursor-pointer overflow-hidden">
                  <input type="color" value={design.background.startsWith("#") ? design.background : "#ffffff"}
                    onChange={(e) => setDesign((d) => ({ ...d, background: e.target.value }))}
                    className="w-10 h-10 -translate-x-1 -translate-y-1 cursor-pointer" />
                </label>
              </div>

              <div className="flex items-center justify-between mb-2">
                <PanelLabel className="mb-0">Styles</PanelLabel>
                <button className="text-muted-foreground hover:text-foreground"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="space-y-2 mb-6">
                {STYLE_PALETTES.map((p, i) => (
                  <button key={i} onClick={() => applyPalette(p)} className="w-full flex rounded-md overflow-hidden border border-border hover:ring-2 hover:ring-accent transition h-8">
                    {p.map((c, j) => (
                      <div key={j} className="flex-1" style={{ background: c }} />
                    ))}
                  </button>
                ))}
              </div>

              <PanelLabel>Title</PanelLabel>
              <input value={design.name}
                onChange={(e) => setDesign((d) => ({ ...d, name: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-card focus:border-primary focus:outline-none mb-6" />

              <PanelLabel>Layout</PanelLabel>
              <ToggleRow label="Grid" icon={<Shapes className="w-4 h-4" />} />
              <ToggleRow label="Folds" icon={<LayoutTemplate className="w-4 h-4" />} value="None" />
              <ToggleRow label="Bleed" icon={<Palette className="w-4 h-4" />} />
            </div>
          ) : (
            <PropertiesPanel
              el={selected}
              onChange={(p) => selectedId && updateEl(selectedId, p)}
              onDelete={deleteSel}
              onDuplicate={duplicateSel}
              onBringForward={() => reorder("up")}
              onSendBackward={() => reorder("down")}
            />
          )}

          <div className="p-4 border-t border-border">
            <button className="w-full h-11 rounded-xl bg-[#3f4a5b] text-white text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90">
              <Layers className="w-4 h-4" /> Arrange Layers
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------- small subcomponents ----------
function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick?: () => void }) {
  return (
    <button title={title} onClick={onClick} className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
      {children}
    </button>
  );
}

function RailBtn({ active, onClick, icon, label }: { active?: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`relative w-[64px] py-2.5 rounded-lg flex flex-col items-center justify-center gap-1 mb-1 transition ${
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" />}
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

function FloatAction({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick}
      className="w-11 h-11 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center hover:bg-secondary text-foreground">
      {children}
    </button>
  );
}

function PanelHeading({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] font-semibold mb-3">{children}</div>;
}
function PanelLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 ${className}`}>{children}</div>;
}

function ShapeBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label}
      className="aspect-square rounded-lg border border-border hover:border-primary hover:bg-secondary flex items-center justify-center text-foreground">
      {children}
    </button>
  );
}

function ToggleRow({ label, icon, value }: { label: string; icon: React.ReactNode; value?: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5 text-sm">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-xs text-muted-foreground">⊘ {value}</span>}
        <button onClick={() => setOn((v) => !v)} className={`w-9 h-5 rounded-full transition ${on ? "bg-primary" : "bg-muted"}`}>
          <div className={`w-4 h-4 rounded-full bg-card border border-border transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>
    </div>
  );
}

function sizeName(w: number, h: number) {
  const preset = SIZE_PRESETS.find((p) => p.w === w && p.h === h);
  if (preset) return preset.label;
  if (w === h) return "Square";
  return w > h ? "Landscape" : "Portrait";
}