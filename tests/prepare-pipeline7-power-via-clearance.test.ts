import { expect, test } from "bun:test"
import { preparePipeline7PowerTraceExpansionInput } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/prepare-pipeline7-power-trace-expansion-input"
import type { SimpleRouteJson } from "lib/types"

test("configured power input carries final via-annulus clearance without changing drill rules", () => {
  const originalSrj = {
    layerCount: 2, minTraceWidth: 0.15,
    minTraceToPadEdgeClearance: 0.127,
    minViaHoleEdgeToViaHoleEdgeClearance: 0.25,
    bounds: { minX: -1, minY: -1, maxX: 1, maxY: 1 },
    connections: [], obstacles: [],
  } satisfies SimpleRouteJson & { minViaHoleEdgeToViaHoleEdgeClearance: number }
  const options = { originalSrj, newlyRoutedTraces: [], expandedConnectionNames: [] }
  expect(preparePipeline7PowerTraceExpansionInput({ ...options,
    enforceConfiguredClearance: true }).minViaEdgeToViaEdgeClearance).toBe(0.127)
  expect(preparePipeline7PowerTraceExpansionInput({ ...options,
    enforceConfiguredClearance: true })).toMatchObject({ minViaHoleEdgeToViaHoleEdgeClearance: 0.25 })
  expect(preparePipeline7PowerTraceExpansionInput(options).minViaEdgeToViaEdgeClearance).toBeUndefined()
  expect(originalSrj).not.toHaveProperty("minViaEdgeToViaEdgeClearance")
})
