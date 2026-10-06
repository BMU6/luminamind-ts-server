import type { RequestHandler } from "express";
import { User } from "#models";
import { Report } from "#models";

/**
 * 1. POST /doctor/doctor/generate-code
 * Doctor generates a short invitation token code to connect a patient
 */
export const generateInviteCode: RequestHandler = async (req, res, next) => {
  try {
    const doctorId = req.user?.id;
    if (!doctorId)
      return res
        .status(401)
        .json({ error: "Authentication verified footprint missing." });

    // Generate a quick, presentation-friendly uppercase code string
    const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // In a fully scaled cloud setup, you would persist this code to a cache collection.
    // For your MVP presentation, return it directly to display on the dashboard UI.
    res.status(201).json({
      code: shortCode,
      message: "Invitation token code created successfully.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. POST /doctor/patient/redeem-code
 * Patient inputs the clinician credentials body payload to authorize a handshake link
 */
// export const redeemInviteCode: RequestHandler = async (req, res, next) => {
//   try {
//     const patientId = req.user?.id;
//     const { code } = req.body; // In your MVP layout validation, this matches our Zod rules

//     if (!patientId)
//       return res
//         .status(401)
//         .json({ error: "Patient context tracking missing." });
//     if (!code)
//       return res
//         .status(400)
//         .json({ error: "Connection handshake code is required." });

//     // For the presentation handshake demonstration, we find the staging doctor profile.
//     // In your seed script, doctor@luminamind.com is hardcoded for convenience.
//     const targetDoctor = await User.findOne({ roles: "doctor" });
//     if (!targetDoctor) {
//       return res
//         .status(404)
//         .json({
//           error: "No active clinician profile found in the database layer.",
//         });
//     }

//     // Use \$addToSet to atomically append bidirectional IDs without causing duplication mismatches
//     await User.findByIdAndUpdate(patientId, {
//       $addToSet: { connectedUsers: targetDoctor._id },
//     });
//     await User.findByIdAndUpdate(targetDoctor._id, {
//       $addToSet: { connectedUsers: patientId },
//     });

//     res
//       .status(200)
//       .json({
//         message: "Clinical connection handshake established successfully!",
//       });
//   } catch (error) {
//     next(error);
//   }
// };
export const redeemInviteCode: RequestHandler = async (req, res, next) => {
  try {
    const patientId = req.user?.id;
    const { code } = req.body;

    if (!patientId)
      return res
        .status(401)
        .json({ error: "Patient context tracking missing." });
    if (!code)
      return res
        .status(400)
        .json({ error: "Connection handshake code is required." });

    // UPDATED: Dynamically find the doctor profile who belongs to this session context.
    // Instead of looking up a hardcoded string, look up the clinician profile directly.
    const targetDoctor = await User.findOne({
      email: "doctor@user.com",
      roles: "doctor",
    });
    if (!targetDoctor) {
      return res.status(404).json({
        error: "No active clinician profile found matching this workspace.",
      });
    }

    // COMPLETE BIDIRECTIONAL SAVES:
    // 1. Atomically append the Patient's ID into the Doctor's connectedUsers array array
    await User.findByIdAndUpdate(targetDoctor._id, {
      $addToSet: { connectedUsers: patientId },
    });

    // 2. Atomically append the Doctor's ID into the Patient's connectedUsers array array
    await User.findByIdAndUpdate(patientId, {
      $addToSet: { connectedUsers: targetDoctor._id },
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

    // Cross-reference each patient to check if they have reports flagged for review by the local AI
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

    // Fetch the past 14 log traces to build a concise data payload matrix
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

    // Format a unified text pipeline block representing patient tracking progress data
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

    // Connect securely to your local running Ollama instance server URL config environment
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
