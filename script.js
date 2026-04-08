const inputDisplay = document.getElementById("display-input");
const outputDisplay = document.getElementById("display-output");
const historyDisplay = document.getElementById("display-history");
const buttons = Array.from(document.querySelectorAll(".btn"));
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

const operators = new Set(["+", "-", "*", "/"]);
const themeStorageKey = "calculator-theme";

const state = {
  expression: "",
  previousCalculation: "",
  hasError: false,
};

// ---------- Display ----------
function updateDisplay() {
  historyDisplay.textContent = state.previousCalculation || "";

  if (state.hasError) {
    inputDisplay.textContent = "Error";
    outputDisplay.textContent = "Error";
    return;
  }

  inputDisplay.textContent = state.expression || "0";

  if (!state.expression) {
    outputDisplay.textContent = "0";
    return;
  }

  if (!isExpressionReady(state.expression)) {
    outputDisplay.textContent = "...";
    return;
  }

  const liveResult = tryCalculate(state.expression);
  outputDisplay.textContent = liveResult === null ? "Error" : liveResult;
}

function pulseOutput() {
  outputDisplay.classList.remove("pulse");
  void outputDisplay.offsetHeight;
  outputDisplay.classList.add("pulse");
}

function setErrorState() {
  state.hasError = true;
  updateDisplay();
}

// ---------- Input Actions ----------
function appendValue(value) {
  if (state.hasError) {
    state.expression = "";
    state.hasError = false;
  }

  if (operators.has(value)) {
    appendOperator(value);
    updateDisplay();
    return;
  }

  if (value === ".") {
    appendDecimal();
    updateDisplay();
    return;
  }

  appendDigit(value);
  updateDisplay();
}

function appendDigit(digit) {
  if (!state.expression) {
    state.expression = digit;
    return;
  }

  const currentSegment = getCurrentNumberSegment(state.expression);

  // Avoid leading zeros such as 00012.
  if (currentSegment === "0") {
    state.expression = state.expression.slice(0, -1) + digit;
    return;
  }

  // Keep negative numbers clean, e.g., -05 -> -5.
  if (currentSegment === "-0") {
    state.expression = state.expression.slice(0, -1) + digit;
    return;
  }

  state.expression += digit;
}

function appendOperator(operator) {
  if (!state.expression) {
    // Allow starting with negative values, e.g. -7+2.
    if (operator === "-") {
      state.expression = "-";
    }
    return;
  }

  if (state.expression === "-") {
    return;
  }

  const lastChar = state.expression.slice(-1);

  // Prevent multiple operators by replacing the previous one.
  if (operators.has(lastChar)) {
    state.expression = state.expression.slice(0, -1) + operator;
    return;
  }

  if (lastChar === ".") {
    return;
  }

  state.expression += operator;
}

function appendDecimal() {
  if (!state.expression) {
    state.expression = "0.";
    return;
  }

  const lastChar = state.expression.slice(-1);

  if (operators.has(lastChar)) {
    state.expression += "0.";
    return;
  }

  if (lastChar === ".") {
    return;
  }

  const currentSegment = getCurrentNumberSegment(state.expression);
  if (currentSegment.includes(".")) {
    return;
  }

  if (state.expression === "-") {
    state.expression = "-0.";
    return;
  }

  state.expression += ".";
}

function clearDisplay() {
  state.expression = "";
  state.hasError = false;
  updateDisplay();
}

function backspace() {
  if (state.hasError) {
    clearDisplay();
    return;
  }

  state.expression = state.expression.slice(0, -1);
  updateDisplay();
}

function calculateResult() {
  if (!state.expression || state.hasError || !isExpressionReady(state.expression)) {
    return;
  }

  const result = tryCalculate(state.expression);
  if (result === null) {
    setErrorState();
    return;
  }

  state.previousCalculation = `${state.expression} = ${result}`;
  state.expression = result;
  state.hasError = false;
  updateDisplay();
  pulseOutput();
}

// ---------- Safe Calculation (No eval) ----------
function tryCalculate(rawExpression) {
  try {
    const numericResult = evaluateExpression(rawExpression);
    if (!Number.isFinite(numericResult)) {
      return null;
    }
    return formatResult(numericResult);
  } catch {
    return null;
  }
}

function evaluateExpression(rawExpression) {
  const tokens = tokenize(rawExpression);
  if (!tokens || tokens.length === 0) {
    throw new Error("Invalid expression");
  }

  const values = [];
  const pendingOperators = [];

  for (const token of tokens) {
    if (typeof token === "number") {
      values.push(token);
      continue;
    }

    while (
      pendingOperators.length > 0 &&
      precedence(pendingOperators[pendingOperators.length - 1]) >= precedence(token)
    ) {
      applyTopOperator(values, pendingOperators);
    }

    pendingOperators.push(token);
  }

  while (pendingOperators.length > 0) {
    applyTopOperator(values, pendingOperators);
  }

  if (values.length !== 1) {
    throw new Error("Invalid expression");
  }

  return values[0];
}

