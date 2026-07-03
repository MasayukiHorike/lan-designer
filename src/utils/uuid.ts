export function uuid(): string {
  return crypto.randomUUID();
}

export function newId(collection: string): string {
  return `${collection}/${uuid()}`;
}
