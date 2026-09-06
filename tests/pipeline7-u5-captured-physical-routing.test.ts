import { test } from "bun:test"
import { assertU5PhysicalRouting, createU5PhysicalSrj } from "./fixtures/u5-physical-routing"

test("P7 routes every captured U5 pair at actual physical clearance", (): void => {
  assertU5PhysicalRouting(createU5PhysicalSrj(), false)
})
