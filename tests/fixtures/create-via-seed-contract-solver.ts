import { MultiHeadPolyLineIntraNodeSolver3 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver3_ViaPossibilitiesSolverIntegration"

export function createViaSeedContractSolver(): MultiHeadPolyLineIntraNodeSolver3 {
  return new MultiHeadPolyLineIntraNodeSolver3({
    nodeWithPortPoints: { capacityMeshNodeId: "contract", center: { x: 0, y: 0 }, width: 4, height: 4,
      availableZ: [0, 1], portPoints: [
        { connectionName: "a", x: -2, y: -1, z: 0, pcb_port_id: "a-start" },
        { connectionName: "a", x: 2, y: -1, z: 0, pcb_port_id: "a-end" },
        { connectionName: "b", x: -2, y: 1, z: 0, pcb_port_id: "b-start" },
        { connectionName: "b", x: 2, y: 1, z: 0, pcb_port_id: "b-end" },
      ] },
    viaDiameter: 0.5, traceWidth: 0.15, obstacleMargin: 0.127, enforceConfiguredClearance: true,
  })
}
