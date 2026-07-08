import type { CanvasElement } from "@/lib/editor-types";

type Props = {
  el: CanvasElement | null;
  onChange: (patch: Partial<CanvasElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
};

const FONTS = ["Helvetica", "Georgia", "Impact", "Courier New", "Times New Roman", "Verdana"];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-secondary text-foreground text-sm rounded-md px-2 py-1.5 border border-border focus:border-primary focus:outline-none";

export default function PropertiesPanel({ el, onChange, onDelete, onDuplicate, onBringForward, onSendBackward }: Props) {
  if (!el) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select an element to edit its properties.
      </div>
    );
  }
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{el.type}</div>
        <div className="flex gap-1">
          <button onClick={onSendBackward} className="px-2 py-1 text-xs bg-secondary hover:bg-muted rounded" title="Send backward">↓</button>
          <button onClick={onBringForward} className="px-2 py-1 text-xs bg-secondary hover:bg-muted rounded" title="Bring forward">↑</button>
          <button onClick={onDuplicate} className="px-2 py-1 text-xs bg-secondary hover:bg-muted rounded">Copy</button>
          <button onClick={onDelete} className="px-2 py-1 text-xs bg-destructive/80 hover:bg-destructive text-destructive-foreground rounded">Del</button>
        </div>
      </div>

      {el.type === "text" && (
        <>
          <Row label="Text">
            <textarea
              className={inputCls + " min-h-[70px] resize-y"}
              value={el.text}
              onChange={(e) => onChange({ text: e.target.value })}
            />
          </Row>
          <Row label="Font">
            <select className={inputCls} value={el.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })}>
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Size">
              <input type="number" className={inputCls} value={el.fontSize}
                onChange={(e) => onChange({ fontSize: Number(e.target.value) })} />
            </Row>
            <Row label="Color">
              <input type="color" className="w-full h-9 rounded-md bg-secondary border border-border cursor-pointer"
                value={el.fill} onChange={(e) => onChange({ fill: e.target.value })} />
            </Row>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Style">
              <select className={inputCls} value={el.fontStyle} onChange={(e) => onChange({ fontStyle: e.target.value })}>
                <option value="normal">Regular</option>
                <option value="bold">Bold</option>
                <option value="italic">Italic</option>
                <option value="bold italic">Bold Italic</option>
              </select>
            </Row>
            <Row label="Align">
              <select className={inputCls} value={el.align} onChange={(e) => onChange({ align: e.target.value as "left" | "center" | "right" })}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </Row>
          </div>
        </>
      )}

      {(el.type === "rect" || el.type === "circle") && (
        <>
          <Row label="Fill">
            <input type="color" className="w-full h-9 rounded-md bg-secondary border border-border cursor-pointer"
              value={el.fill || "#000000"} onChange={(e) => onChange({ fill: e.target.value })} />
          </Row>
          <Row label="Stroke">
            <input type="color" className="w-full h-9 rounded-md bg-secondary border border-border cursor-pointer"
              value={el.stroke || "#000000"} onChange={(e) => onChange({ stroke: e.target.value })} />
          </Row>
          <Row label="Stroke width">
            <input type="number" className={inputCls} value={el.strokeWidth}
              onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })} />
          </Row>
          {el.type === "rect" && (
            <Row label="Corner radius">
              <input type="number" className={inputCls} value={el.cornerRadius}
                onChange={(e) => onChange({ cornerRadius: Number(e.target.value) })} />
            </Row>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Row label="X"><input type="number" className={inputCls} value={Math.round(el.x)} onChange={(e) => onChange({ x: Number(e.target.value) })} /></Row>
        <Row label="Y"><input type="number" className={inputCls} value={Math.round(el.y)} onChange={(e) => onChange({ y: Number(e.target.value) })} /></Row>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Rotation"><input type="number" className={inputCls} value={Math.round(el.rotation)} onChange={(e) => onChange({ rotation: Number(e.target.value) })} /></Row>
        <Row label="Opacity"><input type="number" step="0.05" min={0} max={1} className={inputCls} value={el.opacity} onChange={(e) => onChange({ opacity: Number(e.target.value) })} /></Row>
      </div>
    </div>
  );
}