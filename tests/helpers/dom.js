/* A deliberately small DOM substitute for controller logic, not a browser.
 * Node isolates test files in separate processes, so these globals stay local.
 * Event propagation is explicit: send(parent, ..., { origin: child }) exercises
 * the parent listener without pretending to reproduce browser drag gestures.
 */
export class TestElement extends EventTarget {
  attributes = new Map();
  classList = {
    contains: (name) => (this.attributes.get("class") || "").split(/\s+/).includes(name),
    add: (...names) => this.attributes.set("class", [...new Set([...(this.attributes.get("class") || "").split(/\s+/).filter(Boolean), ...names])].join(" ")),
    remove: (...names) => this.attributes.set("class", (this.attributes.get("class") || "").split(/\s+/).filter((name) => name && !names.includes(name)).join(" ")),
  };
  style = {
    cursor: "",
    userSelect: "text",
    webkitUserSelect: "",
    webkitTouchCallout: "",
  };
  children = [];
  parentElement = null;
  clientWidth = 100;
  clientHeight = 100;
  scrollWidth = 100;
  scrollHeight = 100;
  scrollLeft = 0;
  scrollTop = 0;
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
  scrollBy({ left = 0, top = 0 }) {
    this.scrollLeft = Math.max(
      0,
      Math.min(this.scrollWidth - this.clientWidth, this.scrollLeft + left),
    );
    this.scrollTop = Math.max(
      0,
      Math.min(this.scrollHeight - this.clientHeight, this.scrollTop + top),
    );
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
  documentElement = Object.assign(new TestElement(), {
    clientWidth: 400,
    clientHeight: 600,
    scrollWidth: 400,
    scrollHeight: 600,
  });
  scrollingElement = this.documentElement;
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
globalThis.window = {
  setTimeout: (...args) => globalThis.setTimeout(...args),
  innerWidth: 400,
  innerHeight: 600,
  get scrollX() {
    return document.scrollingElement.scrollLeft;
  },
  get scrollY() {
    return document.scrollingElement.scrollTop;
  },
};
document.defaultView = globalThis.window;
globalThis.getComputedStyle = (element) => ({
  length: 0,
  pointerEvents: "auto",
  overflowX: element.style.overflowX || element.style.overflow || "visible",
  overflowY: element.style.overflowY || element.style.overflow || "visible",
});

let frameId = 0;
const frames = new Map();
globalThis.requestAnimationFrame = (callback) => {
  frames.set(++frameId, callback);
  return frameId;
};
globalThis.cancelAnimationFrame = (id) => frames.delete(id);

let frameTime = 0;
export function flushFrames(elapsed = 16) {
  frameTime += elapsed;
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(frameTime));
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

export function touch(source, type = "touchstart", count = 1, x = 25, y = 25) {
  return send(document, type, {
    origin: source,
    touches: Array.from({ length: count }, () => ({
      clientX: x,
      clientY: y,
      pageX: x + document.scrollingElement.scrollLeft,
      pageY: y + document.scrollingElement.scrollTop,
    })),
  });
}

export function bind(t, factory, options, element = new TestElement()) {
  const controller = factory(options);
  controller.bind(element);
  t.after(() => controller.destroy());
  return { controller, element };
}
