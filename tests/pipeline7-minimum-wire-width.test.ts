import { expect, test } from "bun:test"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib"
import { evaluateRelaxedDrc } from "lib/testing/evaluate-relaxed-drc"
import type { SimpleRouteJson } from "lib/types"
import bugReport from "../fixtures/bug-reports/bugreport53-8e0eba/bugreport53-8e0eba.json"

test("Pipeline7 emits minimum-width copper when nominal widths are absent", () => {
  const scenario = structuredClone(bugReport.simple_route_json) as SimpleRouteJson
  const solver = new AutoroutingPipelineSolver7_MultiGraph(scenario, {
    cacheProvider: null,
  })
  solver.solve()

  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(true)
  const routedTraces = solver.getOutputSimplifiedPcbTraces()
  expect(routedTraces).toHaveLength(solver.srjWithPointPairs!.connections.length)
  const wires = routedTraces.flatMap((trace) =>
    trace.route.filter((point) => point.route_type === "wire"),
  )
  expect(wires.length).toBeGreaterThan(0)
  expect(wires.every((wire) => wire.width >= scenario.minTraceWidth)).toBe(true)
  expect(evaluateRelaxedDrc({
    inputSrj: scenario,
    srjWithPointPairs: solver.srjWithPointPairs!,
    routedTraces,
  }).errors).toHaveLength(0)
})
