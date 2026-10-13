// Crea en GitHub las etiquetas, los hitos y los issues descritos en un backlog en Markdown.
// Todo sale del archivo: etiquetas, hitos, issues y el usuario de GitHub de cada integrante
// (columna "GitHub" de la tabla de reparto). Quien no tenga usuario recibe sus issues sin asignar.
// Requiere la CLI `gh` autenticada. Se puede volver a ejecutar: no duplica lo que ya existe.
// Uso: npm run issues -- --dry-run          (muestra lo que haría, sin tocar GitHub)
//      npm run issues
//      npm run issues -- otro/BACKLOG.md    (por defecto lee docs/BACKLOG.md)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const BACKLOG = ARGS.find((arg) => !arg.startsWith('--')) ?? 'docs/BACKLOG.md';
const LABEL_COLOR = '5319e7';

// Formato del backlog.
const SECTION = /^## (Ya hecho \(cerrados\)|Pendiente) · (.+?) · \d+ pts$/;
const DONE_ROW = /^\| (\d+) \| (.+) \| (\d+) \| (.+) \| (.+) \|$/;
const HEADING = /^### (\d+)\. (.+) · (\d+) pts?$/;
const MEMBER = /^\| (.+?) \| @([\w-]+) \|/;

function gh(...args) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8' }).trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.error('No se encontró la CLI `gh`. Instálala (https://cli.github.com) y ejecuta `gh auth login`.');
    return process.exit(1);
  }
}

const inBackticks = (text) => [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
const matches = (lines, pattern) => lines.map((line) => line.match(pattern)).filter(Boolean);

/** Parte el archivo en bloques que empiezan en cada título `## `. */
function splitSections(lines) {
  const sections = [];
  for (const line of lines) {
    if (line.startsWith('## ')) sections.push([]);
    sections.at(-1)?.push(line);
  }
  return sections;
}

/** Issues de la tabla "Ya hecho": una fila por issue. */
function doneIssues(lines, owner) {
  return matches(lines, DONE_ROW).map(([, number, title, points, rowLabels, version]) => ({
    number: Number(number),
    title,
    points: Number(points),
    labels: inBackticks(rowLabels),
    owner,
    done: true,
    version,
  }));
}

/** Issues de una sección "Pendiente": título `###`, línea de etiquetas e hito, y el detalle. */
function pendingIssues(lines, owner) {
  const issues = [];
  let current = null;
  for (const line of lines) {
    const heading = line.match(HEADING);
    if (heading) {
      const [, number, title, points] = heading;
      current = { number: Number(number), title, points: Number(points), owner, body: [] };
      issues.push(current);
    } else if (line === '---') {
      current = null;
    } else if (current && !current.labels) {
      const [labelsPart, milestone] = line.split(' · Hito: ');
      current.labels = inBackticks(labelsPart);
      current.milestone = milestone;
    } else if (current) {
      current.body.push(line);
    }
  }
  return issues;
}

function sectionIssues(lines) {
  const section = lines[0].match(SECTION);
  if (!section) return [];
  const [, kind, owner] = section;
  return kind === 'Pendiente' ? pendingIssues(lines, owner) : doneIssues(lines, owner);
}

/** Lee el backlog y devuelve etiquetas, usuarios de GitHub e issues (ordenados por su número de referencia). */
function parseBacklog(markdown) {
  const lines = markdown.split(/\r?\n/);
  return {
    labels: inBackticks(lines.find((line) => line.startsWith('Etiquetas:')) ?? ''),
    users: Object.fromEntries(matches(lines, MEMBER).map(([, name, user]) => [name, user])),
    issues: splitSections(lines)
      .flatMap(sectionIssues)
      .sort((first, second) => first.number - second.number),
  };
}

function issueBody(issue) {
  const detail = issue.done
    ? `Trabajo ya entregado en la versión ${issue.version} (ver \`CHANGELOG.md\`).`
    : issue.body.join('\n').trim();
  return `${detail}\n\n---\nPuntos: ${issue.points} · Referencia en \`${BACKLOG}\`: ${issue.number}`;
}

function issueArgs(issue, user) {
  const args = ['issue', 'create', '--title', issue.title, '--body', issueBody(issue)];
  for (const label of issue.labels) args.push('--label', label);
  if (issue.milestone) args.push('--milestone', issue.milestone);
  if (user) args.push('--assignee', user);
  return args;
}

function createLabels(labels) {
  const existing = DRY_RUN
    ? []
    : JSON.parse(gh('label', 'list', '--limit', '200', '--json', 'name')).map((item) => item.name);
  for (const label of labels) {
    if (existing.includes(label)) continue;
    console.log(`etiqueta  ${label}`);
    if (!DRY_RUN) gh('label', 'create', label, '--color', LABEL_COLOR);
  }
}

function createMilestones(milestones) {
  const existing = DRY_RUN
    ? []
    : JSON.parse(gh('api', 'repos/{owner}/{repo}/milestones?state=all&per_page=100')).map((item) => item.title);
  for (const milestone of milestones) {
    if (existing.includes(milestone)) continue;
    console.log(`hito      ${milestone}`);
    if (!DRY_RUN) gh('api', 'repos/{owner}/{repo}/milestones', '-f', `title=${milestone}`);
  }
}

function createIssues(issues, users) {
  const existing = DRY_RUN
    ? []
    : JSON.parse(gh('issue', 'list', '--state', 'all', '--limit', '1000', '--json', 'title')).map((item) => item.title);
  for (const issue of issues) {
    if (existing.includes(issue.title)) {
      console.log(`ya existe ${issue.number}. ${issue.title}`);
      continue;
    }
    const user = users[issue.owner];
    console.log(
      `issue     ${issue.number}. ${issue.title} → ${user || 'sin asignar'}${issue.done ? ' (cerrado)' : ''}`,
    );
    if (DRY_RUN) continue;
    const url = gh(...issueArgs(issue, user));
    if (issue.done) gh('issue', 'close', url, '--reason', 'completed');
  }
}

function main() {
  const { labels, users, issues } = parseBacklog(readFileSync(BACKLOG, 'utf8'));
  const milestones = [...new Set(issues.map((issue) => issue.milestone).filter(Boolean))];
  const unassigned = [...new Set(issues.map((issue) => issue.owner))].filter((name) => !users[name]);

  if (DRY_RUN) console.log('Simulación: no se cambia nada en GitHub.\n');
  if (unassigned.length) console.warn(`Sin usuario de GitHub en la tabla de reparto: ${unassigned.join(', ')}.\n`);

  createLabels(labels);
  createMilestones(milestones);
  createIssues(issues, users);
  console.log(`\n${issues.length} issues, ${labels.length} etiquetas, ${milestones.length} hitos.`);
}

main();
