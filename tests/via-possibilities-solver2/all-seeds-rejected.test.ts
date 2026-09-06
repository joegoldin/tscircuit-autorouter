import { expect, test } from "bun:test"
import { MultiHeadPolyLineIntraNodeSolver3 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver3_ViaPossibilitiesSolverIntegration"

test("all rejected seeds fail with a typed aggregate without emitting a partial route", (): void => {
  const solver = new MultiHeadPolyLineIntraNodeSolver3({
    nodeWithPortPoints: { capacityMeshNodeId: "empty-domain", center: { x: 0, y: 0 }, width: 0.5, height: 2,
      availableZ: [0, 1], portPoints: [
        { connectionName: "required", x: -0.25, y: 0, z: 0, pcb_port_id: "start" },
        { connectionName: "required", x: 0.25, y: 0, z: 1, pcb_port_id: "end" },
      ] },
    viaDiameter: 0.5, traceWidth: 0.15, obstacleMargin: 0.127, enforceConfiguredClearance: true,
  })
  solver.solve()
  expect(solver.failed).toBe(true)
  expect(solver.solved).toBe(false)
  expect(solver.error).toMatch(/All 1 ViaPossibilities seeds rejected/)
  expect(solver.seedRejectionCounts).toEqual({ "empty-via-center-domain": 1 })
  expect(solver.candidates).toHaveLength(0)
  expect(solver.solvedRoutes).toHaveLength(0)
})
