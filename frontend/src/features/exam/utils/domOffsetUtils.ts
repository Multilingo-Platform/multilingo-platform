export function rangeToOffsets(container: Node, range: Range): { start: number; end: number } {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let currentOffset = 0;
  let start = -1;
  let end = -1;

  let node = walker.nextNode();
  while (node) {
    if (node === range.startContainer) {
      start = currentOffset + range.startOffset;
    }
    if (node === range.endContainer) {
      end = currentOffset + range.endOffset;
    }
    currentOffset += node.nodeValue?.length || 0;

    if (start !== -1 && end !== -1) break;
    node = walker.nextNode();
  }

  if (start === -1) start = 0;
  if (end === -1) end = currentOffset;

  return { start: Math.min(start, end), end: Math.max(start, end) };
}
