import { test } from "node:test";
import assert from "node:assert/strict";
import { LabPlayer, labSequence, type LabClock, type LabScenario } from "../shared/lab.ts";

function fakeClock() {
  let id = 0;
  const active = new Map<number, () => void>(),
    all = new Map<number, () => void>();
  const clock: LabClock = {
    schedule(fn) {
      const key = ++id;
      active.set(key, fn);
      all.set(key, fn);
      return key;
    },
    cancel(handle) {
      active.delete(handle as number);
    },
  };
  return {
    clock,
    active,
    all,
    tick() {
      const entry = active.entries().next().value;
      assert.ok(entry);
      active.delete(entry[0]);
      entry[1]();
    },
  };
}
for (const scenario of ["success", "error", "unknown-tool"] as LabScenario[]) {
  test(`Mock ${scenario}: single step, autoplay and reset reproduce an identical trace`, () => {
    const input = { prompt: "订单 42 发货了吗？", scenario },
      timer = fakeClock();
    const manual = new LabPlayer(input),
      auto = new LabPlayer(input, timer.clock);
    auto.play();
    auto.play();
    assert.equal(timer.active.size, 1);
    auto.step();
    assert.equal(auto.snapshot().cursor, 0);
    while (auto.snapshot().status !== "completed") {
      timer.tick();
      manual.step();
    }
    assert.deepEqual(auto.snapshot().events, manual.snapshot().events);
    assert.deepEqual(auto.snapshot().state, manual.snapshot().state);
    assert.equal(auto.snapshot().events.at(-1)!.type, "agent_end");
    const result = auto.snapshot().state.messages.find((m) => m.role === "toolResult")!;
    assert.equal(result.isError, scenario !== "success");
    assert.equal(auto.snapshot().state.messages.length, 4);
    const final = auto.snapshot();
    auto.step();
    auto.play();
    assert.deepEqual(auto.snapshot(), final);
    auto.reset();
    assert.equal(auto.snapshot().state.messages.length, 0);
    auto.play();
    while (auto.snapshot().status !== "completed") timer.tick();
    assert.deepEqual(auto.snapshot(), final);
    const external = auto.snapshot();
    external.events[0].after.messages.push({ role: "user", text: "tamper" });
    assert.deepEqual(auto.snapshot(), final);
    auto.dispose();
    manual.dispose();
  });
}
test("pause, reset and dispose invalidate even already queued timer callbacks", () => {
  const timer = fakeClock(),
    player = new LabPlayer({ prompt: "x", scenario: "success" }, timer.clock);
  let notifications = 0;
  player.subscribe(() => notifications++);
  player.play();
  timer.tick();
  const stale = [...timer.all.values()].at(-1)!;
  player.pause();
  const paused = player.snapshot(),
    count = notifications;
  stale();
  assert.deepEqual(player.snapshot(), paused);
  assert.equal(notifications, count);
  player.play();
  player.reset({ prompt: "new", scenario: "error" });
  for (const callback of timer.all.values()) callback();
  assert.equal(player.snapshot().cursor, 0);
  assert.equal(player.snapshot().status, "ready");
  player.play();
  player.dispose();
  const disposed = player.snapshot();
  for (const callback of timer.all.values()) callback();
  assert.deepEqual(player.snapshot(), disposed);
});
test("invalid Mock inputs fail before changing a run; traces have continuous before/after states", () => {
  for (const prompt of ["", " ", "x".repeat(1001)])
    assert.throws(() => labSequence({ prompt, scenario: "success" }));
  const player = new LabPlayer({ prompt: "x", scenario: "error" });
  player.step();
  const before = player.snapshot();
  assert.throws(() => player.reset({ prompt: "", scenario: "success" }));
  assert.deepEqual(player.snapshot(), before);
  const sequence = labSequence({ prompt: "x", scenario: "success" });
  sequence.slice(1).forEach((event, i) => assert.deepEqual(event.before, sequence[i].after));
  assert.deepEqual(
    sequence.map((e) => e.type),
    [
      "agent_start",
      "turn_start",
      "message_start",
      "message_end",
      "message_start",
      "message_end",
      "tool_execution_start",
      "tool_execution_end",
      "message_start",
      "message_end",
      "turn_end",
      "turn_start",
      "message_start",
      "message_end",
      "turn_end",
      "agent_end",
    ],
  );
});
