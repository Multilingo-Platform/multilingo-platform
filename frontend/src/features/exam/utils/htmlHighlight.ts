import type { Highlight } from './highlightUtils';

export function applyHighlights(html: string, highlights: Highlight[]): string {
  if (!highlights || !highlights.length || !html) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);

  let currentOffset = 0;
  const nodesToReplace: { oldNode: Node; newNodes: Node[] }[] = [];

  let node = walker.nextNode();
  while (node) {
    const text = node.nodeValue || '';
    const nodeStart = currentOffset;
    const nodeEnd = currentOffset + text.length;

    const intersecting = highlights.filter(h => h.start < nodeEnd && h.end > nodeStart);

    if (intersecting.length > 0) {
      const fragment = doc.createDocumentFragment();
      let lastIndex = 0;

      for (const h of intersecting) {
        const hStartInNode = Math.max(0, h.start - nodeStart);
        const hEndInNode = Math.min(text.length, h.end - nodeStart);

        if (hStartInNode > lastIndex) {
          fragment.appendChild(doc.createTextNode(text.substring(lastIndex, hStartInNode)));
        }

        const mark = doc.createElement('mark');
        mark.setAttribute('data-hl-id', h.id);
        mark.className = 'bg-yellow-200 rounded-sm';
        mark.textContent = text.substring(hStartInNode, hEndInNode);
        fragment.appendChild(mark);

        lastIndex = hEndInNode;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(doc.createTextNode(text.substring(lastIndex)));
      }

      nodesToReplace.push({ oldNode: node, newNodes: Array.from(fragment.childNodes) });
    }

    currentOffset = nodeEnd;
    node = walker.nextNode();
  }

  for (const { oldNode, newNodes } of nodesToReplace) {
    const parent = oldNode.parentNode;
    if (parent) {
      for (const newNode of newNodes) {
        parent.insertBefore(newNode, oldNode);
      }
      parent.removeChild(oldNode);
    }
  }

  return doc.body.innerHTML;
}
