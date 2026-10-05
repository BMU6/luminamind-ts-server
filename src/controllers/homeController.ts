import type { RequestHandler } from "express";
import type { Types } from "mongoose";
import { Report } from "#models";
import { reportRangeSchema } from "#schemas";
import { summarizeReports } from "../ai/summaryAgent.ts";

// What the client gets back. The medication snapshot is stored inside the report, so no populate is needed.
type HomeReportDTO = {
  _id: Types.ObjectId;
  date: Date;
  message: string;
  mood: number;
  concentration: number;
  irritability: number;
  energy: number;
  sleep: number;
  activeMedications: { medicationId: Types.ObjectId; name: string; dosage: string }[];
};

// GET /home?from=...&to=...  -> the reports of the logged-in user in that time range
export const getHomeReports: RequestHandler<unknown, HomeReportDTO[]> = async (req, res) => {
  // accessHandler has already run, so req.user exists. The check is for TypeScript.
  const userId = req.user?.id;
  if (!userId) throw new Error("Authentication required.", { cause: { status: 401 } });

  const { data, error, success } = reportRangeSchema.safeParse(req.query);
  if (!success) {
    throw new Error(error.issues.map((issue) => issue.message).join(", "), { cause: { status: 400 } });
  }
  const { from, to } = data;

  const reports = await Report.find({ userId, date: { $gte: from, $lt: to } })
    .sort({ date: 1 })
    .select("date message mood concentration irritability energy sleep activeMedications")
    .lean<HomeReportDTO[]>();

  res.json(reports);
};

// POST /home/summary  { from, to }  -> AI summary of the check-ins of the logged-in user in that range
export const summarizeHomeReports: RequestHandler<unknown, { summary: string }> = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new Error("Authentication required.", { cause: { status: 401 } });

  const { data, error, success } = reportRangeSchema.safeParse(req.body);
  if (!success) {
    throw new Error(error.issues.map((issue) => issue.message).join(", "), { cause: { status: 400 } });
  }

  try {
    const summary = await summarizeReports(userId, data.from, data.to);
    res.json({ summary });
  } catch (error) {
    console.error("AI summary failed:", error);
    throw new Error("The AI service is not available. Is Ollama running?", { cause: { status: 503 } });
  }
};
