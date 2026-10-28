const { test } = require("node:test");
const assert = require("node:assert/strict");
const { enterLandscape } = require("../mobile-play.js");

test("unsupported browsers keep manual rotation available without throwing", async () => {
  assert.deepEqual(await enterLandscape({ documentElement: {} }, {}), {
    enteredFullscreen: false,
    locked: false,
  });
});

test("orientation lock waits for fullscreen and requests either landscape direction", async () => {
  const calls = [];
  const doc = {
    fullscreenEnabled: true,
    documentElement: {
      requestFullscreen: async () => {
        await Promise.resolve();
        calls.push("fullscreen");
      },
    },
  };
  const screen = {
    orientation: { lock: async (direction) => calls.push(direction) },
  };
  assert.deepEqual(await enterLandscape(doc, screen), {
    enteredFullscreen: true,
    locked: true,
  });
  assert.deepEqual(calls, ["fullscreen", "landscape"]);
});

test("a rejected fullscreen request still supports installed apps that can lock directly", async () => {
  const doc = {
    fullscreenEnabled: true,
    documentElement: {
      requestFullscreen: async () => {
        throw new Error("NotAllowedError");
      },
    },
  };
  assert.deepEqual(
    await enterLandscape(doc, { orientation: { lock: async () => {} } }),
    {
      enteredFullscreen: false,
      locked: true,
    },
  );
});

test("a rejected orientation lock falls back even after fullscreen succeeds", async () => {
  const doc = {
    fullscreenEnabled: true,
    documentElement: { requestFullscreen: async () => {} },
  };
  const screen = {
    orientation: {
      lock: async () => {
        throw new Error("NotSupportedError");
      },
    },
  };
  assert.deepEqual(await enterLandscape(doc, screen), {
    enteredFullscreen: true,
    locked: false,
  });
});

test("an existing fullscreen session is not requested again or claimed as ours", async () => {
  const doc = {
    fullscreenElement: {},
    fullscreenEnabled: true,
    documentElement: {
      requestFullscreen: () => {
        throw new Error("Must not request twice");
      },
    },
  };
  assert.deepEqual(
    await enterLandscape(doc, { orientation: { lock: async () => {} } }),
    {
      enteredFullscreen: false,
      locked: true,
    },
  );
});

test("disabled fullscreen does not call the API even if the method exists", async () => {
  const doc = {
    fullscreenEnabled: false,
    documentElement: {
      requestFullscreen: () => {
        assert.fail("Fullscreen is disabled");
      },
    },
  };
  assert.deepEqual(await enterLandscape(doc, {}), {
    enteredFullscreen: false,
    locked: false,
  });
});
