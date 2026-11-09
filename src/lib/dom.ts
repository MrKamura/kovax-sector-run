/**
 * Tiny DOM builder helpers for the React-free client.
 * Keeps markup readable and close to the old JSX.
 */

export interface ElOptions {
  /** Class name(s), space separated. */
  class?: string;
  /** Inline styles; numeric values get "px" appended unless unit-less. */
  style?: Record<string, string | number>;
  /** HTML attributes; `false`/`null` skips the attribute, `true` sets it empty. */
  attrs?: Record<string, string | number | boolean>;
  /** Event listeners, keyed by event name ("click", "mousedown", ...). */
  on?: Partial<Record<string, (event: Event) => void>>;
  /** Shortcut for textContent (children are still appended after it). */
  text?: string;
}

const UNITLESS_STYLES = new Set([
  "opacity",
  "zIndex",
  "flex",
  "flexGrow",
  "flexShrink",
  "order",
  "fontWeight",
  "lineHeight",
  "aspectRatio",
  "scale",
  "tabSize",
  "widows",
  "orphans",
]);

function applyStyle(node: HTMLElement, style: Record<string, string | number>) {
  for (const [key, value] of Object.entries(style)) {
    if (value == null) continue;
    const str =
      typeof value === "number" && !UNITLESS_STYLES.has(key)
        ? `${value}px`
        : String(value);
    (node.style as unknown as Record<string, string>)[key] = str;
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElOptions = {},
  children: Array<HTMLElement | string | null | undefined> = []
): HTMLElement {
  const node = document.createElement(tag);
  const { class: className, style, attrs, on, text } = options;
  if (className) node.className = className;
  if (style) applyStyle(node, style);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value == null) continue;
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  if (on) {
    for (const [event, handler] of Object.entries(on)) {
      if (typeof handler === "function") {
        node.addEventListener(event, handler as EventListener);
      }
    }
  }
  if (text != null) node.textContent = text;
  for (const child of children) {
    if (child == null) continue;
    node.append(child);
  }
  return node;
}

/** Remove all children of the node. */
export function clear(node: HTMLElement): void {
  node.replaceChildren();
}
