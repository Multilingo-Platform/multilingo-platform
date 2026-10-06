export type Highlight = {
  id: string;
  start: number;
  end: number;
  text: string;
};

export function normalize(ranges: Highlight[]): Highlight[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const result: Highlight[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = result[result.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      last.text = last.text + ' ' + current.text;
    } else {
      result.push({ ...current });
    }
  }
  return result;
}

export function removeAt(ranges: Highlight[], offset: number): Highlight[] {
  return ranges.filter((r) => offset < r.start || offset >= r.end);
}
