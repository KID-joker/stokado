export function byteSize(str: string): number {
  return new Blob([str]).size
}
