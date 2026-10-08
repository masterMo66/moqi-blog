import test from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "./content.mjs";

const formula = String.raw`价格=\frac{103}{1+3\%}=100`;

test("inline formulas render in prose and tables without losing TeX backslashes", () => {
  for (const source of [String.raw`收益率为 $3/97\approx3.09\%$。`, String.raw`| Formula |
| --- |
| $\frac{103}{1+3\%}$ |`]) {
    const html = markdownToHtml(source);
    assert.match(html, /class="katex"/);
    assert.doesNotMatch(html, /katex-error/);
  }
  assert.match(markdownToHtml(String.raw`$\frac{103}{1+3\%}$`), /<mfrac>/);
});

test("currency and escaped dollars remain text", () => {
  assert.doesNotMatch(markdownToHtml(String.raw`Costs $5 and $10; escaped \$x\$.`), /class="katex/);
});

test("bond price formula renders a fraction for single-line and multiline blocks", () => {
  for (const source of [`$$ ${formula} $$`, `$$\n${formula}\n$$`]) {
    const html = markdownToHtml(source);
    assert.match(html, /class="katex-display"/);
    assert.match(html, /<mfrac>/);
    assert.match(html, /价格/);
    assert.doesNotMatch(html, /katex-error/);
    assert.doesNotMatch(html, /\$\$/);
  }
});

test("math keeps TeX subscripts, ampersands and line breaks intact", () => {
  const html = markdownToHtml(String.raw`$$
\begin{aligned}P_0 &= \frac{103}{1+r} \\
P_1 &= 100\end{aligned}
$$`);
  assert.match(html, /<mtable/);
  assert.doesNotMatch(html, /katex-error/);
});

test("code examples and inline code retain literal math", () => {
  const html = markdownToHtml('```tex\n$$\n' + formula + '\n$$\n```\n\n`$$ x $$`');
  assert.doesNotMatch(html, /class="katex/);
  assert.match(html, /<code>\$\$ x \$\$<\/code>/);
});

test("unclosed delimiters preserve following Markdown", () => {
  const html = markdownToHtml('$$\nx\n\n## Next\n\nText');
  assert.match(html, /<h2 id="next">Next<\/h2>/);
  assert.match(html, /<p>Text<\/p>/);
});

test("invalid TeX cannot crash the build or inject HTML", () => {
  const html = markdownToHtml(String.raw`$$ \notACommand{<script>alert(1)</script>} $$`);
  assert.doesNotMatch(html, /<script>/);
});

test("math blocks preserve surrounding paragraph and list boundaries", () => {
  const html = markdownToHtml('Before\n\n- item\n\n$$ x=1 $$\n\nAfter');
  assert.match(html, /<p>Before<\/p>/);
  assert.match(html, /<ul><li>item<\/li><\/ul>/);
  assert.match(html, /<p>After<\/p>/);
  assert.doesNotMatch(html, /<p><span class="katex-display"/);
});
