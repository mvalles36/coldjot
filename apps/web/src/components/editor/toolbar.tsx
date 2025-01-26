"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  COMMAND_PRIORITY_NORMAL,
  $getSelection,
  $isRangeSelection,
  ElementFormatType,
  $createParagraphNode,
  $getNodeByKey,
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $isHeadingNode } from "@lexical/rich-text";
import { useCallback, useEffect, useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Code,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
} from "lucide-react";
import { INSERT_COMPONENT_COMMAND } from "./plugins/component-picker-plugin";

const blockTypeToBlockName = {
  paragraph: "Normal",
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  h4: "Heading 4",
  h5: "Heading 5",
  h6: "Heading 6",
} as const;

export function Toolbar() {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockType] =
    useState<keyof typeof blockTypeToBlockName>("paragraph");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isCode, setIsCode] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    setIsBold(selection.hasFormat("bold"));
    setIsItalic(selection.hasFormat("italic"));
    setIsUnderline(selection.hasFormat("underline"));
    setIsCode(selection.hasFormat("code"));

    const anchorNode = selection.anchor.getNode();
    const element =
      anchorNode.getKey() === "root"
        ? anchorNode
        : anchorNode.getTopLevelElement();

    if (element) {
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);
      if (elementDOM) {
        if ($isHeadingNode(element)) {
          const tag = element.getTag();
          setBlockType(tag);
        } else {
          setBlockType("paragraph");
        }
      }
    }
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_NORMAL
    );
  }, [editor, updateToolbar]);

  const formatHeading = (headingSize: keyof typeof blockTypeToBlockName) => {
    if (headingSize === "paragraph") {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      });
    } else {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(headingSize));
        }
      });
    }
  };

  return (
    <div className="border-b flex items-center gap-1 p-1">
      <Select
        value={blockType}
        onValueChange={(value: keyof typeof blockTypeToBlockName) =>
          formatHeading(value)
        }
      >
        <SelectTrigger className="w-[180px] h-8">
          <SelectValue placeholder="Style" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(blockTypeToBlockName).map(([type, name]) => (
            <SelectItem key={type} value={type}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle
        size="sm"
        pressed={isBold}
        onPressedChange={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
        }}
        aria-label="Bold"
      >
        <Bold className="h-4 w-4" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={isItalic}
        onPressedChange={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
        }}
        aria-label="Italic"
      >
        <Italic className="h-4 w-4" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={isUnderline}
        onPressedChange={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
        }}
        aria-label="Underline"
      >
        <Underline className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle
        size="sm"
        onPressedChange={() => {
          editor.dispatchCommand(
            FORMAT_ELEMENT_COMMAND,
            "left" as ElementFormatType
          );
        }}
        aria-label="Align Left"
      >
        <AlignLeft className="h-4 w-4" />
      </Toggle>

      <Toggle
        size="sm"
        onPressedChange={() => {
          editor.dispatchCommand(
            FORMAT_ELEMENT_COMMAND,
            "center" as ElementFormatType
          );
        }}
        aria-label="Align Center"
      >
        <AlignCenter className="h-4 w-4" />
      </Toggle>

      <Toggle
        size="sm"
        onPressedChange={() => {
          editor.dispatchCommand(
            FORMAT_ELEMENT_COMMAND,
            "right" as ElementFormatType
          );
        }}
        aria-label="Align Right"
      >
        <AlignRight className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle
        size="sm"
        onPressedChange={() => {
          editor.dispatchCommand(
            FORMAT_ELEMENT_COMMAND,
            "bullet" as ElementFormatType
          );
        }}
        aria-label="Bullet List"
      >
        <List className="h-4 w-4" />
      </Toggle>

      <Toggle
        size="sm"
        onPressedChange={() => {
          editor.dispatchCommand(
            FORMAT_ELEMENT_COMMAND,
            "number" as ElementFormatType
          );
        }}
        aria-label="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle
        size="sm"
        onPressedChange={() => {
          editor.dispatchCommand(
            FORMAT_ELEMENT_COMMAND,
            "quote" as ElementFormatType
          );
        }}
        aria-label="Quote"
      >
        <Quote className="h-4 w-4" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={isCode}
        onPressedChange={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
        }}
        aria-label="Code"
      >
        <Code className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle
        size="sm"
        onPressedChange={() => {
          editor.dispatchCommand(INSERT_COMPONENT_COMMAND, undefined);
        }}
        aria-label="Insert Component"
      >
        <Plus className="h-4 w-4" />
      </Toggle>
    </div>
  );
}
