import { useEffect, useId, useState } from "react";
import mermaid from "mermaid/dist/mermaid.esm.min.mjs";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "neutral",
  flowchart: { htmlLabels: false },
});
export default function FlowDiagram() {
  const id = "pi" + useId().replace(/[^a-z0-9]/gi, "");
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let active = true;
    // Only this reviewed, static graph is rendered. Course prose is always React text.
    mermaid
      .render(id, "flowchart LR\n A[agentLoop] --> B[runAgentLoop] --> C[runLoop]")
      .then((result) => {
        if (active) setSvg(result.svg);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <figure className="diagram">
      <figcaption>核心运行时的调用顺序</figcaption>
      {svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <code>agentLoop → runAgentLoop → runLoop</code>
      )}
    </figure>
  );
}
