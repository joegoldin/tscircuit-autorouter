import { expect, test } from "bun:test"
import { MultiGraphTopologyPlannerSolver } from "lib/solvers/TopologyPlanningSolver/MultiGraphTopologyPlannerSolver"
import type { SimpleRouteJson } from "lib/types"

test("configured global topology reserves trace radius and full physical clearance", (): void => {
  const srj: SimpleRouteJson = {
    layerCount: 2, minTraceWidth: 0.15,
    bounds: { minX: -3, maxX: 3, minY: -3, maxY: 3 },
    connections: [],
    obstacles: [{ type: "rect", center: { x: 0, y: 0 }, width: 0.5,
      height: 0.325, layers: ["top"], connectedTo: ["pad", "net"] }],
  }
  const original = structuredClone(srj)
  for (const configured of [false, true]) {
    const planner = new MultiGraphTopologyPlannerSolver({
      inputSrj: srj, obstacleMargin: 0.127, enforceConfiguredClearance: configured,
    })
    planner.step()
    const input = planner.globalTopologySolver!.inputProblem.simpleRouteJson
    expect(input.obstacles[0].width).toBeCloseTo(0.5 + (configured ? 0.404 : 0), 12)
    expect(input.obstacles[0].height).toBeCloseTo(0.325 + (configured ? 0.404 : 0), 12)
    expect(input.obstacles[0].connectedTo).toEqual(["pad", "net"])
    expect(srj).toEqual(original)
  }
})
