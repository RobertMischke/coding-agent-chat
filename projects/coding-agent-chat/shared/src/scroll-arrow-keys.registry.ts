import { Injectable } from '@angular/core';

interface RegisteredSurface {
  host: HTMLElement;
  container: HTMLElement;
}

const ARROW_KEY_STEP_PX = 48;

const VIEWPORT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);
const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown']);

const KEY_OWNERS = [
  'textarea',
  'input',
  'select',
  'option',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="tree"]',
  '[role="treegrid"]',
  '[role="grid"]',
  '[role="slider"]',
  '[role="spinbutton"]',
].join(',');

@Injectable({ providedIn: 'root' })
export class ScrollArrowKeysRegistry {
  private nextId = 1;
  private readonly surfaces = new Map<number, RegisteredSurface>();

  register(element: HTMLElement): number {
    const id = this.nextId++;
    this.surfaces.set(id, { host: element, container: element });
    return id;
  }

  updateSurface(id: number, element: HTMLElement): void {
    const surface = this.surfaces.get(id);
    if (surface) {
      surface.container = element;
    }
  }

  unregister(id: number): void {
    this.surfaces.delete(id);
  }

  /**
   * @deprecated Key routing is now local to each focused surface. Retained as
   * a source-compatible no-op for hosts that imported the registry directly.
   */
  markActive(_id: number): void {
    // Intentionally empty: there is no global active-surface state anymore.
  }

  handleKeydown(event: KeyboardEvent, surfaceId: number): boolean {
    const surface = this.surfaces.get(surfaceId);
    if (!surface || !VIEWPORT_KEYS.has(event.key)) return false;

    const target = event.target;
    if (!(target instanceof Node) || !surface.host.contains(target)) return false;

    // Editable/menu controls retain their own ArrowUp/ArrowDown semantics, but
    // the embedding host must not interpret the same event as board/list
    // navigation after it leaves the chat surface.
    if (this.isOwnedByFocusableControl(target, surface.host)) {
      if (!ARROW_KEYS.has(event.key)) return false;
      event.stopPropagation();
      return true;
    }

    // PageUp/PageDown and Home/End are viewport commands only. Descendant
    // controls may assign their own meaning to them, so handle these keys only
    // when the conversation surface (or resolved scroll owner) has focus.
    if (!ARROW_KEYS.has(event.key) && target !== surface.host && target !== surface.container) {
      return false;
    }

    // A descendant may already have handled the key. Still contain it at the
    // chat boundary, but do not add a second scroll action.
    if (event.defaultPrevented) {
      event.stopPropagation();
      return true;
    }

    const container = surface.container;
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const nextScrollTop = this.nextScrollTop(event.key, container, maxScrollTop);

    container.scrollTop = nextScrollTop;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  private nextScrollTop(key: string, container: HTMLElement, maxScrollTop: number): number {
    switch (key) {
      case 'ArrowUp':
        return Math.max(0, container.scrollTop - ARROW_KEY_STEP_PX);
      case 'ArrowDown':
        return Math.min(maxScrollTop, container.scrollTop + ARROW_KEY_STEP_PX);
      case 'PageUp':
        return Math.max(0, container.scrollTop - container.clientHeight);
      case 'PageDown':
        return Math.min(maxScrollTop, container.scrollTop + container.clientHeight);
      case 'Home':
        return 0;
      case 'End':
        return maxScrollTop;
      default:
        return container.scrollTop;
    }
  }

  private isOwnedByFocusableControl(target: Node, host: HTMLElement): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const owner = target.closest(KEY_OWNERS);
    return owner !== null && host.contains(owner);
  }
}
