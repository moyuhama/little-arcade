(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    P = PlayingCards,
    $ = A.$;
  let question,
    tokens = [],
    solved = false,
    revealed = false,
    streak = 0,
    buttons = [];
  const symbols = {
    "+": "+",
    "-": "−",
    "*": "×",
    "/": "÷",
    "(": "(",
    ")": ")",
  };
  function render() {
    buttons.forEach((b, i) => {
      b.disabled = solved || tokens.includes(i);
      b.classList.toggle("used", tokens.includes(i));
    });
    document.querySelectorAll("#operators button").forEach((b) => {
      b.disabled = solved;
    });
    $("expression").textContent = tokens.length
      ? tokens
          .map((t) => (Number.isInteger(t) ? question.values[t] : symbols[t]))
          .join(" ")
      : "点击四张牌和运算符，组成你的算式";
    $("undo").disabled = !tokens.length || solved;
    $("clear").disabled = !tokens.length || solved;
    $("verify").disabled = solved;
    $("reveal").disabled = solved || revealed;
    $("restart").textContent = solved ? "下一题 →" : "换一题";
    A.score(streak, A.number("best"));
  }
  function append(t) {
    if (
      solved ||
      tokens.length >= 40 ||
      (Number.isInteger(t) && tokens.includes(t))
    )
      return;
    tokens.push(t);
    render();
  }
  function undo() {
    if (solved) return;
    tokens.pop();
    render();
  }
  function verify() {
    if (solved) return;
    const result = E.evaluate(tokens, question.values);
    if (!result.valid) {
      A.status(result.error);
      return;
    }
    if (!result.correct) {
      const v = result.value;
      A.status(
        `现在算出的是 ${v.d === 1 ? v.n : v.n + "/" + v.d}，还不是 24。可以退一格继续试。`,
      );
      return;
    }
    solved = true;
    A.completed();
    if (!revealed) {
      streak++;
      A.best(streak);
    }
    A.status(
      revealed
        ? "算对了！这题练习完成，下一题试着独立解出来。"
        : `正好 24！已经连续解开 ${streak} 题。`,
    );
    render();
  }
  function reset() {
    if (question && !solved) streak = 0;
    question = E.create();
    tokens = [];
    solved = false;
    revealed = false;
    $("solution").hidden = true;
    $("solution").textContent = "";
    buttons = question.cards.map((id, i) =>
      P.card(
        id,
        `第 ${i + 1} 张，${P.name(id)}，数值 ${question.values[i]}`,
        () => append(i),
      ),
    );
    $("hand").replaceChildren(
      ...buttons.map((b, i) => {
        const slot = document.createElement("div");
        slot.className = "card-slot";
        const label = document.createElement("span");
        label.className = "card-slot-label";
        label.textContent = `按 ${i + 1} · 数值 ${question.values[i]}`;
        slot.append(b, label);
        return slot;
      }),
    );
    A.status("四张牌各用一次，只用四则运算和括号。");
    render();
  }
  for (const op of ["+", "-", "*", "/", "(", ")"])
    $("operators").append(
      A.button(
        symbols[op],
        {
          "+": "加",
          "-": "减",
          "*": "乘",
          "/": "除",
          "(": "左括号",
          ")": "右括号",
        }[op],
        () => append(op),
      ),
    );
  $("undo").onclick = undo;
  $("clear").onclick = () => {
    if (!solved) {
      tokens = [];
      render();
    }
  };
  $("verify").onclick = verify;
  $("restart").onclick = reset;
  $("reveal").onclick = () => {
    if (solved || revealed) return;
    revealed = true;
    streak = 0;
    $("solution").textContent =
      "一种解法：" +
      question.solution
        .replaceAll("*", " × ")
        .replaceAll("/", " ÷ ")
        .replaceAll("+", " + ")
        .replaceAll("-", " − ") +
      " = 24";
    $("solution").hidden = false;
    A.status("可以照着试一遍。看过解法后，本题不计连过。");
    render();
  };
  document.addEventListener("keydown", (e) => {
    if (
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.target.matches("input,select,textarea")
    )
      return;
    if (/^[1-4]$/.test(e.key)) {
      e.preventDefault();
      append(Number(e.key) - 1);
    } else if (Object.hasOwn(symbols, e.key)) {
      e.preventDefault();
      append(e.key);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      undo();
    } else if (e.key === "Enter" && !e.target.closest("button,a")) {
      e.preventDefault();
      verify();
    }
  });
  reset();
})();
