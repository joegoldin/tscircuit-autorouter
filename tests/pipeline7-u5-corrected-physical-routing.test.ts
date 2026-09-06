import { test } from "bun:test"
import { assertU5PhysicalRouting, createU5PhysicalSrj } from "./fixtures/u5-physical-routing"

test("P7 routes corrected U5 terminals around the nameless top keepout", (): void => {
  assertU5PhysicalRouting(createU5PhysicalSrj("corrected"), false)
})
