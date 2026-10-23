import { noop } from "./functions.js";

/* Scroll while the stationary touch remains near an edge. Each axis uses the
 * nearest ancestor that can still scroll in that direction, then the page. */
export default function startAutoScroll(
  rootDocument,
  getPoint,
  options,
  onScroll,
) {
  const { autoScroll, scrollSensitivity, scrollSpeed } = options;
  if (!autoScroll || !(scrollSensitivity > 0) || !(scrollSpeed > 0))
    return noop;

  let frame;
  let previousTime;
  let stopped = false;

  function tick(time) {
    if (stopped) return;
    const elapsed =
      previousTime === undefined ? 0 : Math.min(50, time - previousTime);
    previousTime = time;
    if (
      elapsed > 0 &&
      scrollAtPoint(
        rootDocument,
        getPoint(),
        scrollSensitivity,
        (scrollSpeed * elapsed) / 1000,
      )
    ) {
      onScroll();
    }
    if (!stopped) frame = requestAnimationFrame(tick);
  }

  frame = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
  };
}

function scrollAtPoint(rootDocument, point, margin, distance) {
  const page = rootDocument.scrollingElement;
  const viewport = rootDocument.documentElement;
  const view = rootDocument.defaultView;
  const width = viewport?.clientWidth || view?.innerWidth || 0;
  const height = viewport?.clientHeight || view?.innerHeight || 0;
  if (point.x < 0 || point.y < 0 || point.x > width || point.y > height)
    return false;

  const ancestors = [];
  for (
    let node = rootDocument.elementFromPoint(point.x, point.y);
    node;
    node = node.parentElement
  ) {
    ancestors.push(node);
  }
  if (page && !ancestors.includes(page)) ancestors.push(page);

  let scrolledX = false;
  let scrolledY = false;
  for (const element of ancestors) {
    const isPage = element === page;
    const style = getComputedStyle(element);
    const rect = isPage
      ? { left: 0, top: 0, width, height }
      : element.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(width, rect.left + rect.width);
    const bottom = Math.min(height, rect.top + rect.height);
    if (point.x < left || point.x > right || point.y < top || point.y > bottom)
      continue;

    const dx =
      scrolledX || !canScroll(style.overflowX || style.overflow, isPage)
        ? 0
        : edgeVelocity(point.x, left, right, margin) * distance;
    const dy =
      scrolledY || !canScroll(style.overflowY || style.overflow, isPage)
        ? 0
        : edgeVelocity(point.y, top, bottom, margin) * distance;
    const oldX = element.scrollLeft;
    const oldY = element.scrollTop;
    const nextX = Math.max(
      0,
      Math.min(element.scrollWidth - element.clientWidth, oldX + dx),
    );
    const nextY = Math.max(
      0,
      Math.min(element.scrollHeight - element.clientHeight, oldY + dy),
    );
    if ((dx && nextX !== oldX) || (dy && nextY !== oldY)) {
      /* Explicit instant behavior avoids a CSS smooth-scroll animation lagging
       * behind the per-frame positions used for hit testing. */
      element.scrollBy({
        left: dx ? nextX - oldX : 0,
        top: dy ? nextY - oldY : 0,
        behavior: "instant",
      });
      scrolledX ||= element.scrollLeft !== oldX;
      scrolledY ||= element.scrollTop !== oldY;
    }
    if (scrolledX && scrolledY) break;
  }
  return scrolledX || scrolledY;
}

function canScroll(overflow, isPage) {
  return isPage
    ? overflow !== "hidden" && overflow !== "clip"
    : /^(auto|scroll|overlay)$/.test(overflow);
}

function edgeVelocity(position, start, end, margin) {
  const zone = Math.min(margin, (end - start) / 2);
  if (zone <= 0) return 0;
  if (position < start + zone) return -(1 - (position - start) / zone);
  if (position > end - zone) return 1 - (end - position) / zone;
  return 0;
}
