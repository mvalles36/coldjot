"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_LOW, createCommand } from "lexical";
import { useEffect } from "react";
import { $isDraggableBlockNode } from "../nodes/draggable-block-node";

export const DRAG_DROP_PASTE = createCommand("DRAG_DROP_PASTE");

export function DragDropPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      DRAG_DROP_PASTE,
      (files) => {
        (async () => {
          const filesResult = await Promise.all(
            files.map(async (file: File) => {
              const result = await readFile(file);
              return { file, result };
            })
          );

          editor.update(() => {
            for (const { file, result } of filesResult) {
              if (file.type.startsWith("image/")) {
                // Handle image upload and insertion
                console.log("Image dropped:", file.name);
              }
            }
          });
        })();
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

  useEffect(() => {
    const handleDragStart = (event: DragEvent) => {
      const node = event.target as HTMLElement;
      const draggableNode = editor.getEditorState().read(() => {
        const domNode = editor.getElementByKey(
          node.dataset.lexicalNodeKey || ""
        );
        if (!domNode) return null;
        return $isDraggableBlockNode(domNode) ? domNode : null;
      });

      if (draggableNode) {
        event.dataTransfer?.setData("text/plain", "dragging");
      }
    };

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
    };

    const handleDrop = async (event: DragEvent) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer?.files || []);
      if (files.length > 0) {
        editor.dispatchCommand(DRAG_DROP_PASTE, files);
      }
    };

    return editor.registerRootListener(
      (
        rootElement: HTMLElement | null,
        prevRootElement: HTMLElement | null
      ) => {
        if (prevRootElement) {
          prevRootElement.removeEventListener("dragstart", handleDragStart);
          prevRootElement.removeEventListener("dragover", handleDragOver);
          prevRootElement.removeEventListener("drop", handleDrop);
        }

        if (rootElement) {
          rootElement.addEventListener("dragstart", handleDragStart);
          rootElement.addEventListener("dragover", handleDragOver);
          rootElement.addEventListener("drop", handleDrop);
        }
      }
    );
  }, [editor]);

  return null;
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(file);
  });
}
