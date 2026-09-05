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
    const node = center
      ? capacityNodes.find(
          (candidate) =>
            center.x >= candidate.center.x - candidate.width / 2 &&
            center.x <= candidate.center.x + candidate.width / 2 &&
            center.y >= candidate.center.y - candidate.height / 2 &&
            center.y <= candidate.center.y + candidate.height / 2,
        )
      : undefined
    if (!node) {
      throw new Error(
        "Pipeline7 cannot map clearance error to a capacity node",
      )
    }
    nodeIds.add(node.capacityMeshNodeId)
  }
  return nodeIds
}
