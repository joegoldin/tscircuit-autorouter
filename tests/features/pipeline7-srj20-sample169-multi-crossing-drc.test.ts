import { expect, test } from "bun:test"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib"
import { evaluateRelaxedDrc } from "lib/testing/evaluate-relaxed-drc"
import { loadScenarioBySampleNumber } from "scripts/benchmark/scenarios"
import { mapLayerNameToZ } from "lib/utils/mapLayerNameToZ"
import { recomputeViasFromRoute } from "lib/utils/recomputeViasFromRoute"

test("Pipeline7 keeps srj20 sample169 DRC-clean after multi-crossing simplification", async () => {
  const { scenario } = await loadScenarioBySampleNumber("srj20", 169)
  const solver = new AutoroutingPipelineSolver7_MultiGraph(scenario)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  const hdRoutes = solver._getOutputHdRoutes()
  expect(hdRoutes).toHaveLength(solver.srjWithPointPairs!.connections.length)
  for (const connection of solver.srjWithPointPairs!.connections) {
    const route = hdRoutes.find((route) => route.connectionName === connection.name)!
    for (const terminal of connection.pointsToConnect) {
      const point = route.startPcbPortId === terminal.pcb_port_id
        ? route.route[0]
        : route.endPcbPortId === terminal.pcb_port_id
          ? route.route.at(-1)
          : undefined
      expect(point).toMatchObject({
        x: terminal.x,
        y: terminal.y,
        z: mapLayerNameToZ("layer" in terminal ? terminal.layer : terminal.layers[0]!, scenario.layerCount),
      })
    }
    expect(route.vias).toEqual(recomputeViasFromRoute(route.route, connection.name))
  }
  const routedTraces = solver.getOutputSimplifiedPcbTraces()
  const { errors } = evaluateRelaxedDrc({
    inputSrj: scenario,
    srjWithPointPairs: solver.srjWithPointPairs!,
    routedTraces,
  })
  const viaCount = routedTraces.reduce(
    (sum, trace) =>
      sum + trace.route.filter((point) => point.route_type === "via").length,
    0,
  )

  expect(errors).toHaveLength(0)
  expect(viaCount).toBe(34)
})