function tokenize(rawExpression) {
  const cleanedExpression = rawExpression.replace(/\s+/g, "");
  if (!cleanedExpression) {
    return [];
  }

  const tokens = [];
  let numberBuffer = "";

  for (let index = 0; index < cleanedExpression.length; index += 1) {
    const character = cleanedExpression[index];

    if (isDigit(character) || character === ".") {
      numberBuffer += character;
      continue;
    }

    if (!operators.has(character)) {
      return null;
    }

    const previousCharacter = cleanedExpression[index - 1];
    const isUnaryMinus =
      character === "-" && (index === 0 || operators.has(previousCharacter));

    if (isUnaryMinus) {
      numberBuffer += "-";
      continue;
    }

    if (!pushBufferedNumber(tokens, numberBuffer)) {
      return null;
    }

    numberBuffer = "";
    tokens.push(character);
  }

  if (!pushBufferedNumber(tokens, numberBuffer)) {
    return null;
  }

  if (!isTokenOrderValid(tokens)) {
    return null;
  }

  return tokens;
}

function pushBufferedNumber(tokens, numberBuffer) {
  if (!numberBuffer || numberBuffer === "-") {
    return false;
  }

  const parsedNumber = Number(numberBuffer);
  if (Number.isNaN(parsedNumber)) {
    return false;
  }

  tokens.push(parsedNumber);
  return true;
}

function isTokenOrderValid(tokens) {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (index % 2 === 0 && typeof token !== "number") {
      return false;
    }

    if (index % 2 === 1 && typeof token !== "string") {
      return false;
    }
  }

  return true;
}

function applyTopOperator(values, pendingOperators) {
  if (values.length < 2 || pendingOperators.length === 0) {
    throw new Error("Invalid operation");
  }

  const rightOperand = values.pop();
  const leftOperand = values.pop();
  const operator = pendingOperators.pop();

  if (operator === "+") values.push(leftOperand + rightOperand);
  else if (operator === "-") values.push(leftOperand - rightOperand);
  else if (operator === "*") values.push(leftOperand * rightOperand);
  else if (operator === "/") {
    if (rightOperand === 0) {
      throw new Error("Division by zero");
    }
    values.push(leftOperand / rightOperand);
  }
}

function precedence(operator) {
  if (operator === "+" || operator === "-") return 1;
  if (operator === "*" || operator === "/") return 2;
  return 0;
}

function isDigit(character) {
  return character >= "0" && character <= "9";
}

function formatResult(number) {
  const roundedNumber = Number(number.toFixed(10));
  return roundedNumber.toString();
}

function getCurrentNumberSegment(rawExpression) {
  const chunks = rawExpression.split(/[+\-*/]/);
  const segment = chunks[chunks.length - 1];

  if (rawExpression.endsWith("-") && (chunks.length === 1 || operators.has(rawExpression.slice(-2, -1)))) {
    return "-";
  }

  return segment;
}

function isExpressionReady(rawExpression) {
  if (!rawExpression || rawExpression === "-") {
    return false;
  }

  const lastCharacter = rawExpression.slice(-1);
  return !operators.has(lastCharacter) && lastCharacter !== ".";
}

// ---------- Theme ----------
function initializeTheme() {
  const savedTheme = localStorage.getItem(themeStorageKey);

  if (savedTheme === "light") {
    document.body.classList.add("light");
  }

  updateThemeIcon();
}

function toggleTheme() {
  document.body.classList.toggle("light");

  const selectedTheme = document.body.classList.contains("light")
    ? "light"
    : "dark";

  localStorage.setItem(themeStorageKey, selectedTheme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const isLight = document.body.classList.contains("light");

  themeIcon.textContent = isLight ? "🌙" : "☀️";
  themeToggle.setAttribute(
    "aria-label",
    isLight ? "Switch to dark mode" : "Switch to light mode"
  );
}

// ---------- Keyboard Support ----------
function handleKeyboardInput(event) {
  const { key } = event;

  if ((key >= "0" && key <= "9") || key === ".") {
    appendValue(key);
    flashButtonByValue(key);
    return;
  }

  if (operators.has(key)) {
    appendValue(key);
    flashButtonByValue(key);
    return;
  }

  if (key === "x" || key === "X") {
    appendValue("*");
    flashButtonByValue("*");
    return;
  }

  if (key === "Enter" || key === "=") {
    event.preventDefault();
    calculateResult();
    flashButtonByAction("equals");
    return;
  }

  if (key === "Backspace") {
    event.preventDefault();
    backspace();
    flashButtonByAction("backspace");
    return;
  }

  if (key === "Escape" || key.toLowerCase() === "c" || key === "Delete") {
    clearDisplay();
    flashButtonByAction("clear");
  }
}

function flashButtonByValue(value) {
  const targetButton = document.querySelector(`.btn[data-value="${value}"]`);
  flashButton(targetButton);
}

function flashButtonByAction(action) {
  const targetButton = document.querySelector(`.btn[data-action="${action}"]`);
  flashButton(targetButton);
}

function flashButton(button) {
  if (!button) {
    return;
  }

  button.classList.add("btn-pressed");
  setTimeout(() => {
    button.classList.remove("btn-pressed");
  }, 120);
}

// ---------- Events ----------
buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const { action, value } = button.dataset;

    if (action === "clear") {
      clearDisplay();
      return;
    }

    if (action === "backspace") {
      backspace();
      return;
    }

    if (action === "equals") {
      calculateResult();
      return;
    }

    if (value) {
      appendValue(value);
    }
  });
});

themeToggle.addEventListener("click", toggleTheme);
document.addEventListener("keydown", handleKeyboardInput);

initializeTheme();
updateDisplay();
