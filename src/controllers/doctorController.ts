import type { RequestHandler } from "express";
import { User, Report } from "#models";

/**
 * 1. POST /doctor/doctor/generate-code
 * Doctor generates a short invitation token code and saves it to their profile document
 */
export const generateInviteCode: RequestHandler = async (req, res, next) => {
  try {
    const doctorId = req.user?.id;
    if (!doctorId) {
      return res
        .status(401)
        .json({ error: "Authentication verified footprint missing." });
    }

    // Generate a quick, presentation-friendly uppercase code string
    const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Persist the active generated token code dynamically directly onto this doctor's profile document record
    const updatedDoctor = await User.findByIdAndUpdate(
      doctorId,
      { inviteCode: shortCode },
      { new: true },
    );

    if (!updatedDoctor) {
      return res
        .status(404)
        .json({ error: "Doctor identity profile not found." });
    }

    res.status(201).json({
      code: shortCode,
      message:
        "Invitation token code created successfully and bound to session.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. POST /doctor/patient/redeem-code
 * Patient inputs the 6-character token; system finds the doctor dynamically matching that code
 */
export const redeemInviteCode: RequestHandler = async (req, res, next) => {
  try {
    const patientId = req.user?.id;
    const { code } = req.body;

    if (!patientId) {
      return res
        .status(401)
        .json({ error: "Patient context tracking missing." });
    }
    if (!code) {
      return res
        .status(400)
        .json({ error: "Connection handshake code is required." });
    }

    const cleanCode = code.toUpperCase().trim();

    // FIXED: Dynamically find the doctor profile who owns this specific code.
    // No hardcoded emails or strings are used here anymore.
    const targetDoctor = await User.findOne({
      inviteCode: cleanCode,
      roles: "doctor",
    });

    if (!targetDoctor) {
      return res.status(404).json({
        error:
          "Invalid or expired connection code token. Please request a new token code from your doctor.",
      });
    }

    // COMPLETE SECURE BIDIRECTIONAL HANDSHAKE LINK SAVES:
    // 1. Atomically append the Patient's ID into the Doctor's connectedUsers array
    await User.findByIdAndUpdate(targetDoctor._id, {
      $addToSet: { connectedUsers: patientId },
    });

    // 2. Atomically append the Doctor's ID into the Patient's connectedUsers array
    await User.findByIdAndUpdate(patientId, {
      $addToSet: { connectedUsers: targetDoctor._id },
    });

    // Consume/clear the token code directly out of the doctor's document to complete the lifecycle
    await User.findByIdAndUpdate(targetDoctor._id, {
      $set: { inviteCode: null },
    });

    res.status(200).json({
      message: "Secure clinical connection handshake completed successfully!",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. GET /doctor/doctor/patients
 * Clinician pulls their connected patient list and flags users with active AI alert tags
 */
export const getMyConnectedPatients: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const doctorId = req.user?.id;
    if (!doctorId)
      return res.status(401).json({ error: "Authentication required." });

    const doctorProfile = await User.findById(doctorId).populate(
      "connectedUsers",
      "email roles",
    );
    if (!doctorProfile)
      return res
        .status(404)
        .json({ error: "Doctor identity profile not found." });

    const patientListWithAlerts = await Promise.all(
      (doctorProfile.connectedUsers as any[]).map(async (patient) => {
        const structuralAlertCheck = await Report.findOne({
          userId: patient._id,
          "aiAnalysis.isFlaggedForReview": true,
        }).lean();

        return {
          id: patient._id,
          email: patient.email,
          needsUrgentReview: !!structuralAlertCheck,
        };
      }),
    );

    res.status(200).json(patientListWithAlerts);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. GET /doctor/doctor/patient-summary/:patientId
 * Uses local Llama 3.1:8b to create an on-demand chronological briefing summary of patient history
 */
export const getPatientHistoricalSummary: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const { patientId } = req.params;

    const pastReports = await Report.find({ userId: patientId })
      .sort({ date: -1 })
      .limit(14)
      .lean();

    if (!pastReports || pastReports.length === 0) {
      return res.status(200).json({
        brief:
          "No historical log tracks available yet for context analysis compilation.",
      });
    }

    const analyticsTextPipeline = pastReports
      .map(
        (log) =>
          `Date: ${new Date(log.date).toISOString().split("T")[0]} | ` +
          `Mood: ${log.mood}/5, Sleep: ${log.sleep}/5, Energy: ${log.energy}/5 | ` +
          `Side-effects: ${log.aiAnalysis?.extractedSideEffects?.join(", ") || "None"} | ` +
          `Notes: "${log.message || "No text note provided"}"`,
      )
      .join("\n");

    const systemPrompt =
      "You are an expert clinical psychiatric medical writing assistant. " +
      "Analyze the historical sequence of tracking indicators for this patient. " +
      "Provide a highly professional 3-sentence summary highlighting the trajectory of their mood, " +
      "any patterns of worsening medication side effects, and actionable items for their next check-in. " +
      "Be objective, direct, and concise. Respond ONLY with the text summary.";

    const aiTargetResponse = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.1:8b",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Patient History Logs:\n${analyticsTextPipeline}`,
          },
        ],
        options: { temperature: 0.2 },
        stream: false,
      }),
    });

    if (!aiTargetResponse.ok) {
      throw new Error(
        "Local Ollama connection failure down processing array grids.",
      );
    }

    const compiledData = await aiTargetResponse.json();
    const cleanBriefSummary =
      compiledData.message?.content?.trim() ||
      "Could not construct historical clinical analysis brief.";

    res.status(200).json({ brief: cleanBriefSummary });
  } catch (error) {
    next(error);
  }
};
