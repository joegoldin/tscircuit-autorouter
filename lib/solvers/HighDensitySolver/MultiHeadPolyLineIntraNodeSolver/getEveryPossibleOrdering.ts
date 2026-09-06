export const getEveryPossibleOrdering = <T extends Array<any>>(ar: T): T[] => {
  return Array.from(iterateEveryPossibleOrdering(ar))
}

export function* iterateEveryPossibleOrdering<T extends Array<any>>(
  ar: T,
): Generator<T> {
  if (ar.length === 0) {
    yield [] as unknown as T
    return
  }

  for (let i = 0; i < ar.length; i++) {
    const firstElement = ar[i]
    const rest = [...ar.slice(0, i), ...ar.slice(i + 1)] as T
    for (const perm of iterateEveryPossibleOrdering(rest)) {
      yield [firstElement, ...perm] as T
    }
  }
}
