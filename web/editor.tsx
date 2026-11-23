import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import "monaco-editor/esm/vs/basic-languages/rust/rust.contribution";
import "monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution";
import type { FileView } from "../shared/types";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
const languages: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  md: "markdown",
  py: "python",
  rs: "rust",
  yml: "yaml",
  yaml: "yaml",
};
export default function EditorPane({
  file,
  start,
  end,
  change,
  navigate,
}: {
  file: FileView;
  start: number;
  end: number;
  change: (a: number, b: number) => void;
  navigate: (symbol: string, kind: "definition" | "reference") => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    notify = useRef(change),
    navigation = useRef(navigate);
  notify.current = change;
  navigation.current = navigate;
  useEffect(() => {
    if (!container.current) return;
    const model = monaco.editor.createModel(
      file.content ?? "",
      languages[file.path.split(".").pop()!] ?? "plaintext",
    );
    const editor = monaco.editor.create(container.current, {
      model,
      readOnly: true,
      domReadOnly: true,
      automaticLayout: true,
      ariaLabel: "固定版本源码，" + file.path,
      theme: "vs",
      fontSize: 14,
      lineHeight: 23,
      glyphMargin: true,
      lineNumbersMinChars: 3,
      minimap: { enabled: false },
      tabSize: 4,
      scrollBeyondLastLine: false,
      contextmenu: false,
      folding: false,
      fixedOverflowWidgets: true,
      renderLineHighlight: "line",
      fontFamily: "'Cascadia Code', Consolas, monospace",
    });
    editor.setPosition({ lineNumber: start, column: 1 });
    editor.setScrollTop(editor.getTopForLineNumber(start), monaco.editor.ScrollType.Immediate);
    editor.createDecorationsCollection([
      {
        range: new monaco.Range(start, 1, end, model.getLineMaxColumn(end)),
        options: {
          isWholeLine: true,
          className: "evidence-highlight",
          linesDecorationsClassName: "line-mark",
        },
      },
    ]);
    const listener = editor.onDidChangeCursorSelection((e) =>
      notify.current(e.selection.startLineNumber, e.selection.endLineNumber),
    );
    const actions = (["definition", "reference"] as const).map((kind) =>
      editor.addAction({
        id: "academy." + kind,
        label: kind === "definition" ? "查找定义候选" : "查找引用候选",
        keybindings: [
          kind === "definition" ? monaco.KeyCode.F12 : monaco.KeyMod.Shift | monaco.KeyCode.F12,
        ],
        run: () => {
          const position = editor.getPosition();
          const word = position && model.getWordAtPosition(position);
          if (word) navigation.current(word.word, kind);
        },
      }),
    );
    return () => {
      actions.forEach((action) => action.dispose());
      listener.dispose();
      editor.dispose();
      model.dispose();
    };
  }, [file.oid, file.path, start, end]);
  return <div ref={container} className="editor-surface" />;
}
