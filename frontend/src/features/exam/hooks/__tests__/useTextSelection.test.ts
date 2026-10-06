import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextSelection } from '../useTextSelection';
import React from 'react';

describe('useTextSelection', () => {
  it('returns null selection initially or when disabled', () => {
    const container = document.createElement('div');
    const containerRef = { current: container };

    const { result } = renderHook(() => useTextSelection(containerRef, false));
    expect(result.current.selection).toBeNull();
  });
});
