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
//
// NOTE on pause/resume: AgendaSection has no pause button of its own — it's
// a controlled component. The timer is derived from `timerStartedAt` (a wall
// clock reference) + `initialSeconds` (an accumulated base), and pausing is
// just `isPaused=true` — the actual pause/resume control lives in the parent
// (L10LiveMeetingPage's global meeting timer), which snapshots the elapsed
// seconds into `initialSeconds` when pausing and gives a fresh
// `timerStartedAt` when resuming. These tests simulate that parent behavior
// via `rerender` instead of clicking a button that doesn't exist here.
describe('AgendaSection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows its children and a running timer when active', () => {
    const timerStartedAt = new Date().toISOString();

    render(
      <AgendaSection
        icon={null}
        title="Segue"
        targetMinutes={5}
        active
        onActivate={vi.fn()}
        timerStartedAt={timerStartedAt}
      >
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
      <AgendaSection icon={null} title="Scorecard" targetMinutes={5} active={false} onActivate={onActivate}>
        <div>contenido de scorecard</div>
      </AgendaSection>
    );

    expect(screen.queryByText('contenido de scorecard')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Scorecard'));
    expect(onActivate).toHaveBeenCalled();
  });

  it('stops the timer while collapsed and resumes counting from where it left off when re-activated', () => {
    const firstStart = new Date().toISOString();

    const { rerender } = render(
      <AgendaSection icon={null} title="IDS" targetMinutes={60} active onActivate={vi.fn()} timerStartedAt={firstStart}>
        <div>ids</div>
      </AgendaSection>
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('00:05 / 60:00')).toBeInTheDocument();

    // Parent deactivates the section: it froze 5s but doesn't pass it down
    // yet (nothing renders while collapsed, so it doesn't matter here).
    rerender(
      <AgendaSection icon={null} title="IDS" targetMinutes={60} active={false} onActivate={vi.fn()} timerStartedAt={firstStart}>
        <div>ids</div>
      </AgendaSection>
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Parent re-activates: it hands back the frozen 5s as the new base plus
    // a fresh timerStartedAt reference, exactly like L10LiveMeetingPage does
    // when switching the active section.
    const secondStart = new Date().toISOString();
    rerender(
      <AgendaSection
        icon={null}
        title="IDS"
        targetMinutes={60}
        active
        onActivate={vi.fn()}
        initialSeconds={5}
        timerStartedAt={secondStart}
      >
        <div>ids</div>
      </AgendaSection>
    );
    expect(screen.getByText('00:05 / 60:00')).toBeInTheDocument();
  });

  it('pauses and resumes without losing elapsed time', () => {
    const firstStart = new Date().toISOString();

    const { rerender } = render(
      <AgendaSection icon={null} title="Rock Review" targetMinutes={5} active onActivate={vi.fn()} timerStartedAt={firstStart}>
        <div>rocks</div>
      </AgendaSection>
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('00:02 / 5:00')).toBeInTheDocument();

    // Parent pauses: snapshots the 2s elapsed into initialSeconds and sets isPaused.
    rerender(
      <AgendaSection
        icon={null}
        title="Rock Review"
        targetMinutes={5}
        active
        onActivate={vi.fn()}
        initialSeconds={2}
        timerStartedAt={firstStart}
        isPaused
      >
        <div>rocks</div>
      </AgendaSection>
    );
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('00:02 / 5:00')).toBeInTheDocument();

    // Parent resumes: keeps the 2s base, hands a fresh timerStartedAt.
    const resumeStart = new Date().toISOString();
    rerender(
      <AgendaSection
        icon={null}
        title="Rock Review"
        targetMinutes={5}
        active
        onActivate={vi.fn()}
        initialSeconds={2}
        timerStartedAt={resumeStart}
      >
        <div>rocks</div>
      </AgendaSection>
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('00:03 / 5:00')).toBeInTheDocument();
  });
});
