import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  Element: dom.window.Element,
  SVGElement: dom.window.SVGElement,
  HTMLCanvasElement: dom.window.HTMLCanvasElement,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
});
let frameId = 0;
const frames = new Map();
globalThis.requestAnimationFrame = (callback) => {
  frames.set(++frameId, callback);
  return frameId;
};
globalThis.cancelAnimationFrame = (id) => frames.delete(id);
dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
  left: 0,
  top: 0,
  width: 100,
  height: 100,
});
const { createApp, h, reactive, ref, nextTick, isReadonly } =
  await import("vue");
const { useDraggable, useDroppable, useDnD, useCreateSortable, useSortable } = await import("../src/vue.js");
const { configureDnD } = await import("../src/index.js");

beforeEach(() => configureDnD({ attributesPrefix: "dnd", touch: true }));
afterEach(() => frames.clear());

async function mount(t, setup) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ setup });
  let mounted = true;
  function unmount() {
    if (!mounted) return;
    const elements = [
      ...container.querySelectorAll("[data-source], [data-target], [data-row]"),
    ];
    app.unmount();
    mounted = false;
    for (const element of elements) {
      assert.equal(element.hasAttribute("draggable"), false);
      assert.equal(
        [...element.attributes].some((attribute) =>
          attribute.name.startsWith("data-dnd-"),
        ),
        false,
      );
    }
    container.remove();
  }
  t.after(unmount);
  app.mount(container);
  await nextTick();
  return { container, unmount };
}

async function send(element, type, properties = {}) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    clientX: 25,
    clientY: 25,
    dataTransfer: { setDragImage() {} },
    ...properties,
  });
  element.dispatchEvent(event);
  await nextTick();
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach((callback) => callback());
  await nextTick();
  return event;
}

async function pair(t, settings = {}) {
  const config = reactive({
    hunger: 6,
    alternate: false,
    visible: true,
    disabled: false,
  });
  let source,
    target,
    renders = 0;
  const callbacks = ref([]);
  const onDrop = ref((args) => callbacks.value.push(args));
  const mounted = await mount(t, () => {
    source = useDraggable(
      () => ({ type: "food", data: { quality: 2 }, disabled: config.disabled }),
      settings,
    );
    target = useDroppable(
      () => ({
        types: ["food"],
        data: { hunger: config.hunger },
        when: ({ drop }) => drop.hunger > 0,
        onDrop: onDrop.value,
      }),
      settings,
    );
    return () => {
      assert.ok(++renders < 40, "reactive options caused a render loop");
      return h(
        "section",
        null,
        h(
          "div",
          { ref: source.ref, "data-source": "" },
          String(source.state.value.dragging),
        ),
        config.visible
          ? h(
              config.alternate ? "article" : "div",
              { ref: target.ref, "data-target": "" },
              String(target.state.value.accepts),
            )
          : null,
      );
    };
  });
  return {
    ...mounted,
    config,
    source,
    target,
    onDrop,
    callbacks,
    get renders() {
      return renders;
    },
    sourceEl: () => mounted.container.querySelector("[data-source]"),
    targetEl: () => mounted.container.querySelector("[data-target]"),
  };
}

test("Vue composables bind, expose state refs and clean up on unmount", async (t) => {
  const mounted = await pair(t);
  assert.equal(isReadonly(mounted.target.state), true);
  assert.equal(mounted.sourceEl().getAttribute("draggable"), "true");
  await send(mounted.sourceEl(), "dragstart");
  await send(mounted.targetEl(), "dragover");
  assert.equal(mounted.source.state.value.dragging, true);
  assert.equal(mounted.target.state.value.accepts, true);
  assert.equal(mounted.target.state.value.drop.hunger, 6);
  mounted.unmount();
  assert.throws(
    () => mounted.source.controller.update({ type: "food" }),
    /destroyed/,
  );
  assert.throws(
    () => mounted.target.controller.bind(document.createElement("div")),
    /destroyed/,
  );
});

