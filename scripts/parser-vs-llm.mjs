// Compara el lector por reglas contra un modelo de lenguaje sobre el conjunto de evaluación (issue 30).
// Uso:
//   npm run comparar-lector                                  califica el lector y los resultados guardados
//   npm run comparar-lector -- --llm claude-opus-5-5         llama al modelo (cuesta dinero) y guarda el resultado
//   npm run comparar-lector -- --llm claude-haiku-5-5 --effort medium
//
// Las respuestas del modelo se guardan en docs/parser-vs-llm/<modelo>-<esfuerzo>.json, así el informe
// (docs/PARSER_VS_LLM.md) se puede volver a generar sin pagar otra vez. Llamar al modelo necesita
// credenciales de Anthropic (ANTHROPIC_API_KEY o un perfil de `ant auth login`).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { PARSER_EVAL_SET } from '../tests/fixtures/parserEvalSet.js';
import { FIELDS, parserExtract, summarize } from './parser-vs-llm/grade.mjs';
import { Anthropic, costOf, createLlmExtractor } from './parser-vs-llm/llmExtractor.mjs';

const RESULTS_DIR = fileURLToPath(new URL('../docs/parser-vs-llm/', import.meta.url));
const PARSER_RUNS = 1000;

const { values: args } = parseArgs({
  options: { llm: { type: 'string' }, effort: { type: 'string', default: 'low' } },
});

// ---------------------------------------------------------------- correr

function runParser() {
  const predictions = new Map(PARSER_EVAL_SET.map((testCase) => [testCase.id, parserExtract(testCase.mail)]));
  const startedAt = performance.now();
  for (let run = 0; run < PARSER_RUNS; run++) for (const testCase of PARSER_EVAL_SET) parserExtract(testCase.mail);
  const msPerMail = (performance.now() - startedAt) / (PARSER_RUNS * PARSER_EVAL_SET.length);
  return { name: 'lector por reglas', predictions, latencies: [msPerMail], costPerMail: 0, errors: 0 };
}

function describeError(error) {
  if (error instanceof Anthropic.AuthenticationError) return 'autenticación';
  if (error instanceof Anthropic.RateLimitError) return 'límite de uso';
  if (error instanceof Anthropic.APIError) return `API ${error.status}`;
  return error.message;
}

async function runLlm(model, effort) {
  const extract = createLlmExtractor({ model, effort });
  const cases = {};
  for (const [index, testCase] of PARSER_EVAL_SET.entries()) {
    process.stderr.write(`\r${model} (${effort}): ${index + 1}/${PARSER_EVAL_SET.length}`);
    try {
      cases[testCase.id] = await extract(testCase.mail);
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) throw error;
      cases[testCase.id] = { movements: null, usage: { input: 0, output: 0 }, ms: 0, error: describeError(error) };
    }
  }
  process.stderr.write('\n');
  const result = { model, effort, ranAt: new Date().toISOString(), cases };
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(join(RESULTS_DIR, `${model}-${effort}.json`), JSON.stringify(result, null, 2) + '\n');
}

function loadSavedRuns() {
  let files = [];
  try {
    files = readdirSync(RESULTS_DIR).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
  return files.sort().map((name) => {
    const { model, effort, cases } = JSON.parse(readFileSync(join(RESULTS_DIR, name), 'utf8'));
    const entries = PARSER_EVAL_SET.map((testCase) => cases[testCase.id]).filter(Boolean);
    const totalCost = entries.reduce((sum, entry) => sum + (costOf(model, entry.usage) ?? 0), 0);
    return {
      name: `${model} (${effort})`,
      predictions: new Map(PARSER_EVAL_SET.map((testCase) => [testCase.id, cases[testCase.id]?.movements ?? null])),
      latencies: entries.filter((entry) => !entry.error).map((entry) => entry.ms),
      costPerMail: totalCost / entries.length,
      errors: entries.filter((entry) => entry.error).length,
      tokens: {
        input: entries.reduce((sum, entry) => sum + entry.usage.input, 0) / entries.length,
        output: entries.reduce((sum, entry) => sum + entry.usage.output, 0) / entries.length,
      },
    };
  });
}

// ---------------------------------------------------------------- informe

const percent = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)} %` : '—');
const quantile = (values, fraction) => {
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))] ?? 0;
};
const formatMs = (ms) => (ms < 1 ? `${(ms * 1000).toFixed(0)} µs` : `${(ms / 1000).toFixed(2)} s`);

function report(run) {
  const summary = summarize(PARSER_EVAL_SET, run.predictions);
  console.log(`\n== ${run.name} ==`);
  console.log(
    `  correos completamente bien: ${summary.correct}/${summary.total} (${percent(summary.correct, summary.total)})`,
  );
  console.log(
    '  por grupo: ' +
      Object.entries(summary.groups)
        .map(([group, stats]) => `${group} ${stats.correct}/${stats.total}`)
        .join(' · '),
  );
  console.log(
    '  por campo: ' +
      FIELDS.map(
        (field) => `${field} ${percent(summary.fieldTotals[field].ok, summary.fieldTotals[field].total)}`,
      ).join(' · '),
  );
  console.log(
    `  errores silenciosos: ${summary.silentErrors} · movimientos inventados: ${summary.falseMovements} · ` +
      `correos con movimiento sin leer: ${summary.missedMovements}` +
      (run.errors ? ` · llamadas fallidas: ${run.errors}` : ''),
  );
  const latency =
    run.latencies.length > 1
      ? `mediana ${formatMs(quantile(run.latencies, 0.5))}, p95 ${formatMs(quantile(run.latencies, 0.95))}`
      : formatMs(run.latencies[0] ?? 0);
  console.log(`  tiempo por correo: ${latency}`);
  console.log(
    `  costo: US$${(run.costPerMail * 1000).toFixed(2)} por cada 1.000 correos` +
      (run.tokens
        ? ` (${run.tokens.input.toFixed(0)} tokens de entrada y ${run.tokens.output.toFixed(0)} de salida por correo)`
        : ''),
  );
  if (summary.failures.length) console.log(`  fallos: ${summary.failures.map((failure) => failure.id).join(', ')}`);
}

if (args.llm) await runLlm(args.llm, args.effort);

console.log(`\nMovo · lector por reglas contra modelo de lenguaje · ${PARSER_EVAL_SET.length} correos con etiqueta`);
for (const run of [runParser(), ...loadSavedRuns()]) report(run);
console.log();
