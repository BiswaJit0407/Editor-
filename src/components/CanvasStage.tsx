import { useEffect, useRef } from "react";
import {
  Stage, Layer, Rect, Circle, Text, Image as KImage, Transformer,
  RegularPolygon, Star, Line, Arrow,
} from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import type { CanvasElement, Design, ImageElement, Page } from "@/lib/editor-types";

type Props = {
  design: Design;
  page: Page;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<CanvasElement>) => void;
  scale: number;
  offset: { x: number; y: number };
  stageRef: React.MutableRefObject<Konva.Stage | null>;
};

function URLImage({ el, onSelect, onChange, isSelected }: {
  el: ImageElement;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasElement>) => void;
  isSelected: boolean;
}) {
  const [img] = useImage(el.src, "anonymous");
  const ref = useRef<Konva.Image>(null);
  return (
    <KImage
      ref={ref}
      image={img}
      x={el.x}
      y={el.y}
      width={el.width}
      height={el.height}
      rotation={el.rotation}
      opacity={el.opacity}
      draggable={el.draggable}
      onClick={onSelect}
      onTap={onSelect}
      id={el.id}
      name={isSelected ? "selected" : ""}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = ref.current;
        if (!node) return;
        const sx = node.scaleX();
        const sy = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(10, node.width() * sx),
          height: Math.max(10, node.height() * sy),
        });
      }}
    />
  );
}

