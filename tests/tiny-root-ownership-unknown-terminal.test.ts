import { expect, test } from "bun:test"
import { createOwnershipParams, getHole, getOwnership } from "./fixtures/tiny-root-ownership"

test("unknown explicit ownership cannot be inferred back onto a connection endpoint", () => {
  const params = createOwnershipParams()
  const hole = getHole(params)
  hole.d._targetConnectionName = "missing-root"
  params.connections[0].startRegion = hole
  params.connections[0].simpleRouteConnection.pointsToConnect[0].x = 0
  expect(() => getOwnership(params)).toThrow('Unknown explicit ownership for endpoint region "hole"')
})
