import { ToolLoopAgent, tool, isStepCount, type LanguageModel } from "ai";
import { z } from "zod";
import { MedicationList, Report } from "#models";
import { model as defaultModel } from "./model.ts";

const INSTRUCTIONS = `You write a short, neutral summary of a psychiatric inpatient's self-reported reports.
The reader is the patient and the treating psychologist.

Data rules:
- All ratings are whole numbers from 0 to 5.
- Higher mood, energy, sleep and concentration are better. Higher irritability is WORSE (for irritability the best value is the lowest one).
- ALWAYS call get_reports first. It already knows the time range, you do not need to give any arguments.
- get_reports returns ready-made statistics (first, last and average per rating), the best and the worst report as complete records, and the medication changes with their ready-made before/after verdicts. Copy these values and verdicts as they are. Do not recalculate anything and do not pick other reports as best or worst.
- Use the dates exactly as written in the data (for example "Sun 4 Oct, 17:03"). Never write ISO timestamps.
- Use only data returned by the tools. Never invent values, dates, medications, patterns or reasons.

How to write:
- Plain text only. No markdown: no asterisks, no hashes, no bold, no headings, no bullet points.
- Start directly with the facts. No introduction like "Here is a summary" and no closing remark.
- Exactly three short paragraphs, together 100 to 150 words, plain English.

Paragraph 1: How the ratings developed from the first to the last report (first, last and average, with the real numbers).
Paragraph 2: The best and the hardest report (bestCheckIn and worstCheckIn): date and all of its ratings.
Paragraph 3: Medication. For every entry of medicationEffects say what was started or changed, when, the expectedEffect if there is one, and the ready-made verdict about the ratings. Say once that this shows a correlation, not proof. If there are no medication changes in the period, write "No medication changes in this period."

Do not write about patterns between ratings, weekdays or times of day. Mention a theme from the notes only if the same theme clearly appears in at least 3 notes, otherwise do not mention the notes at all.
If there are fewer than 3 reports, say that the data is too limited for conclusions.

Never give a diagnosis, medical advice or dosage recommendations. Interpretation is up to the treating team.`;

// What the tools may know. It is set by the SERVER (token and request), the AI model can never choose or change it.
const toolContext = z.object({ userId: z.string(), from: z.date(), to: z.date() });
const userContext = z.object({ userId: z.string() });

// Times are shown to the model in the hospital's local time, in a short readable form
const TIME_ZONE = "Europe/Berlin";
const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/,? (\d{2}:\d{2})$/, ", $1");

// A calendar day in the hospital's local time, e.g. "Sun 1 Nov"
const formatDay = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" }).format(date);

const INDICATORS = ["mood", "energy", "sleep", "concentration", "irritability"] as const;
type Indicator = (typeof INDICATORS)[number];

type Row = { date: Date } & Record<Indicator, number>;

const round1 = (n: number) => Math.round(n * 10) / 10;
const averageOf = (rows: Row[], indicator: Indicator) => round1(rows.reduce((sum, r) => sum + r[indicator], 0) / rows.length);

// Small models write much better from finished facts than from raw rows, so the numbers are calculated here.
const statsFor = (rows: Row[], indicator: Indicator) => ({
  first: rows[0]![indicator],
  last: rows[rows.length - 1]![indicator],
  average: averageOf(rows, indicator),
});

// One number for "how well was the patient": 0 (worst) to 25 (best). Irritability counts reversed.
const wellbeing = (r: Row) => r.mood + r.energy + r.sleep + r.concentration + (5 - r.irritability);

// The best and the worst reports as ONE complete record each (never a mix of different reports)
const describe = (r: Row & { message: string }) => ({
  when: formatTime(r.date),
  mood: r.mood,
  energy: r.energy,
  sleep: r.sleep,
  concentration: r.concentration,
  irritability: r.irritability,
  note: r.message,
});

type Snapshot = { name: string; dosage: string }[];
type MedicationChange = { text: string; index: number; name: string };

// Compares the medications of each report with the previous one. 'index' is the first report with the new state.
export const medicationChanges = (rows: { date: Date; activeMedications: Snapshot }[]): MedicationChange[] => {
  const changes: MedicationChange[] = [];
  const toMap = (list: Snapshot) => new Map(list.map((m) => [m.name, m.dosage]));
  let previous = toMap(rows[0]!.activeMedications);

  rows.forEach((row, index) => {
    if (index === 0) return;
    const current = toMap(row.activeMedications);
    const when = formatTime(row.date);
    for (const [name, dosage] of current) {
      if (!previous.has(name)) changes.push({ name, index, text: `${name} ${dosage} started (first seen ${when})` });
      else if (previous.get(name) !== dosage)
        changes.push({ name, index, text: `${name} changed from ${previous.get(name)} to ${dosage} (${when})` });
    }
    for (const [name, dosage] of previous) {
      if (!current.has(name)) changes.push({ name, index, text: `${name} ${dosage} stopped (last seen before ${when})` });
    }
    previous = current;
  });
  return changes;
};

