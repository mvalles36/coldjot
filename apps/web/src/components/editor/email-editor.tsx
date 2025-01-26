"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toolbar } from "./toolbar";
import { editorConfig } from "./editor-config";
import { DragDropPlugin } from "./plugins/drag-drop-plugin";
import { ImagePlugin } from "./plugins/image-plugin";
import { ComponentPickerPlugin } from "./plugins/component-picker-plugin";

function LexicalErrorBoundary({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function EmailEditor() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="space-y-4">
        <Input
          type="text"
          placeholder="Subject line"
          className="text-lg font-medium"
        />
        <LexicalComposer initialConfig={editorConfig}>
          <div className="min-h-[400px] rounded-md border">
            <Toolbar />
            <div className="relative">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable className="min-h-[300px] px-4 py-3 outline-none" />
                }
                placeholder={
                  <div className="pointer-events-none absolute left-4 top-3 text-muted-foreground">
                    Write your email...
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <ListPlugin />
              <LinkPlugin />
              <TablePlugin />
              <TabIndentationPlugin />
              <MarkdownShortcutPlugin />
              <DragDropPlugin />
              <ImagePlugin />
              <ComponentPickerPlugin />
            </div>
          </div>
        </LexicalComposer>
      </div>
      <div className="space-y-2">
        <Input type="text" placeholder="Add your button text" />
        <Button className="w-full">Update payment information</Button>
      </div>
    </div>
  );
}
