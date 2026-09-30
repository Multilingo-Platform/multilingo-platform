import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TimerDisplay } from '../components/TimerDisplay';

describe('TimerDisplay', () => {
  it('renders displayTime', () => {
    render(<TimerDisplay displayTime="45:30" isExpired={false} isPractice={false} />);
    expect(screen.getByText('⏱ 45:30')).toBeDefined();
  });

  it('renders null when isPractice=true', () => {
    const { container } = render(<TimerDisplay displayTime="" isExpired={false} isPractice={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('applies danger style when isExpired=true', () => {
    render(<TimerDisplay displayTime="00:00" isExpired={true} isPractice={false} />);
    const el = screen.getByText('⏱ 00:00');
    expect(el.className).toMatch(/expired|danger|red/i);
  });
});
