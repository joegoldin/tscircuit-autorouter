import { expect, test } from "bun:test"
import { createOwnershipParams, getOwnership } from "./fixtures/tiny-root-ownership"

test("declared target ownership accepts explicit route and net aliases without root metadata", () => {
  for (const alias of ["route", "net-ground"]) {
    const params = createOwnershipParams()
    delete params.connections[0].simpleRouteConnection.__rootConnectionNames
    for (const region of params.graph.regions) {
      if (region.d._containsTarget) region.d._targetConnectionName = alias
    }
    const owners = getOwnership(params)
    expect(owners.get("top")).toBe(0)
    expect(owners.get("hole")).toBe(0)
    expect(owners.get("bottom")).toBe(0)
  }
})
