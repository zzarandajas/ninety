import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgendaSection } from './AgendaSection';

// NOTE on interaction helper: the brief's reference test used
// `@testing-library/user-event` for clicks. In this repo's exact toolchain
// (vitest 2.1.9 + @testing-library/user-event 14.6.1 + jsdom), any
// `userEvent.click(...)` issued while `vi.useFakeTimers()` is active hangs
// indefinitely and times out, regardless of `advanceTimers`, `delay: null`,
// or `pointerEventsCheck` config — reproduced with a bare `<div onClick>`
// with no AntD/AgendaSection involved, so it's an environment-level
// incompatibility, not a bug in this component. `fireEvent.click` (which
// dispatches synchronously and is already wrapped in `act()` internally by
// Testing Library) does not have this problem, so it's used here instead.
// Likewise, raw `vi.advanceTimersByTime(...)` calls are wrapped in `act()`
// so the state update from the `setInterval` tick is flushed to the DOM
// before the following assertion runs (React 18's concurrent scheduler
// does not guarantee a synchronous flush otherwise).
describe('AgendaSection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows its children and a running timer when active', () => {
    render(
      <AgendaSection title="Segue" targetMinutes={5} active onActivate={vi.fn()}>
        <div>contenido de segue</div>
      </AgendaSection>
    );

    expect(screen.getByText('contenido de segue')).toBeInTheDocument();
    expect(screen.getByText('00:00 / 5:00')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('00:03 / 5:00')).toBeInTheDocument();
  });

  it('hides its children and the timer when collapsed, and calls onActivate on click', () => {
    const onActivate = vi.fn();

    render(
      <AgendaSection title="Scorecard" targetMinutes={5} active={false} onActivate={onActivate}>
        <div>contenido de scorecard</div>
      </AgendaSection>
    );

    expect(screen.queryByText('contenido de scorecard')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Scorecard'));
    expect(onActivate).toHaveBeenCalled();
  });

  it('stops the timer while collapsed and resumes counting from where it left off when re-activated', () => {
    const { rerender } = render(
      <AgendaSection title="IDS" targetMinutes={60} active onActivate={vi.fn()}>
        <div>ids</div>
      </AgendaSection>
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('00:05 / 60:00')).toBeInTheDocument();

    rerender(
      <AgendaSection title="IDS" targetMinutes={60} active={false} onActivate={vi.fn()}>
        <div>ids</div>
      </AgendaSection>
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    rerender(
      <AgendaSection title="IDS" targetMinutes={60} active onActivate={vi.fn()}>
        <div>ids</div>
      </AgendaSection>
    );
    expect(screen.getByText('00:05 / 60:00')).toBeInTheDocument();
  });

  it('pauses and resumes on button click without losing elapsed time', () => {
    render(
      <AgendaSection title="Rock Review" targetMinutes={5} active onActivate={vi.fn()}>
        <div>rocks</div>
      </AgendaSection>
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.click(screen.getByRole('button', { name: /pausar/i }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('00:02 / 5:00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reanudar/i }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('00:03 / 5:00')).toBeInTheDocument();
  });
});