test("reactive data and callback changes preserve hover and use the current data", async (t) => {
  const mounted = await pair(t);
  await send(mounted.sourceEl(), "dragstart");
  await send(mounted.targetEl(), "dragover", { clientY: 75 });
  const received = [];
  mounted.config.hunger = 3;
  mounted.onDrop.value = (args) => received.push(args.drop.hunger);
  await nextTick();
  assert.equal(mounted.target.state.value.accepts, true);
  assert.equal(mounted.target.state.value.y, 75);
  assert.equal(mounted.target.state.value.drop.hunger, 3);
  await send(mounted.targetEl(), "drop", { clientY: 75 });
  assert.deepEqual(received, [3]);
  assert.equal(mounted.callbacks.value.length, 0);
  await send(mounted.sourceEl(), "dragend");
  assert.deepEqual(mounted.target.state.value, {});
});

test("Vue reactive options refresh acceptance and disabled sources", async (t) => {
  const mounted = await pair(t);
  await send(mounted.sourceEl(), "dragstart");
  await send(mounted.targetEl(), "dragover");
  mounted.config.hunger = 0;
  await nextTick();
  assert.equal(mounted.target.state.value.unconcerned, true);
  assert.equal(mounted.target.state.value.x, undefined);
  mounted.config.hunger = 2;
  await nextTick();
  assert.equal(mounted.target.state.value.concerned, true);
  assert.equal(mounted.target.state.value.accepts, false);
  await send(mounted.targetEl(), "dragover");
  mounted.config.disabled = true;
  await nextTick();
  assert.equal(mounted.sourceEl().hasAttribute("draggable"), false);
  assert.equal(mounted.source.state.value.dragging, false);
  assert.deepEqual(mounted.target.state.value, {});
});

test("Vue template refs detach and rebind when elements change or disappear", async (t) => {
  const mounted = await pair(t);
  await send(mounted.sourceEl(), "dragstart");
  await send(mounted.targetEl(), "dragover");
  const old = mounted.targetEl();
  mounted.config.alternate = true;
  await nextTick();
  assert.notEqual(mounted.targetEl(), old);
  assert.equal(old.hasAttribute("data-dnd-droppable"), false);
  assert.equal(mounted.target.state.value.accepts, false);
  await send(mounted.targetEl(), "dragover");
  mounted.config.visible = false;
  await nextTick();
  assert.deepEqual(mounted.target.state.value, {});
  mounted.config.visible = true;
  await nextTick();
  assert.equal(mounted.target.state.value.concerned, true);
  await send(mounted.sourceEl(), "dragend");
});

test("Vue subscribe:false leaves state idle while attributes and callbacks work", async (t) => {
  const mounted = await pair(t, { subscribe: false });
  const renders = mounted.renders;
  await send(mounted.sourceEl(), "dragstart");
  await send(mounted.targetEl(), "dragover");
  assert.equal(mounted.renders, renders);
  assert.equal(mounted.source.state.value.dragging, false);
  assert.deepEqual(mounted.target.state.value, {});
  assert.equal(mounted.targetEl().hasAttribute("data-dnd-accepts"), true);
  await send(mounted.targetEl(), "drop");
  assert.equal(mounted.callbacks.value.length, 1);
  await send(mounted.sourceEl(), "dragend");
});

test("Vue subscription settings can be reactive", async (t) => {
  const settings = reactive({ subscribe: false });
  const mounted = await pair(t, () => settings);
  await send(mounted.sourceEl(), "dragstart");
  await send(mounted.targetEl(), "dragover");
  assert.deepEqual(mounted.target.state.value, {});
  settings.subscribe = true;
  await nextTick();
  assert.equal(mounted.target.state.value.accepts, true);
  settings.subscribe = false;
  await nextTick();
  assert.deepEqual(mounted.target.state.value, {});
  await send(mounted.sourceEl(), "dragend");
});

