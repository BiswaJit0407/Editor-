import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createBlank, listDesigns, saveDesign } from "@/lib/design-store";
import type { Design } from "@/lib/editor-types";
import Editor from "@/components/Editor";

export const Route = createFileRoute("/")({
  component: EditorPage,
});

function EditorPage() {
  const [design, setDesign] = useState<Design | null>(null);

  useEffect(() => {
    const list = listDesigns();
    if (list.length > 0) {
      setDesign(list[0]);
    } else {
      const blank = createBlank();
      saveDesign(blank);
      setDesign(blank);
    }
  }, []);

  if (!design) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  }
  return <Editor initial={design} />;
}
