export function rangeToOffsets(container: Node, range: Range): { start: number; end: number } {
  const containsBoundary = (node: Node) => node === container || container.contains(node);
  if (!containsBoundary(range.startContainer) || !containsBoundary(range.endContainer)) {
    throw new RangeError('Selection boundary is outside the reading document');
  }
  const offsetAt = (node: Node, offset: number): number => {
    const prefix = document.createRange();
    prefix.selectNodeContents(container);
    prefix.setEnd(node, offset);
    return prefix.toString().length;
  };
  const start = offsetAt(range.startContainer, range.startOffset);
  const end = offsetAt(range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

export function trimOffsets(
  rawText: string,
  offsets: { start: number; end: number }
): { start: number; end: number } {
  const leading = rawText.match(/^\s*/)?.[0].length ?? 0;
  const trailing = rawText.match(/\s*$/)?.[0].length ?? 0;

  const start = offsets.start + leading;
  const end = Math.max(start, offsets.end - trailing);

  return { start, end };
}