export default function CanvasStage({ design, page, selectedId, onSelect, onChange, scale, offset, stageRef }: Props) {
  const trRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);

  useEffect(() => {
    const tr = trRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;
    if (!selectedId) {
      tr.nodes([]);
      layer.batchDraw();
      return;
    }
    const node = layer.findOne(`#${selectedId}`);
    tr.nodes(node ? [node] : []);
    layer.batchDraw();
  }, [selectedId, page.elements]);

  const bgClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage() || e.target.attrs.id === "__bg") {
      onSelect(null);
    }
  };

  return (
    <div
      style={{
        background: design.background,
        boxShadow: "0 1px 3px rgba(15,23,42,0.06), 0 20px 40px rgba(15,23,42,0.10)",
        width: design.width * scale,
        height: design.height * scale,
        borderRadius: 4,
      }}
    >
    <Stage
      ref={(r) => { stageRef.current = r; }}
      width={design.width * scale}
      height={design.height * scale}
      scaleX={scale}
      scaleY={scale}
      x={offset.x}
      y={offset.y}
      onMouseDown={bgClick}
      onTouchStart={bgClick}
    >
      <Layer ref={layerRef}>
        <Rect id="__bg" x={0} y={0} width={design.width} height={design.height} fill={design.background} listening />
        {page.elements.map((el) => {
          const common = {
            key: el.id,
            id: el.id,
            x: el.x,
            y: el.y,
            rotation: el.rotation,
            opacity: el.opacity,
            draggable: el.draggable,
            onClick: () => onSelect(el.id),
            onTap: () => onSelect(el.id),
            onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
              onChange(el.id, { x: e.target.x(), y: e.target.y() }),
          };
          if (el.type === "rect") {
            return (
              <Rect
                {...common}
                width={el.width}
                height={el.height}
                fill={el.fill || undefined}
                stroke={el.stroke || undefined}
                strokeWidth={el.strokeWidth}
                cornerRadius={el.cornerRadius}
                onTransformEnd={(e) => {
                  const n = e.target as Konva.Rect;
                  const sx = n.scaleX();
                  const sy = n.scaleY();
                  n.scaleX(1); n.scaleY(1);
                  onChange(el.id, {
                    x: n.x(), y: n.y(), rotation: n.rotation(),
                    width: Math.max(4, n.width() * sx),
                    height: Math.max(4, n.height() * sy),
                  });
                }}
              />
            );
          }
          if (el.type === "circle") {
            return (
              <Circle
                {...common}
                radius={el.radius}
                fill={el.fill || undefined}
                stroke={el.stroke || undefined}
                strokeWidth={el.strokeWidth}
                onTransformEnd={(e) => {
                  const n = e.target as Konva.Circle;
                  const s = Math.max(n.scaleX(), n.scaleY());
                  n.scaleX(1); n.scaleY(1);
                  onChange(el.id, {
                    x: n.x(), y: n.y(), rotation: n.rotation(),
                    radius: Math.max(4, el.radius * s),
                  });
                }}
              />
            );
          }
          if (el.type === "text") {
            return (
              <Text
                {...common}
                text={el.text}
                fontSize={el.fontSize}
                fontFamily={el.fontFamily}
                fontStyle={el.fontStyle}
                fill={el.fill}
                width={el.width}
                align={el.align}
                onTransformEnd={(e) => {
                  const n = e.target as Konva.Text;
                  const sx = n.scaleX();
                  n.scaleX(1); n.scaleY(1);
                  onChange(el.id, {
                    x: n.x(), y: n.y(), rotation: n.rotation(),
                    width: Math.max(20, n.width() * sx),
                    fontSize: Math.max(6, el.fontSize * sx),
                  });
                }}
              />
            );
          }
          if (el.type === "triangle") {
            return (
              <RegularPolygon
                {...common}
                sides={3}
                radius={el.radius}
                fill={el.fill || undefined}
                stroke={el.stroke || undefined}
                strokeWidth={el.strokeWidth}
                onTransformEnd={(e) => {
                  const n = e.target as Konva.RegularPolygon;
                  const s = Math.max(n.scaleX(), n.scaleY());
                  n.scaleX(1); n.scaleY(1);
                  onChange(el.id, { x: n.x(), y: n.y(), rotation: n.rotation(), radius: Math.max(4, el.radius * s) });
                }}
              />
            );
          }
          if (el.type === "star") {
            return (
              <Star
                {...common}
                numPoints={el.numPoints}
                innerRadius={el.innerRadius}
                outerRadius={el.outerRadius}
                fill={el.fill || undefined}
                stroke={el.stroke || undefined}
                strokeWidth={el.strokeWidth}
                onTransformEnd={(e) => {
                  const n = e.target as Konva.Star;
                  const s = Math.max(n.scaleX(), n.scaleY());
                  n.scaleX(1); n.scaleY(1);
                  onChange(el.id, {
                    x: n.x(), y: n.y(), rotation: n.rotation(),
                    innerRadius: Math.max(4, el.innerRadius * s),
                    outerRadius: Math.max(4, el.outerRadius * s),
                  });
                }}
              />
            );
          }
          if (el.type === "line") {
            return (
              <Line
                {...common}
                points={el.points}
                stroke={el.stroke}
                strokeWidth={el.strokeWidth}
                lineCap="round"
                hitStrokeWidth={Math.max(16, el.strokeWidth + 12)}
                onTransformEnd={(e) => {
                  const n = e.target as Konva.Line;
                  const sx = n.scaleX();
                  const sy = n.scaleY();
                  n.scaleX(1); n.scaleY(1);
                  const scaled = el.points.map((p, idx) => p * (idx % 2 === 0 ? sx : sy));
                  onChange(el.id, { x: n.x(), y: n.y(), rotation: n.rotation(), points: scaled });
                }}
              />
            );
          }
          if (el.type === "arrow") {
            return (
              <Arrow
                {...common}
                points={el.points}
                stroke={el.stroke}
                fill={el.fill}
                strokeWidth={el.strokeWidth}
                pointerLength={el.pointerLength}
                pointerWidth={el.pointerWidth}
                hitStrokeWidth={Math.max(16, el.strokeWidth + 12)}
                onTransformEnd={(e) => {
                  const n = e.target as Konva.Arrow;
                  const sx = n.scaleX();
                  const sy = n.scaleY();
                  n.scaleX(1); n.scaleY(1);
                  const scaled = el.points.map((p, idx) => p * (idx % 2 === 0 ? sx : sy));
                  onChange(el.id, { x: n.x(), y: n.y(), rotation: n.rotation(), points: scaled });
                }}
              />
            );
          }
          return (
            <URLImage
              key={el.id}
              el={el}
              isSelected={selectedId === el.id}
              onSelect={() => onSelect(el.id)}
              onChange={(p) => onChange(el.id, p)}
            />
          );
        })}
        <Transformer
          ref={trRef}
          rotateEnabled
          anchorSize={10}
          borderStroke="#2563eb"
          anchorStroke="#2563eb"
          anchorFill="#ffffff"
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) return oldBox;
            return newBox;
          }}
        />
      </Layer>
    </Stage>
    </div>
  );
}