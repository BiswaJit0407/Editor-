export type ElementBase = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  draggable: boolean;
};

export type TextElement = ElementBase & {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: string; // "normal" | "bold" | "italic" | "bold italic"
  fill: string;
  width: number;
  align: "left" | "center" | "right";
};

export type RectElement = ElementBase & {
  type: "rect";
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
};

export type CircleElement = ElementBase & {
  type: "circle";
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export type ImageElement = ElementBase & {
  type: "image";
  src: string;
  width: number;
  height: number;
};

export type TriangleElement = ElementBase & {
  type: "triangle";
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export type StarElement = ElementBase & {
  type: "star";
  numPoints: number;
  innerRadius: number;
  outerRadius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export type LineElement = ElementBase & {
  type: "line";
  points: number[]; // [x1,y1,x2,y2]
  stroke: string;
  strokeWidth: number;
};

export type ArrowElement = ElementBase & {
  type: "arrow";
  points: number[];
  stroke: string;
  strokeWidth: number;
  fill: string;
  pointerLength: number;
  pointerWidth: number;
};

export type CanvasElement =
  | TextElement | RectElement | CircleElement | ImageElement
  | TriangleElement | StarElement | LineElement | ArrowElement;

export type Page = {
  id: string;
  elements: CanvasElement[];
};

export type Design = {
  id: string;
  name: string;
  width: number;
  height: number;
  background: string;
  pages: Page[];
  updatedAt: number;
  thumbnail?: string;
};

type WithoutId<T> = T extends { id: string } ? Omit<T, "id"> : T;
export type TemplateElement = WithoutId<CanvasElement>;

export type Template = {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  background: string;
  elements: TemplateElement[];
};

export const uid = () => Math.random().toString(36).slice(2, 10);