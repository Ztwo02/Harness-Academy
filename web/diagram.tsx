import { useEffect, useId, useState } from "react";
import mermaid from "mermaid/dist/mermaid.esm.min.mjs";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "neutral",
  flowchart: { htmlLabels: false },
});
export default function FlowDiagram({ project = "pi" }: { project?: "pi" | "codex" }) {
  const id = "flow" + useId().replace(/[^a-z0-9]/gi, "");
  const text =
    project === "codex"
      ? "CLI exec → 内嵌 app-server → core Session → RegularTask → run_turn"
      : "agentLoop → runAgentLoop → runLoop";
  const graph =
    project === "codex"
      ? "flowchart LR\n A[CLI exec] --> B[内嵌 app-server] --> C[core Session] --> D[RegularTask] --> E[run_turn]"
      : "flowchart LR\n A[agentLoop] --> B[runAgentLoop] --> C[runLoop]";
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let active = true;
    // Only this reviewed, static graph is rendered. Course prose is always React text.
    mermaid
      .render(id, graph)
      .then((result) => {
        if (active) setSvg(result.svg);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, graph]);
  return (
    <figure className="diagram">
      <figcaption>核心运行时的调用顺序</figcaption>
      {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <code>{text}</code>}
    </figure>
  );
}