// How many reports before and after a change are compared
const EFFECT_WINDOW = 6;
// An average must move by at least this much (on the 0-5 scale) to count as "clearly" better or worse
const CLEAR_DIFFERENCE = 1;

// What happened to the ratings around a medication change: finished verdicts, so the model does not have to judge numbers.
export const effectAround = (rows: Row[], index: number) => {
  const before = rows.slice(Math.max(0, index - EFFECT_WINDOW), index);
  const after = rows.slice(index, index + EFFECT_WINDOW);
  if (before.length < 2 || after.length < 2) {
    return { reportsBefore: before.length, reportsAfter: after.length, verdict: "Too few reports before or after the change to compare." };
  }
  const verdicts = INDICATORS.map((indicator) => {
    const was = averageOf(before, indicator);
    const now = averageOf(after, indicator);
    // for irritability a lower value is better
    const better = indicator === "irritability" ? was - now : now - was;
    const word = better >= CLEAR_DIFFERENCE ? "clearly better" : better <= -CLEAR_DIFFERENCE ? "clearly worse" : "about the same";
    return `${indicator}: ${word} (average ${was} before, ${now} after)`;
  });
  return { reportsBefore: before.length, reportsAfter: after.length, verdict: verdicts.join("; ") };
};

// The model sometimes ignores "plain text only". This removes the markdown and an introduction line that slipped through.
export const toPlainText = (text: string): string =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/^\s*(here is|here's|sure|certainly|okay|of course)[^\n]*\n+/i, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[*•]\s+/gm, "- ")
    .replace(/(\*\*|__|`)/g, "")
    .replace(/(?<![\w*])\*(?=\S)([^*\n]+?)\*(?![\w*])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const getReports = tool({
  description:
    "Get the reports of the logged-in patient for the requested time range, oldest first, with ready-made statistics, " +
    "the best and the worst report, and the medication changes with their before/after verdicts. Needs no arguments.",
  inputSchema: z.object({}),
  contextSchema: toolContext,
  execute: async (_input, { context }) => {
    const reports = await Report.find({
      userId: context.userId,
      date: { $gte: context.from, $lt: context.to },
    })
      .sort({ date: 1 })
      .lean();

    if (reports.length === 0) return { count: 0, note: "No reports in this time range." };

    const byWellbeing = [...reports].sort((x, y) => wellbeing(y) - wellbeing(x));
    const changes = medicationChanges(reports);

    // the expected effect the patient or doctor wrote down for the changed medications
    const names = [...new Set(changes.map((c) => c.name))];
    const listed = names.length > 0 ? await MedicationList.find({ userId: context.userId }).lean() : [];
    const expectedEffect = (name: string) => listed.find((m) => m.name === name)?.effect || undefined;

    return {
      count: reports.length,
      medicationsAtFirstCheckIn: reports[0]!.activeMedications.map((m) => `${m.name} ${m.dosage}`),
      medicationEffects: changes.map((c) => ({
        change: c.text,
        expectedEffect: expectedEffect(c.name),
        ...effectAround(reports, c.index),
      })),
      stats: Object.fromEntries(INDICATORS.map((i) => [i, statsFor(reports, i)])),
      bestCheckIn: describe(byWellbeing[0]!),
      worstCheckIn: describe(byWellbeing[byWellbeing.length - 1]!),
      checkIns: reports.map(describe),
    };
  },
});

const getMedications = tool({
  description: "Get the current medication list of the logged-in patient (name, dosage, schedule, expected effect).",
  inputSchema: z.object({}),
  contextSchema: userContext,
  execute: async (_input, { context }) => {
    const medications = await MedicationList.find({ userId: context.userId }).lean();
    return medications.map((m) => ({
      name: m.name,
      dosage: m.dosage,
      schedule: m.schedule,
      effect: m.effect,
    }));
  },
});

// The model is a parameter only so a test can pass a fake one. The app uses the default.
// 'from' is included, 'to' is excluded (so the last day of the range is the day before 'to').
export const summarizeReports = async (
  userId: string,
  from: Date,
  to: Date,
  model: LanguageModel = defaultModel,
): Promise<string> => {
  const agent = new ToolLoopAgent({
    model,
    instructions: INSTRUCTIONS,
    tools: { get_reports: getReports, get_medications: getMedications },
    // userId and time range are set by the server. A new agent is created per request,
    // so the context belongs to exactly this user and this range.
    toolsContext: {
      get_reports: { userId, from, to },
      get_medications: { userId },
    },
    stopWhen: isStepCount(6), // safety net: at most 6 model calls
    temperature: 0.2,
  });

  // Local calendar days, not UTC timestamps: the client sends local midnight as UTC (31 Oct 23:00Z = 1 Nov in Berlin)
  const lastDay = new Date(to.getTime() - 1);
  const { text } = await agent.generate({
    prompt: `Summarize the reports from ${formatDay(from)} to ${formatDay(lastDay)} (both days included).`,
  });

  return toPlainText(text);
};
