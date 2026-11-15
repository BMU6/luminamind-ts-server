// Creates test medications and test reports (2 per day, last 21 days) for one user, so the app has data.
// The data tells a small story: a rough start, a medication change after 11 days, then a slow recovery.
// The note of every report matches its ratings, so the AI summary does not contradict itself.
// Run from the server folder:
//   node --env-file=.env.development.local --conditions development src/scripts/seedReports.ts you@example.com
// Add --replace to delete the existing reports of this user first (otherwise the new ones are added):
//   node --env-file=.env.development.local --conditions development src/scripts/seedReports.ts you@example.com --replace
import "#db";
import mongoose from "mongoose";
import { MedicationList, Report, User } from "#models";

const email = process.argv[2];
const replace = process.argv.includes("--replace");
if (!email) {
  console.error("Usage: seedReports.ts <email of an existing user> [--replace]");
  process.exit(1);
}

const user = await User.findOne({ email: email.toLowerCase() });
if (!user) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}

// Medications: reuse the ones the user already has, otherwise create two
let medications = await MedicationList.find({ userId: user._id });
if (medications.length === 0) {
  medications = await MedicationList.insertMany([
    {
      userId: user._id,
      name: "Sertraline",
      dosage: "50 mg",
      schedule: { morning: true, noon: false, evening: false, night: false },
      effect: "Mood stabilising",
    },
    {
      userId: user._id,
      name: "Quetiapine",
      dosage: "25 mg",
      schedule: { morning: false, noon: false, evening: false, night: true },
      effect: "Helps with sleep",
    },
  ]);
  console.log(`Created ${medications.length} medications`);
}

const DAYS = 21;
const MED_CHANGE_DAY = 10; // the second medication is taken from this many days ago until today

// The second medication is only taken in the last days, so the chart shows a "before and after"
const snapshot = (day: number) =>
  medications
    .filter((_, i) => i === 0 || day <= MED_CHANGE_DAY)
    .map((m) => ({ medicationId: m._id, name: m.name, dosage: m.dosage }));

// Small seeded random generator: the same data every run, so screenshots stay reproducible
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const random = seeded(42);
const noise = (amount: number) => (random() * 2 - 1) * amount;
const clamp = (x: number) => Math.min(5, Math.max(0, Math.round(x)));

// Notes by overall state (low / medium / high), one set for the morning and one for the evening
const NOTES = {
  morning: {
    low: [
      "Slept badly, woke up several times. Feeling tense and easily annoyed.",
      "Barely slept. Hard to get out of bed and everything feels heavy.",
      "Restless night, kept thinking in circles. Very tired this morning.",
    ],
    medium: [
      "Calmer than yesterday. Slow start, but the day looks manageable.",
      "Okay night. Still tired, but I managed breakfast and a short walk.",
      "Woke up rested enough. Mood is mixed, concentration comes and goes.",
    ],
    high: [
      "Good night of sleep. More energy than in the last days.",
      "Slept through, woke up calm and clear-headed.",
      "Rested and in a good mood. Looking forward to the day.",
    ],
  },
  evening: {
    low: [
      "Difficult afternoon. Could not concentrate in the group session and got irritated easily.",
      "Low mood all day, withdrew to my room in the evening.",
      "Tense and exhausted. Hard to follow conversations.",
    ],
    medium: [
      "Tired in the afternoon, but the evening walk helped.",
      "A fairly normal day. Some good moments, some restlessness.",
      "Better focus in therapy today, but low energy afterwards.",
    ],
    high: [
      "Good day. Took part in the group session and felt calm afterwards.",
      "Feeling stable and fairly clear-headed. Enjoyed the walk outside.",
      "Productive day, good conversation with the doctor, relaxed evening.",
    ],
  },
};

const reports = [];
for (let day = DAYS; day >= 0; day--) {
  const progress = (DAYS - day) / DAYS; // 0 = first day, 1 = today
  const onSecondMed = day <= MED_CHANGE_DAY;

  for (const hour of [8, 20]) {
    const at = new Date();
    at.setDate(at.getDate() - day);
    at.setHours(hour, 0, 0, 0);
    if (at > new Date()) continue;

    const morning = hour === 8;
    // Evenings are a little worse than mornings (tiredness after the day)
    const dip = morning ? 0 : -0.4;

    const mood = clamp(1.4 + 2.6 * progress + dip + noise(0.7));
    const energy = clamp(1.3 + 2.2 * progress + dip + noise(0.7));
    const concentration = clamp(1.3 + 2.4 * progress + dip + noise(0.7));
    const irritability = clamp(4.0 - 2.4 * progress - dip + noise(0.7));
    // Sleep improves clearly once the second medication starts
    const sleep = clamp((onSecondMed ? 3.4 + 0.8 * progress : 1.3 + 0.8 * progress) + noise(0.6));

    const state = (mood + energy + sleep + concentration + (5 - irritability)) / 5;
    const level = state < 2.2 ? "low" : state < 3.4 ? "medium" : "high";
    const notes = NOTES[morning ? "morning" : "evening"][level];

    reports.push({
      userId: user._id,
      date: at,
      message: notes[Math.floor(random() * notes.length)],
      activeMedications: snapshot(day),
      mood,
      energy,
      sleep,
      concentration,
      irritability,
    });
  }
}

if (replace) {
  const deleted = await Report.deleteMany({ userId: user._id });
  console.log(`Deleted ${deleted.deletedCount} existing reports`);
}
await Report.insertMany(reports);
console.log(`Created ${reports.length} reports for ${email}`);
await mongoose.disconnect();
