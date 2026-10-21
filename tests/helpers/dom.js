/* A deliberately small DOM substitute for controller logic, not a browser.
 * Node isolates test files in separate processes, so these globals stay local.
 * Event propagation is explicit: send(parent, ..., { origin: child }) exercises
 * the parent listener without pretending to reproduce browser drag gestures.
 */
export class TestElement extends EventTarget {
  attributes = new Map();
  style = {
    cursor: "",
    userSelect: "text",
    webkitUserSelect: "",
    webkitTouchCallout: "",
  };
  children = [];
  parentElement = null;
  rect = { left: 0, top: 0, width: 100, height: 100 };

  setAttribute(key, value) {
    this.attributes.set(key, String(value));
  }
  removeAttribute(key) {
    this.attributes.delete(key);
  }
  hasAttribute(key) {
    return this.attributes.has(key);
  }
  toggleAttribute(key, enabled) {
    if (enabled) this.setAttribute(key, "");
    else this.removeAttribute(key);
  }
  get draggable() {
    return this.attributes.get("draggable") === "true";
  }
  getBoundingClientRect() {
    return this.rect;
  }
  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
  }
  removeChild(child) {
    this.children.splice(this.children.indexOf(child), 1);
    child.parentElement = null;
  }
  cloneNode(deep) {
    const copy = new TestElement();
    copy.attributes = new Map(this.attributes);
    copy.rect = { ...this.rect };
    if (deep)
      this.children.forEach((child) => copy.appendChild(child.cloneNode(true)));
    return copy;
  }
}

class TestDocument extends EventTarget {
  ontouchstart = null;
  body = new TestElement();
  hitTarget = null;
  elementFromPoint() {
    return this.hitTarget;
  }
  createEvent() {
    const event = new Event("placeholder", { bubbles: true, cancelable: true });
    event.initEvent = (type) =>
      Object.defineProperty(event, "type", { value: type });
    return event;
  }
}

export const document = new TestDocument();
globalThis.Element = TestElement;
globalThis.HTMLCanvasElement = class extends TestElement {};
globalThis.document = document;
globalThis.window = { setTimeout: (...args) => globalThis.setTimeout(...args) };
globalThis.getComputedStyle = () => ({ length: 0, pointerEvents: "auto" });

let frameId = 0;
const frames = new Map();
globalThis.requestAnimationFrame = (callback) => {
  frames.set(++frameId, callback);
  return frameId;
};
globalThis.cancelAnimationFrame = (id) => frames.delete(id);

export function flushFrames() {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback());
}

export function send(element, type, { origin, ...properties } = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if (origin) Object.defineProperty(event, "target", { value: origin });
  Object.assign(event, {
    clientX: 25,
    clientY: 25,
    dataTransfer: { setDragImage() {} },
    ...properties,
  });
  element.dispatchEvent(event);
  return event;
}

export function touch(source, type = "touchstart", count = 1, x = 25) {
  return send(document, type, {
    origin: source,
    touches: Array.from({ length: count }, () => ({
      clientX: x,
      clientY: 25,
      pageX: x,
      pageY: 25,
    })),
  });
}

export function bind(t, factory, options, element = new TestElement()) {
  const controller = factory(options);
  controller.bind(element);
  t.after(() => controller.destroy());
  return { controller, element };
}
