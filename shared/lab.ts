// This engine consumes teaching data only. It never imports or executes upstream code.
export type LabScenario = "success" | "error" | "unknown-tool";
export interface LabInput {
  prompt: string;
  scenario: LabScenario;
}
export interface LabState {
  phase: "idle" | "thinking" | "tool" | "finished";
  messages: { role: "user" | "assistant" | "toolResult"; text: string; isError?: boolean }[];
  toolResult: string | null;
}
export interface LabEvent {
  index: number;
  type: string;
  detail: string;
  sourceTopic: "loop" | "tools" | "events";
  before: LabState;
  after: LabState;
}
export interface LabRun {
  input: LabInput;
  events: LabEvent[];
  state: LabState;
  status: "ready" | "paused" | "playing" | "completed";
  cursor: number;
  total: number;
}
const initial = (): LabState => ({ phase: "idle", messages: [], toolResult: null });

export function labSequence(input: LabInput): LabEvent[] {
  if (
    !input.prompt.trim() ||
    input.prompt.length > 1000 ||
    !["success", "error", "unknown-tool"].includes(input.scenario)
  )
    throw new Error("请选择场景并输入 1–1000 字的教学问题。");
  const events: LabEvent[] = [];
  let state = initial();
  const add = (
    type: string,
    detail: string,
    sourceTopic: LabEvent["sourceTopic"],
    change?: (s: LabState) => void,
  ) => {
    const before = structuredClone(state);
    change?.(state);
    events.push({
      index: events.length + 1,
      type,
      detail,
      sourceTopic,
      before,
      after: structuredClone(state),
    });
  };
  const message = (role: LabState["messages"][number]["role"], text: string, isError?: boolean) => {
    add("message_start", role + " 开始（教学模拟省略流式增量）", "events");
    add("message_end", text, "events", (s) => {
      s.messages.push({ role, text, ...(isError === undefined ? {} : { isError }) });
    });
  };
  add("agent_start", "开始教学轮次", "loop", (s) => {
    s.phase = "thinking";
  });
  add("turn_start", "第一轮：Mock LLM 返回工具调用", "loop");
  message("user", input.prompt);
  message(
    "assistant",
    input.scenario === "unknown-tool" ? "调用 missing_tool" : "调用 lookup_order(orderId=42)",
  );
  add("tool_execution_start", "Mock Tool：只读取固定教学订单", "tools", (s) => {
    s.phase = "tool";
  });
  const isError = input.scenario !== "success";
  const result =
    input.scenario === "success"
      ? "订单 42：已发货"
      : input.scenario === "error"
        ? "Mock Tool 抛出：订单服务暂不可用"
        : "Tool missing_tool not found";
  add(
    "tool_execution_end",
    result + (isError ? " · isError=true" : " · isError=false"),
    "tools",
    (s) => {
      s.toolResult = result;
    },
  );
  message("toolResult", result, isError);
  add("turn_end", "第一轮结束，工具结果进入上下文", "loop", (s) => {
    s.phase = "thinking";
  });
  add("turn_start", "第二轮：Mock LLM 消费工具结果", "loop");
  message("assistant", isError ? "查询未完成，请稍后重试。" : "你的订单已发货。");
  add("turn_end", "没有新的工具调用", "loop");
  add("agent_end", "教学实验完成", "loop", (s) => {
    s.phase = "finished";
  });
  return events;
}

export interface LabClock {
  schedule: (callback: () => void, delay: number) => unknown;
  cancel: (handle: unknown) => void;
}
const clock: LabClock = {
  schedule: (fn, ms) => setTimeout(fn, ms),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
export class LabPlayer {
  private sequence: LabEvent[];
  private input: LabInput;
  private cursor = 0;
  private status: LabRun["status"] = "ready";
  private timer: unknown;
  private generation = 0;
  private listeners = new Set<() => void>();
  private clock: LabClock;
  constructor(input: LabInput, timerClock: LabClock = clock) {
    this.sequence = labSequence(input);
    this.input = structuredClone(input);
    this.clock = timerClock;
  }
  snapshot(): LabRun {
    return structuredClone({
      input: this.input,
      events: this.sequence.slice(0, this.cursor),
      state: this.cursor ? this.sequence[this.cursor - 1].after : initial(),
      status: this.status,
      cursor: this.cursor,
      total: this.sequence.length,
    });
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit() {
    this.listeners.forEach((fn) => fn());
  }
  private stop() {
    this.generation++;
    this.clock.cancel(this.timer);
    this.timer = undefined;
  }
  private advance() {
    if (this.cursor < this.sequence.length) this.cursor++;
    this.status = this.cursor === this.sequence.length ? "completed" : this.status;
    this.emit();
  }
  step() {
    if (this.status === "playing" || this.status === "completed") return;
    this.status = "paused";
    this.advance();
  }
  play() {
    if (this.status === "playing" || this.status === "completed") return;
    this.status = "playing";
    const generation = ++this.generation;
    const tick = () => {
      if (generation !== this.generation || this.status !== "playing") return;
      this.advance();
      if (this.status === "playing") this.timer = this.clock.schedule(tick, 650);
    };
    this.timer = this.clock.schedule(tick, 650);
    this.emit();
  }
  pause() {
    this.stop();
    if (this.status === "playing") {
      this.status = "paused";
      this.emit();
    }
  }
  reset(input: LabInput = this.input) {
    const sequence = labSequence(input);
    this.stop();
    this.input = structuredClone(input);
    this.sequence = sequence;
    this.cursor = 0;
    this.status = "ready";
    this.emit();
  }
  dispose() {
    this.stop();
    this.listeners.clear();
  }
}
