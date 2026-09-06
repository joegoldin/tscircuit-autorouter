import type { Obstacle } from "lib/types"
import type { NodeWithPortPoints } from "lib/types/high-density-types"
import type { InputNodeWithPortPoints } from "lib/solvers/PortPointPathingSolver/PortPointPathingSolver"
import type { UniformPortDistributionSolverInput } from "lib/solvers/UniformPortDistributionSolver/UniformPortDistributionSolver"

interface Bug99OffEdgeUniformInputOptions {
  containsTarget?: boolean
  obstacles?: Obstacle[]
}

export function getBug99OffEdgeUniformInput(
  options: Bug99OffEdgeUniformInputOptions = {},
): UniformPortDistributionSolverInput {
  const ownerNodeIds: [string, string] = ["cmn_5", "cmn_109__sub_2_0"]
  const nodeWithPortPoints: NodeWithPortPoints[] = [
    {
      capacityMeshNodeId: "cmn_5",
      center: { x: -1.2999999999999998, y: 7.9399999999999995 },
      width: 1.4999,
      height: 4.28,
      availableZ: [0, 1],
      portPoints: [
        {
          portPointId: "ce105_pp0_z0::0",
          x: -1.737495,
          y: 5.799999999999999,
          z: 0,
          connectionName: "source_trace_52__source_trace_55_mst1",
          rootConnectionName: "source_trace_52",
          nextPortPointId: "ce116_pp0_z0::0",
        },
        {
          portPointId: "ce105_pp0_z0::0::dup1",
          x: -1.7209656823586648,
          y: 5.797864716391289,
          z: 0,
          connectionName: "source_trace_51__source_trace_53_mst1",
          rootConnectionName: "source_trace_51",
          prevPortPointId: "ce96_pp0_z0::0",
        },
      ],
    },
    {
      capacityMeshNodeId: "cmn_109__sub_2_0",
      center: { x: -1.737495, y: 4.553333333333333 },
      width: 0.5249899999999998,
      height: 2.493333333333333,
      availableZ: [0],
      portPoints: [
        {
          portPointId: "ce105_pp0_z0::0",
          x: -1.737495,
          y: 5.799999999999999,
          z: 0,
          connectionName: "source_trace_52__source_trace_55_mst1",
          rootConnectionName: "source_trace_52",
          prevPortPointId: "ce755_pp0_z0::0",
        },
        {
          portPointId: "ce105_pp0_z0::0::dup1",
          x: -1.7209656823586648,
          y: 5.797864716391289,
          z: 0,
          connectionName: "source_trace_51__source_trace_53_mst1",
          rootConnectionName: "source_trace_51",
          nextPortPointId: "ce757_pp0_z0::0",
        },
      ],
    },
  ]
  const inputNodesWithPortPoints: InputNodeWithPortPoints[] =
    nodeWithPortPoints.map((node) => ({
      capacityMeshNodeId: node.capacityMeshNodeId,
      center: node.center,
      width: node.width,
      height: node.height,
      availableZ: node.availableZ ?? [],
      _containsTarget:
        options.containsTarget === true && node.capacityMeshNodeId === "cmn_5",
      portPoints: node.portPoints.map((point) => ({
        portPointId: point.portPointId!,
        x: point.x,
        y: point.y,
        z: point.z,
        connectionNodeIds: ownerNodeIds,
        distToCentermostPortOnZ: 0,
        cramped: false,
        connectsToOffBoardNode: false,
      })),
    }))

  return {
    nodeWithPortPoints,
    inputNodesWithPortPoints,
    obstacles: options.obstacles ?? [],
  }
}
