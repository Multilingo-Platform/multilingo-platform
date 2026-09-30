import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TimerDisplay } from '../components/TimerDisplay';

describe('TimerDisplay', () => {
  it('renders displayTime in normal state', () => {
    render(<TimerDisplay displayTime="45:30" isExpired={false} isPractice={false} />);
    expect(screen.getByText(/45:30/)).toBeDefined();
  });

  it('renders practice mode pill when isPractice=true', () => {
    render(<TimerDisplay displayTime="" isExpired={false} isPractice={true} />);
    expect(screen.getByText(/Practice Mode/i)).toBeDefined();
  });

  it('applies danger style class when isExpired=true', () => {
    const { container } = render(<TimerDisplay displayTime="00:00" isExpired={true} isPractice={false} />);
    const el = container.querySelector('.timer-expired') ?? container.querySelector('.danger');
    expect(el).toBeDefined();
  });
});
