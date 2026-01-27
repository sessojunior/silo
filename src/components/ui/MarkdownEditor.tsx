"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import "easymde/dist/easymde.min.css";
import type { Options as SimpleMdeOptions } from "easymde";

const SimpleMdeReact = dynamic(() => import("react-simplemde-editor"), {
  ssr: false,
});

const defaultOptions: SimpleMdeOptions = {
  autofocus: true,
  spellChecker: false,
};

const markdownEditorStyles = `
.EasyMDEContainer .CodeMirror{font-size:1rem;line-height:1.6}
.EasyMDEContainer .CodeMirror .cm-header-1{font-size:1.5rem;font-weight:700}
.EasyMDEContainer .CodeMirror .cm-header-2{font-size:1.25rem;font-weight:600}
.EasyMDEContainer .CodeMirror .cm-header-3{font-size:1.125rem;font-weight:500}
.EasyMDEContainer .CodeMirror .cm-header-4{font-size:1rem;font-weight:500}
.EasyMDEContainer .CodeMirror-line{padding:0.25rem 0}
.EasyMDEContainer .editor-preview,
.EasyMDEContainer .editor-preview-side{font-size:1rem;line-height:1.6}
.EasyMDEContainer .editor-preview h1,
.EasyMDEContainer .editor-preview-side h1{font-size:1.5rem;font-weight:700;margin:0.5rem 0}
.EasyMDEContainer .editor-preview h2,
.EasyMDEContainer .editor-preview-side h2{font-size:1.25rem;font-weight:600;margin:0.5rem 0}
.EasyMDEContainer .editor-preview h3,
.EasyMDEContainer .editor-preview-side h3{font-size:1.125rem;font-weight:500;margin:0.5rem 0}
.EasyMDEContainer .editor-preview h4,
.EasyMDEContainer .editor-preview-side h4{font-size:1rem;font-weight:500;margin:0.5rem 0}
.EasyMDEContainer .editor-preview p,
.EasyMDEContainer .editor-preview-side p{margin:0.5rem 0}
.EasyMDEContainer .editor-preview ul,
.EasyMDEContainer .editor-preview-side ul{padding-left:1.25rem;list-style:disc}
.EasyMDEContainer .editor-preview ol,
.EasyMDEContainer .editor-preview-side ol{padding-left:1rem;list-style:decimal}
.EasyMDEContainer .editor-preview blockquote,
.EasyMDEContainer .editor-preview-side blockquote{border-left:4px solid rgb(228 228 231);padding-left:1rem;font-style:italic}
.EasyMDEContainer .editor-preview pre,
.EasyMDEContainer .editor-preview-side pre{background-color:rgb(244 244 245);padding:0.75rem;border-radius:0.5rem;overflow:auto}
.EasyMDEContainer .editor-preview code,
.EasyMDEContainer .editor-preview-side code{background-color:rgb(244 244 245);padding:0.125rem 0.25rem;border-radius:0.25rem;font-size:0.75rem}
.dark .EasyMDEContainer .editor-preview blockquote,
.dark .EasyMDEContainer .editor-preview-side blockquote{border-color:rgb(63 63 70)}
.dark .EasyMDEContainer .editor-preview pre,
.dark .EasyMDEContainer .editor-preview-side pre{background-color:rgb(39 39 42)}
.dark .EasyMDEContainer .editor-preview code,
.dark .EasyMDEContainer .editor-preview-side code{background-color:rgb(39 39 42)}
`;

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  options?: SimpleMdeOptions;
  className?: string;
}

export default function MarkdownEditor({
  value,
  onChange,
  options,
  className,
}: MarkdownEditorProps) {
  const mergedOptions = useMemo(() => {
    return {
      ...defaultOptions,
      ...(options ?? {}),
    };
  }, [options]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: markdownEditorStyles }} />
      <SimpleMdeReact
        value={value}
        onChange={(val: string) => onChange(val || "")}
        options={mergedOptions}
        className={className}
      />
    </>
  );
}
