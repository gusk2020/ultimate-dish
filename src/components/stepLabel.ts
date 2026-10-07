import type { Step } from "../types";
import { METHOD_MAP } from "../data/methods";
import { SPICE_MAP, TOOL_MAP } from "../data/magic";

export function stepLabel(s: Step): string {
  if (s.kind === "method") return METHOD_MAP[s.id]?.name ?? s.id;
  if (s.kind === "spice") return `${SPICE_MAP[s.id]?.emoji ?? ""}${SPICE_MAP[s.id]?.name ?? s.id}`;
  return `${TOOL_MAP[s.id]?.emoji ?? ""}${TOOL_MAP[s.id]?.name ?? s.id}`;
}
