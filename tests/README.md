# Understanding the tests

This test suite was generated with AI assistance. Its scenarios and assertions
should be reviewed and maintained alongside the library.

A test runs a small scenario and compares the actual result with the expected
result. It protects a behavior, such as: “a source disabled during a press-and-hold
never starts dragging.”

## Running the tests

From the repository root, using a recent version of Node 22 or later:

```sh
npm test
npm run test:watch
```

The second command keeps running and reruns the tests when files change. Press
Ctrl+C to stop it. The test runner and assertions are built into Node: no extra
framework or external service is required. Depending on your Node version, the
mock timers used by touch tests may display an experimental warning. They advance
time without actually waiting for the 300 ms hold delay.

To run a single file or scenario:

```sh
node --test tests/configure.test.js
node --test --test-name-pattern="second finger" tests/touch.test.js
```

## Reading a test

```js
test("partial updates preserve the prefix", () => {
  configureDnD({ attributesPrefix: "custom" });
  configureDnD({ touch: false });
  assert.equal(getConfig().attributesPrefix, "custom");
});
```

A test sets up a situation, performs an action, then checks the result.
`assert.equal` compares two values; `assert.deepEqual` compares structures;
`assert.throws` checks that a forbidden operation throws an error.

A passing test means that this particular scenario works. When a test fails,
Node displays its name, the relevant line, and the expected and actual values,
then exits with an error code. First determine whether the implementation broke
the behavior or you deliberately changed the API contract. Do not simply change
the expected result to make the failure disappear.

## Organization

- `configure.test.js`: partial updates and default settings.
- `namespaces.test.js`: namespace/type isolation and unsubscription.
- `controllers.test.js`: lifecycle, actions, callbacks, attributes, and drops.
- `touch.test.js`: touch inheritance, press-and-hold, movement, and cancellation.
- `helpers/dom.js`: a small DOM substitute shared by the scenarios.

Each test cleans up its controllers. Global settings are reset between scenarios.
Test files run in separate processes; tests within a file remain sequential to
avoid sharing an active drag session. Do not enable concurrent execution within
these files without reviewing their isolation.

## What still needs manual testing

The DOM substitute does not reproduce rendering or native browser behavior.
These tests do not establish that mobile scrolling, links after a drag, actual
event propagation, CSS drag images, or vibration behave correctly. Use the
playground and real phones to check those behaviors.

The suite is not exhaustive: add a focused scenario when fixing a bug or defining
a new rule. The tests do not modify source files or publish the package. The
`tests` directory is not included in the npm package.
