/* Validated stage checkpoints; no in-flight simulation state is persisted. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ArcadeCampaign = factory();
})(globalThis, () => {
  const begin = (level = 0) => ({ level, score: 0, full: level === 0 });
  function restore(value, count) {
    if (
      !value ||
      !Number.isInteger(value.level) ||
      value.level < 0 ||
      value.level >= count ||
      !Number.isSafeInteger(value.score) ||
      value.score < 0 ||
      typeof value.full !== "boolean" ||
      (value.level === 0 && value.score !== 0)
    )
      return begin();
    return { level: value.level, score: value.score, full: value.full };
  }
  function advance(checkpoint, score, count) {
    if (checkpoint.level + 1 >= count) return begin();
    return restore(
      { level: checkpoint.level + 1, score, full: checkpoint.full },
      count,
    );
  }
  return { begin, restore, advance };
});