test("Vue options can be plain objects, refs, or getters", async (t) => {
  const options = ref({ type: "food", disabled: true });
  let source, target;
  const mounted = await mount(t, () => {
    source = useDraggable(options);
    target = useDroppable({ type: "food" });
    return () =>
      h(
        "section",
        null,
        h("div", { ref: source.ref, "data-source": "" }),
        h("div", { ref: target.ref, "data-target": "" }),
      );
  });
  const element = mounted.container.querySelector("[data-source]");
  assert.equal(element.hasAttribute("draggable"), false);
  options.value = { type: "food", disabled: false };
  await nextTick();
  await send(element, "dragstart");
  assert.equal(target.state.value.concerned, true);
  await send(element, "dragend");
});

test("Vue drop callbacks can update reactive application data", async (t) => {
  const hunger = ref(2),
    spoonfuls = ref(1);
  let source, target;
  const mounted = await mount(t, () => {
    source = useDraggable(() => ({
      type: "food",
      data: { quality: 2 },
      disabled: spoonfuls.value <= 0,
    }));
    target = useDroppable(() => ({
      type: "food",
      data: { hunger: hunger.value },
      when: ({ drop }) => drop.hunger > 0,
      onDrop: ({ drag }) => {
        hunger.value -= drag.quality;
        spoonfuls.value--;
      },
    }));
    return () =>
      h(
        "section",
        null,
        h("div", { ref: source.ref, "data-source": "" }, spoonfuls.value),
        h("div", { ref: target.ref, "data-target": "" }, hunger.value),
      );
  });
  const meal = mounted.container.querySelector("[data-source]");
  const baby = mounted.container.querySelector("[data-target]");
  await send(meal, "dragstart");
  await send(baby, "dragover");
  await send(baby, "drop");
  assert.equal(meal.textContent, "0");
  assert.equal(baby.textContent, "0");
  assert.equal(source.state.value.dragging, false);
  assert.deepEqual(target.state.value, {});
});

test("onChange observes source and target with Vue subscriptions disabled", async (t) => {
  const sources = [];
  const targets = [];
  const { container } = await mount(t, () => {
    const source = useDraggable(
      { type: "food", onChange: (state) => sources.push(state) },
      { subscribe: false },
    );
    const target = useDroppable(
      { type: "food", onChange: (state) => targets.push(state) },
      { subscribe: false },
    );
    return () => h("section", null,
      h("div", { ref: source.ref, "data-source": "" }),
      h("div", { ref: target.ref, "data-target": "" }),
    );
  });
  await send(container.querySelector("[data-source]"), "dragstart");
  assert.equal(sources.at(-1).dragging, true);
  await send(container.querySelector("[data-target]"), "dragover");
  assert.equal(targets.at(-1).accepts, true);
  await send(container.querySelector("[data-source]"), "dragend");
  assert.equal(sources.at(-1).dragging, false);
  assert.deepEqual(targets.at(-1), {});
});


test("Vue combined roles expose source dragging separately from target acceptance", async (t) => {
  let source, target;
  const drops = [];
  const { container } = await mount(t, () => {
    source = useDnD({ type: "item", data: "source", onDrop: () => drops.push("source") });
    target = useDnD({ type: "item", data: "target", onDrop: () => drops.push("target") });
    return () => h("section", null,
      h("div", { ref: source.ref, "data-source": "" }),
      h("div", { ref: target.ref, "data-target": "" }));
  });
  await send(container.querySelector("[data-source]"), "dragstart");
  await send(container.querySelector("[data-target]"), "dragover");
  assert.equal(source.state.value.dragging, true);
  assert.equal(target.state.value.dragging, false);
  assert.equal(target.state.value.accepts, true);
  await send(container.querySelector("[data-target]"), "drop");
  await send(container.querySelector("[data-source]"), "dragend");
  assert.deepEqual(drops, ["target"]);
});

