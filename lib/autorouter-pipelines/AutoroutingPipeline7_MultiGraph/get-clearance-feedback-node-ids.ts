import type { AutoroutingDrcError } from "high-density-repair03/lib"
import type {
  CapacityMeshNode,
  CapacityMeshNodeId,
} from "lib/types"

export const getClearanceFeedbackNodeIds = (
  errors: AutoroutingDrcError[],
  capacityNodes: CapacityMeshNode[],
): Set<CapacityMeshNodeId> => {
  const nodeIds = new Set<CapacityMeshNodeId>()
  for (const error of errors) {
    const center = error.center
    let mapped = false
    for (const node of center ? capacityNodes : []) {
      if (
        center!.x >= node.center.x - node.width / 2 &&
        center!.x <= node.center.x + node.width / 2 &&
        center!.y >= node.center.y - node.height / 2 &&
        center!.y <= node.center.y + node.height / 2
      ) {
        nodeIds.add(node.capacityMeshNodeId)
        mapped = true
      }
    }
    if (!mapped) {
      throw new Error(
        "Pipeline7 cannot map clearance error to a capacity node",
      )
    }
  }
  return nodeIds
}
