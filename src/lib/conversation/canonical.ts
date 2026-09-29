// src/lib/conversation/canonical.ts

export function canonicalPair(id1: string, id2: string) {
  return id1 < id2
    ? { userAId: id1, userBId: id2 }
    : { userAId: id2, userBId: id1 };
}