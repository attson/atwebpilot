import type { Json, Step } from "@atwebpilot/shared/types";

export interface ToolRunner {
  runStep(
    step: Step,
    tabId: number,
    attachedTabIds: number[],
    bindings: Record<string, Json>
  ): Promise<Json>;
}

export class RpcToolRunner implements ToolRunner {
  constructor(
    private send: (req: unknown) => Promise<{ ok: true; data: Json } | { ok: false; error: string }>
  ) {}

  async runStep(
    step: Step,
    tabId: number,
    attachedTabIds: number[],
    bindings: Record<string, Json>
  ): Promise<Json> {
    const res = await this.send({
      type: "runs.runOneStep",
      step,
      tabId,
      attachedTabIds,
      bindings
    });
    if (!res.ok) throw new Error(res.error);
    return res.data;
  }
}
