import { ToolLoopAgent, tool, isStepCount, type LanguageModel } from "ai";
import { z } from "zod";
import { MedicationList, Report } from "#models";
import { reportRangeSchema } from "#schemas";
import { model as defaultModel } from "./model.ts";

const INSTRUCTIONS = `You write a short, neutral summary of a psychiatric inpatient's self-reported check-ins.
The reader is the patient and the treating psychologist.

Data rules:
- All ratings are whole numbers from 0 to 5.
- Higher mood, energy, sleep and concentration are better. Higher irritability is WORSE (for irritability the best value is the lowest one).
- ALWAYS call get_reports first with the requested time range. Call get_medications only if you need details about a medication.
- get_reports returns ready-made statistics (first, last and average per rating), the best and the worst check-in as complete records, and the medication changes. Use these values as they are. Do not recalculate them and do not pick other check-ins as best or worst.
- Use the dates exactly as written in the data (for example "Sun 4 Oct, 17:03"). Never write ISO timestamps.
- Use only data returned by the tools. Never invent values, dates or medications.

What to write (about 120 to 200 words, plain English, short paragraphs, at most 4 bullet points):
1. How the ratings developed from the first to the last check-in, using the real dates and numbers.
2. The best and the hardest check-in (bestCheckIn and worstCheckIn), with the date and all of its ratings.
3. Patterns between ratings (for example poor sleep followed by higher irritability) and recurring themes in the notes.
4. Medication changes and what the ratings did before and after them. Say clearly that this is a correlation, not proof. If there are no changes in the period, say so in one sentence.
If there are fewer than 3 check-ins, say that the data is too limited for conclusions.

Never give a diagnosis, medical advice or dosage recommendations. Interpretation is up to the treating team.`;

// What the tools may know about the logged-in user. It is set by the SERVER from the token,
// the AI model can never choose or change it.
const toolContext = z.object({ userId: z.string() });

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

const INDICATORS = ["mood", "energy", "sleep", "concentration", "irritability"] as const;
type Indicator = (typeof INDICATORS)[number];

type Row = { date: Date } & Record<Indicator, number>;

// Small models write much better from finished facts than from raw rows, so the numbers are calculated here.
const statsFor = (rows: Row[], indicator: Indicator) => {
  const values = rows.map((r) => r[indicator]);
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;
  return {
    first: values[0],
    last: values[values.length - 1],
    average: Math.round(average * 10) / 10,
  };
};

// One number for "how well was the patient": 0 (worst) to 25 (best). Irritability counts reversed.
const wellbeing = (r: Row) => r.mood + r.energy + r.sleep + r.concentration + (5 - r.irritability);

// The best and the worst check-in as ONE complete record each (never a mix of different check-ins)
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

// Compares the medications of each check-in with the previous one
const medicationChanges = (rows: { date: Date; activeMedications: Snapshot }[]) => {
  const changes: string[] = [];
  const toMap = (list: Snapshot) => new Map(list.map((m) => [m.name, m.dosage]));
  let previous = toMap(rows[0]!.activeMedications);

  for (const row of rows.slice(1)) {
    const current = toMap(row.activeMedications);
    const when = formatTime(row.date);
    for (const [name, dosage] of current) {
      if (!previous.has(name)) changes.push(`${name} ${dosage} started (first seen ${when})`);
      else if (previous.get(name) !== dosage) changes.push(`${name} changed from ${previous.get(name)} to ${dosage} (${when})`);
    }
    for (const [name, dosage] of previous) {
      if (!current.has(name)) changes.push(`${name} ${dosage} stopped (last seen before ${when})`);
    }
    previous = current;
  }
  return changes;
};

const getReports = tool({
  description:
    "Get the check-ins of the logged-in patient in a time range, oldest first. " +
    "Each check-in has the ratings (0-5), a free-text note and the medications taken at that time.",
  inputSchema: z.object({
    from: z.string().describe("Start of the range, ISO 8601 date-time (included)"),
    to: z.string().describe("End of the range, ISO 8601 date-time (excluded)"),
  }),
  contextSchema: toolContext,
  execute: async (input, { context }) => {
    const range = reportRangeSchema.safeParse(input);
    // an error text is returned to the model, so it can correct itself and try again
    if (!range.success) return { error: range.error.issues.map((issue) => issue.message).join(", ") };

    const reports = await Report.find({
      userId: context.userId,
      date: { $gte: range.data.from, $lt: range.data.to },
    })
      .sort({ date: 1 })
      .lean();

    if (reports.length === 0) return { count: 0, note: "No check-ins in this time range." };

    const byWellbeing = [...reports].sort((x, y) => wellbeing(y) - wellbeing(x));

    return {
      count: reports.length,
      medicationsAtFirstCheckIn: reports[0]!.activeMedications.map((m) => `${m.name} ${m.dosage}`),
      medicationChanges: medicationChanges(reports),
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
  contextSchema: toolContext,
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
    // The userId comes from the token (set by the server). A new agent is created per request,
    // so the context belongs to exactly this user.
    toolsContext: {
      get_reports: { userId },
      get_medications: { userId },
    },
    stopWhen: isStepCount(6), // safety net: at most 6 model calls
    temperature: 0.2,
  });

  const { text } = await agent.generate({
    prompt: `Summarize the check-ins from ${from.toISOString()} (included) to ${to.toISOString()} (excluded).`,
  });

  return text;
};