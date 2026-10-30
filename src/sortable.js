import { SORTABLE } from "./constants.js";
import { dnd } from "./dnd.js";
import { arrayEqual, identity, isFunc, isObject } from "./functions.js";

export default function createSortable({
  allowExternal = false,
  dataToId = identity,
  horizontal = false,
  noAfter = false,
  noBefore = false,
  noReorder = false,
  noSwap = false,
  onListChange = undefined,
} = {}) {
  const itemsById = new Map();
  const getId = interpretDataToId(dataToId);
  const sortableId = Symbol("sortableId");

  return function sortable(el, options) {
    let state = {};
    let _options = {};
    let controller;
    let destroyed = false;
    const item = {
      getData: () => state.data,
      getIndex: () => state.index,
    };

    setOptions(options);

    return {
      destroy,
      update: setOptions,
    };

    function setOptions(options) {
      if (destroyed) {
        throw new Error("Cannot update a destroyed sortable binding.");
      }

      const { data: datum, index, ...rest } = options;

      if (!Number.isInteger(index) || index < 0) {
        throw new Error(
          "'index' must be a nonnegative integer in 'sortable' options",
        );
      }

      const id = getId(datum);

      if (itemsById.has(id) && itemsById.get(id) !== item) {
        throw new Error("Sortable items must have unique ids.");
      }

      if (controller && id !== state.id) detach();
      if (destroyed) return;

      const nextState = {
        data: datum,
        id,
        index,
        [sortableId]: true,
        [SORTABLE]: true,
      };
      state = nextState;
      _options = options;
      itemsById.set(id, item);

      const controllerArgs = {
        ...rest,
        data: nextState,
        onDrop,
        unless,
      };

      if (controller) {
        controller.update(controllerArgs);
      } else {
        const newController = dnd(el, controllerArgs);

        /* If something invalidating happened in the meantime, rollback. */
        if (destroyed || state !== nextState || itemsById.get(id) !== item) {
          newController.destroy();
          return;
        }

        controller = newController;
      }
    }

    function detach() {
      if (itemsById.get(state.id) === item) itemsById.delete(state.id);
      const previous = controller;
      controller = undefined;
      previous?.destroy();
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      detach();
    }

    function extractBeforeAfter({ bottom, left, right, top }) {
      const after = horizontal ? right : bottom;
      const before = horizontal ? left : top;

      return {
        after,
        before,
        middle: !after && !before,
      };
    }

    function isInternal(data) {
      return !!data?.[sortableId];
    }

    function unless(unlessArgs) {
      const { unless: _unless } = _options;

      /* External unless has precedence */
      if (_unless) {
        const _args = unwrapArgs(unlessArgs);

        if (isFunc(_unless) && _unless(_args)) return true;

        if (isObject(_unless)) {
          const typeUnless = _unless[unlessArgs.type];
          if (isFunc(typeUnless) && typeUnless(_args)) return true;
        }
      }

      const { drag, drop } = unlessArgs;
      const { after, before, middle } = extractBeforeAfter(unlessArgs);

      const externalDrag = !isInternal(drag);

      /* Invalid external drag. */
      if (externalDrag && !allowExternal) return true;

      /* Invalid internal reorder */
      if (!externalDrag && noReorder) return true;

      /* Invalid swap for external drag */
      if (middle && externalDrag) return true;

      if (after && noAfter) return true;
      if (before && noBefore) return true;
      if (middle && noSwap) return true;

      /* Consider index exceptions only for internal move */
      if (externalDrag || !isInternal(drop)) return false;

      const dragIndex = getDataIndex(drag);
      const dropIndex = getDataIndex(drop);

      if (dragIndex === dropIndex) return true;

      if (after && dropIndex + 1 === dragIndex) return true;
      if (before && dropIndex - 1 === dragIndex) return true;

      return false;
    }

    function onDrop(dropArgs) {
      const { drag, drop } = dropArgs;
      const { after, middle } = extractBeforeAfter(dropArgs);

      const _args = unwrapArgs(dropArgs);

      /* Execute normal `onDrop` */
      if (isFunc(_options.onDrop)) {
        _options.onDrop(_args);
      }

      /* Nothing to do */
      if (!isFunc(onListChange)) return;

      /* User callbacks may remove the target or replace its data/options. */
      if (destroyed || drop !== state || itemsById.get(state.id) !== item)
        return;

      const dragData = unwrapData(drag);
      const dragId = getId(dragData);
      const dropId = state.id;

      /* No change if both ids are the same.
       * Also prevents duplicate ids when inserting from elsewhere. */
      if (dragId === dropId) return;

      /* Read application order instead of committing a proposed drop internally. */
      const ids = getIds();
      const nextIds = [...ids];

      const dragIndex = nextIds.indexOf(dragId);

      const internal = isInternal(drag);

      /* If internal drag element not found, abort */
      if (internal && dragIndex < 0) return;

      if (middle) {
        if (!internal) return;

        const dropIndex = nextIds.indexOf(dropId);
        [nextIds[dragIndex], nextIds[dropIndex]] = [
          nextIds[dropIndex],
          nextIds[dragIndex],
        ];

        return processNextIds();
      }

      if (internal) {
        /* First remove drag element from the list */
        nextIds.splice(dragIndex, 1);
      }

      /* If external, element with same id must not already be present. */
      else if (dragIndex >= 0) return;

      /* Compute index after drag removal */
      const dropIndex = nextIds.indexOf(dropId);

      /* If no insertion target found, abort. */
      if (dropIndex < 0) return;

      /* Insert drag element */
      nextIds.splice(dropIndex + (after ? 1 : 0), 0, dragId);

      return processNextIds();

      function processNextIds() {
        /* No change. Abort. */
        if (arrayEqual(ids, nextIds)) return;

        /* For each id, retrieve corresponding data */
        const nextData = nextIds.map((id) => {
          /* When external, no item yet, so use drag data. */
          if (!internal && id === dragId) return dragData;
          return itemsById.get(id).getData();
        });

        onListChange(nextData, {
          ..._args,
          dragIndex: isDataSortable(drag) ? drag.index : undefined,
          external: !internal,
          ids: nextIds,
        });
      }
    }
  };

  function getIds() {
    return Array.from(itemsById.keys()).sort(
      (a, b) => getIdIndex(a) - getIdIndex(b),
    );
  }

  function getIdIndex(id) {
    const item = itemsById.get(id);
    if (!item) return -1;
    return item.getIndex();
  }

  function getDataIndex(maybeWrappedData) {
    const id = getId(unwrapData(maybeWrappedData));
    return getIdIndex(id);
  }
}

function interpretDataToId(dataToId) {
  if (isFunc(dataToId)) return dataToId;
  if (typeof dataToId === "string" || Number.isInteger(dataToId)) {
    return (data) => data[dataToId];
  }
  return identity;
}

function isDataSortable(data) {
  return !!data?.[SORTABLE];
}

function unwrapData(data) {
  if (!isObject(data) || !isDataSortable(data)) return data;
  return data.data;
}

function unwrapArgs(args) {
  const { drag, drop, ...rest } = args;
  return { ...rest, drag: unwrapData(drag), drop: unwrapData(drop) };
}
