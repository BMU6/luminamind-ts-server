// Creates test medications and test reports (2 per day, last 21 days) for one user, so the app has data.
// Run from the server folder:
//   node --env-file=.env.development.local --conditions development src/scripts/seedReports.ts you@example.com
import "#db";
import mongoose from "mongoose";
import { MedicationList, Report, User } from "#models";

const email = process.argv[2];
if (!email) {
  console.error("Usage: seedReports.ts <email of an existing user>");
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

// The second medication is only taken in the last 10 days, so the chart shows a "before and after"
const snapshot = (day: number) =>
  medications
    .filter((_, i) => i === 0 || day <= 10)
    .map((m) => ({ medicationId: m._id, name: m.name, dosage: m.dosage }));

const TEXTS = [
  "Slept badly, woke up several times. Feeling tense and easily annoyed.",
  "A bit better rested. Still hard to concentrate during the group session.",
  "Calm morning. Took a short walk before breakfast, which helped.",
  "Good night of sleep. More energy than in the last days.",
  "Feeling stable and fairly clear-headed.",
  "Tired in the afternoon, but the evening walk helped a lot.",
];

const rate = (n: number, phase: number) =>
  Math.min(5, Math.max(0, Math.round(2.5 + 2 * Math.sin(n * 0.6 + phase))));

const DAYS = 21;
const reports = [];
for (let day = DAYS; day >= 0; day--) {
  for (const hour of [8, 20]) {
    const at = new Date();
    at.setDate(at.getDate() - day);
    at.setHours(hour, 0, 0, 0);
    if (at > new Date()) continue;

    const n = day * 2 + (hour === 8 ? 0 : 1);
    reports.push({
      userId: user._id,
      date: at,
      message: TEXTS[n % TEXTS.length],
      activeMedications: snapshot(day),
      mood: rate(n, 0),
      energy: rate(n, 1),
      sleep: rate(n, 2),
      concentration: rate(n, 3),
      irritability: rate(n, 4),
    });
  }
}

await Report.insertMany(reports);
console.log(`Created ${reports.length} reports for ${email}`);
await mongoose.disconnect();
