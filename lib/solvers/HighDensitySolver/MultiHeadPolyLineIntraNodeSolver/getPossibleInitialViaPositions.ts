import type { Bounds, Point } from "@tscircuit/math-utils"
import { getCentroidsFromInnerBoxIntersections } from "./getCentroidsFromInnerBoxIntersections"
import { iterateBinaryCombinations } from "./generateBinaryCombinations"
import { MHPoint } from "./types1"

type ViaPositionVariantForLinesViaCountVariant = {
  viaPositions: Point[]
  viaCountVariant: number[]
}

/**
 * Get the all possible via positions if you consider the centroids of shapes
 * created by all the intersections that divide the bounding box of the node
 *
 * We iterate over the via count variants, for each variant we generate each
 * possible via position.
 * Remember: The viaCountVariants specifies the number of vias for each connection,
 * so that's how we know how many points to return
 */
export const getPossibleInitialViaPositions = (params: {
  portPairsEntries: Array<
    [
      connectionName: string,
      {
        start: Omit<MHPoint, "xMoves" | "yMoves">
        end: Omit<MHPoint, "xMoves" | "yMoves">
      },
    ]
  >
  bounds: Bounds
  viaCountVariants: Array<number[]>
}): Array<ViaPositionVariantForLinesViaCountVariant> => {
  return Array.from(iteratePossibleInitialViaPositions(params))
}

export function* iteratePossibleInitialViaPositions(params: {
  portPairsEntries: Array<
    [
      connectionName: string,
      {
        start: Omit<MHPoint, "xMoves" | "yMoves">
        end: Omit<MHPoint, "xMoves" | "yMoves">
      },
    ]
  >
  bounds: Bounds
  viaCountVariants: Array<number[]>
}): Generator<ViaPositionVariantForLinesViaCountVariant> {
  const { bounds, portPairsEntries, viaCountVariants } = params

  const { centroids } = getCentroidsFromInnerBoxIntersections(
    bounds,
    portPairsEntries.map(([_, portPair]) => portPair),
  )

  for (const viaCountVariant of viaCountVariants) {
    const viaCount = viaCountVariant.reduce((acc, count) => acc + count, 0)

    let viaPositionSource: Array<{ x: number; y: number }> = centroids

    if (centroids.length < viaCount) {
      // There aren't enough centroids (might not be a very hard problem)
      // we can just space the vias evenly within the node
      viaPositionSource = []
      const rows = Math.ceil(Math.sqrt(viaCount))
      const cols = rows
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          viaPositionSource.push({
            x:
              bounds.minX +
              ((c + 1) / (cols + 1)) * (bounds.maxX - bounds.minX),
            y:
              bounds.minY +
              ((r + 1) / (rows + 1)) * (bounds.maxY - bounds.minY),
          })
        }
      }
    }

    const viaPositionVariants = iterateBinaryCombinations(
      viaCount,
      viaPositionSource.length,
    )

    for (const viaPositionVariant of viaPositionVariants) {
      const viaPositions: Point[] = []
      for (let i = 0; i < viaPositionVariant.length; i++) {
        if (viaPositionVariant[i] === 1) {
          viaPositions.push(viaPositionSource[i])
        }
      }
      yield {
        viaPositions,
        viaCountVariant,
      }
    }
  }
}