test("Vue sortable follows reactive list options, indices and element replacement", async (t) => {
  const items = ref(["A", "B", "C"]);
  const settings = reactive({ noReorder: false, alternate: false, label: "initial" });
  const changes = [];
  const states = new Map();
  const Row = {
    props: ["sortable", "value", "index", "alternate"],
    setup(props) {
      const item = useSortable(props.sortable,
        () => ({ type: "item", data: { id: props.value }, index: props.index }));
      states.set(props.value, item.state);
      return () => h(props.alternate ? "article" : "div", { ref: item.ref, "data-row": props.value }, props.value);
    },
  };
  const { container } = await mount(t, () => {
    const sortable = useCreateSortable(() => ({ dataToId: "id", noReorder: settings.noReorder,
      onListChange(next, context) {
        changes.push([settings.label, context.ids]);
        items.value = next.map((value) => value.id);
      },
    }));
    return () => h("section", null, items.value.map((value, index) =>
      h(Row, { key: value, sortable, value, index, alternate: settings.alternate })));
  });
  const row = (id) => container.querySelector(`[data-row="${id}"]`);
  await send(row("A"), "dragstart");
  await send(row("B"), "dragover", { clientY: 75 });
  assert.equal(states.get("B").value.accepts, true);
  await send(row("B"), "drop", { clientY: 75 });
  await send(row("A"), "dragend");
  assert.deepEqual(changes.at(-1), ["initial", ["B", "A", "C"]]);
  settings.noReorder = true;
  await nextTick();
  await send(row("A"), "dragstart");
  await send(row("C"), "dragover");
  assert.equal(states.get("C").value.accepts, false);
  settings.noReorder = false;
  settings.label = "updated";
  await nextTick();
  await send(row("C"), "dragover", { clientY: 75 });
  await send(row("C"), "drop", { clientY: 75 });
  await send(row("A"), "dragend");
  assert.deepEqual(changes.at(-1), ["updated", ["B", "C", "A"]]);
  const old = row("A");
  settings.alternate = true;
  await nextTick();
  assert.equal(old.hasAttribute("draggable"), false);
  await send(row("A"), "dragstart");
  await send(row("B"), "dragover", { clientY: 25 });
  await send(row("B"), "drop", { clientY: 25 });
  await send(row("A"), "dragend");
  assert.deepEqual(changes.at(-1), ["updated", ["A", "B", "C"]]);
});


test("Vue sortable accepts a plain source and handles item removal with subscribe:false", async (t) => {
  const palette = ref([{ id: "X" }]);
  const items = ref([{ id: "A" }, { id: "B" }]);
  let context;
  const Row = {
    props: ["sortable", "value", "index"],
    setup(props) {
      const item = useSortable(props.sortable,
        () => ({ type: "item", data: props.value, index: props.index }), { subscribe: false });
      return () => h("div", { ref: item.ref, "data-row": props.value.id });
    },
  };
  const Source = {
    props: ["value"],
    setup(props) {
      const item = useDraggable(() => ({ type: "item", data: props.value }));
      return () => h("div", { ref: item.ref, "data-source": "" });
    },
  };
  const { container } = await mount(t, () => {
    const sortable = useCreateSortable({ dataToId: "id", allowExternal: true,
      onListChange(next, details) {
        context = details;
        items.value = next;
        palette.value = palette.value.filter((item) => item.id !== details.drag.id);
      },
    });
    return () => h("section", null,
      palette.value.map((value) => h(Source, { key: value.id, value })),
      items.value.map((value, index) => h(Row, { key: value.id, value, index, sortable })));
  });
  const source = container.querySelector("[data-source]");
  const target = container.querySelector('[data-row="A"]');
  await send(source, "dragstart");
  await send(target, "dragover", { clientY: 75 });
  assert.equal(target.hasAttribute("data-dnd-accepts"), true);
  await send(target, "drop", { clientY: 75 });
  assert.equal(context.external, true);
  assert.equal(context.dragIndex, undefined);
  assert.deepEqual(context.ids, ["A", "X", "B"]);
  assert.equal(source.hasAttribute("draggable"), false);
  assert.equal(container.querySelector("[data-source]"), null);
  assert.deepEqual(items.value.map((item) => item.id), ["A", "X", "B"]);
});
