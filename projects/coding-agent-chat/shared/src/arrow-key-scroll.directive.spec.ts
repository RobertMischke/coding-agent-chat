import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ArrowKeyScrollDirective } from './arrow-key-scroll.directive';

interface ScrollState {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}

function mockScrollMetrics(
  el: HTMLElement,
  init: { scrollHeight: number; clientHeight: number },
): ScrollState {
  const state: ScrollState = { ...init, scrollTop: 0 };
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => state.scrollHeight,
  });
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    get: () => state.clientHeight,
  });
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => state.scrollTop,
    set: (value: number) => {
      state.scrollTop = value;
    },
  });
  return state;
}

@Component({
  standalone: true,
  imports: [ArrowKeyScrollDirective],
  template: `
    <div class="surface" cacArrowKeyScroll tabindex="0">
      <div class="content">
        <button type="button">Action</button>
        <textarea rows="2"></textarea>
        <input />
        <select>
          <option>One</option>
        </select>
        <div class="editable" contenteditable="true">Editable</div>
        <div class="menu" role="menu" tabindex="0">Menu</div>
        <div class="listbox" role="listbox" tabindex="0">Listbox</div>
      </div>
    </div>
    <button class="outside" type="button">Outside chat</button>
  `,
})
class SurfaceHostComponent {}

@Component({
  standalone: true,
  imports: [ArrowKeyScrollDirective],
  template: `
    <div class="surface surface--one" cacArrowKeyScroll tabindex="0">
      <button type="button">One</button>
    </div>
    <div class="surface surface--two" cacArrowKeyScroll tabindex="0">
      <button type="button">Two</button>
    </div>
  `,
})
class DualSurfaceHostComponent {}

