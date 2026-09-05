import { expect, test } from "bun:test"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import type { SimpleRouteJson } from "lib/types"

test("Pipeline7 refuses to report success when terminal copper violates clearance", () => {
  const srj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    minTraceToPadEdgeClearance: 0.15,
    bounds: { minX: -2, minY: -2, maxX: 2, maxY: 2 },
    obstacles: [],
    connections: [0, 1].map((index) => ({
      name: `net${index}`,
      pointsToConnect: [
        { x: -1, y: index * 0.275, layer: "top" },
        { x: 1, y: index * 0.275, layer: "top" },
      ],
    })),
  }
  const solver = new AutoroutingPipelineSolver7_MultiGraph(srj)
  solver.solve()
  expect(solver.solved).toBe(false)
  expect(solver.failed).toBe(true)
  expect(solver.error).toContain("clearance")
  expect(() => solver.getOutputSimplifiedPcbTraces()).toThrow()
})