describe('ArrowKeyScrollDirective', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const realGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(((
      el: Element,
      pseudo?: string | null,
    ) => {
      if (el instanceof HTMLElement && el.classList.contains('surface')) {
        return { overflowY: 'auto' } as CSSStyleDeclaration;
      }
      return realGetComputedStyle(el, pseudo);
    }) as typeof window.getComputedStyle);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function setupSurfaceHost(): {
    root: HTMLElement;
    state: ScrollState;
  } {
    const fixture = TestBed.createComponent(SurfaceHostComponent);
    const root = fixture.nativeElement as HTMLElement;
    const surface = root.querySelector<HTMLElement>('.surface')!;
    const state = mockScrollMetrics(surface, { scrollHeight: 1200, clientHeight: 300 });
    fixture.detectChanges();
    return { root, state };
  }

  function setupDualHost(): {
    root: HTMLElement;
    surfaceOne: HTMLElement;
    surfaceTwo: HTMLElement;
    stateOne: ScrollState;
    stateTwo: ScrollState;
  } {
    const fixture = TestBed.createComponent(DualSurfaceHostComponent);
    const root = fixture.nativeElement as HTMLElement;
    const surfaceOne = root.querySelector<HTMLElement>('.surface--one')!;
    const surfaceTwo = root.querySelector<HTMLElement>('.surface--two')!;
    const stateOne = mockScrollMetrics(surfaceOne, { scrollHeight: 1600, clientHeight: 400 });
    const stateTwo = mockScrollMetrics(surfaceTwo, { scrollHeight: 1600, clientHeight: 400 });
    fixture.detectChanges();
    return { root, surfaceOne, surfaceTwo, stateOne, stateTwo };
  }

  it('scrolls focused viewport arrows and does not propagate them to the embedding host', () => {
    const { root, state } = setupSurfaceHost();
    const surface = root.querySelector<HTMLElement>('.surface')!;
    const embeddingKeydown = vi.fn();
    root.addEventListener('keydown', embeddingKeydown);

    state.scrollTop = 300;
    surface.focus();

    const down = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    surface.dispatchEvent(down);

    expect(state.scrollTop).toBe(348);
    expect(down.defaultPrevented).toBe(true);
    expect(embeddingKeydown).not.toHaveBeenCalled();

    const up = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
    surface.dispatchEvent(up);

    expect(state.scrollTop).toBe(300);
    expect(up.defaultPrevented).toBe(true);
    expect(embeddingKeydown).not.toHaveBeenCalled();
  });

  it('supports normal keyboard repeat while the key is held', () => {
    const { root, state } = setupSurfaceHost();
    const surface = root.querySelector<HTMLElement>('.surface')!;

    state.scrollTop = 300;
    surface.focus();

    surface.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
        repeat: true,
      }),
    );
    surface.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
        repeat: true,
      }),
    );
    surface.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
        repeat: true,
      }),
    );

    expect(state.scrollTop).toBe(444);
  });

  it('scrolls only the viewport that owns the key event', () => {
    const { surfaceOne, stateOne, stateTwo } = setupDualHost();

    stateOne.scrollTop = 500;
    stateTwo.scrollTop = 900;
    surfaceOne.focus();

    const key = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
    surfaceOne.dispatchEvent(key);

    expect(stateOne.scrollTop).toBe(452);
    expect(stateTwo.scrollTop).toBe(900);
    expect(key.defaultPrevented).toBe(true);
  });

  it('supports page and boundary keys while the viewport is focused', () => {
    const { root, state } = setupSurfaceHost();
    const surface = root.querySelector<HTMLElement>('.surface')!;
    const embeddingKeydown = vi.fn();
    root.addEventListener('keydown', embeddingKeydown);

    state.scrollTop = 300;
    surface.focus();

    for (const [key, expectedScrollTop] of [
      ['PageDown', 600],
      ['PageUp', 300],
      ['End', 900],
      ['Home', 0],
    ] as const) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      surface.dispatchEvent(event);
      expect(state.scrollTop).toBe(expectedScrollTop);
      expect(event.defaultPrevented).toBe(true);
    }

    const boundary = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      bubbles: true,
      cancelable: true,
    });
    surface.dispatchEvent(boundary);
    expect(state.scrollTop).toBe(0);
    expect(boundary.defaultPrevented).toBe(true);
    expect(embeddingKeydown).not.toHaveBeenCalled();
  });

  it('preserves control-owned arrow behavior without propagating to the embedding host', () => {
    const { root, state } = setupSurfaceHost();
    const surface = root.querySelector<HTMLElement>('.surface')!;
    const textarea = surface.querySelector('textarea')!;
    const input = surface.querySelector('input')!;
    const select = surface.querySelector('select')!;
    const editable = surface.querySelector<HTMLElement>('.editable')!;
    const menu = surface.querySelector<HTMLElement>('.menu')!;
    const listbox = surface.querySelector<HTMLElement>('.listbox')!;
    const embeddingKeydown = vi.fn();
    root.addEventListener('keydown', embeddingKeydown);

    state.scrollTop = 300;

    for (const target of [textarea, input, select, editable, menu, listbox]) {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      expect(state.scrollTop).toBe(300);
      expect(event.defaultPrevented).toBe(false);
    }

    expect(embeddingKeydown).not.toHaveBeenCalled();
  });

  it('leaves vertical navigation outside the chat surface untouched', () => {
    const { root, state } = setupSurfaceHost();
    const surface = root.querySelector<HTMLElement>('.surface')!;
    const outside = root.querySelector<HTMLButtonElement>('.outside')!;
    const embeddingKeydown = vi.fn();
    root.addEventListener('keydown', embeddingKeydown);

    state.scrollTop = 300;
    surface.focus();
    outside.focus();
    expect(document.activeElement).toBe(outside);
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    outside.dispatchEvent(event);

    expect(state.scrollTop).toBe(300);
    expect(event.defaultPrevented).toBe(false);
    expect(embeddingKeydown).toHaveBeenCalledOnce();
  });
});
