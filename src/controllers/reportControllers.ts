import type { RequestHandler } from "express";
import { reportInputSchema } from "#schemas";
import { Report } from "#models";
import { z } from "zod";
// import Report from "../models/Report";
// import { reportInputSchema } from "../schemas/reportSchema";
// type ReportInputDTO = z.infer<typeof reportInputSchema>;
// type ReportOutputDTO = ReportInputDTO & {
//   _id: InstanceType<typeof Types.ObjectId>;
//   createdAt: Date;
//   updatedAt: Date;
// };
// type IDParams = {
//   id: string;
// };

// export const getMedications: RequestHandler<
//   unknown,
//   ReportOutputDTO[] | { error: string }
// > = async (req, res) => {
//   try {
//     const { userId } = req.query;

//     const filter = typeof userId === "string" ? { userId } : {};
//     const reports = await Report.find(filter);
//     res.json(reports as ReportOutputDTO[]);
//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       res.status(500).json({ error: error.message });
//     } else {
//       res.status(500).json({ error: "An unknown error occurred" });
//     }
//   }
// };

// export const createMedication: RequestHandler<
//   unknown,
//   ReportOutputDTO | { error: string },
//   ReportInputDTO
// > = async (req, res) => {
//   try {
//     const newUser = await Report.create(
//       req.body satisfies ReportInputDTO,
//     );
//     //const newUser = await User.create<MedicationInputDTO>(req.body);

//     res.status(201).json(newUser as ReportOutputDTO);
//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       res.status(500).json({ error: error.message });
//     } else {
//       res.status(500).json({ error: "An unknown error occurred" });
//     }
//   }
// };

// // export const getMedicationsByUserId: RequestHandler<
// //   unknown,
// //   MedicationOutputDTO[] | { error: string }
// // > = async (req, res, next) => {
// //   try {
// //     const { userId } = req.query;

// //     const filter = typeof userId === "string" ? { userId } : {};

// //     const medications = await MedicationList.find(filter).lean();

// //     const formattedMedications: MedicationOutputDTO[] = (medications as any[]).map(
// //       (medicine) => ({
// //         _id: medicine._id,
// //         name: medicine.name,
// //         dosage: medicine.dosage,
// //         effect: medicine.effect,
// //         schedule: medicine.schedule,
// //         userId: medicine.userId ? medicine.userId.toString() : "",
// //         createdAt: medicine.createdAt,
// //         updatedAt: medicine.updatedAt,
// //       }),
// //     );

// //     return res.json(formattedMedications);
// //   } catch (error) {
// //     next(error);
// //   }
// // };

// export const updateMedication: RequestHandler<
//   IDParams,
//   ReportOutputDTO | { error: string },
//   ReportInputDTO
// > = async (req, res) => {
//   try {
//     const {
//       body,
//       params: { id },
//     } = req;
//     const { userId, mood, concentration, energy, sleep, irritability, activeMedications, message } = body;
//     if (!userId || !mood || !concentration || !energy|| !sleep || !irritability || !activeMedications)
//       return res
//         .status(400)
//         .json({ error: "every fields are required" });
//     const report = await Report.findById(id);
//     if (!report)
//       return res.status(404).json({ error: "Report not found" });
//     report.userId = userId;
//     report.mood = mood;
//     report.concentration = concentration;
//     report.sleep = sleep;
//     report.energy = energy;
//     report.activeMedications = activeMedications;
//     report.message = message;
//     await report.save();

//     res.json(report as ReportOutputDTO);
//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       res.status(500).json({ error: error.message });
//     } else {
//       res.status(500).json({ error: "An unknown error occurred" });
//     }
//   }
// };

// export const deleteMedication: RequestHandler<
//   IDParams,
//   { message: string } | { error: string }
// > = async (req, res) => {
//   try {
//     const {
//       params: { id },
//     } = req;
//     const medication = await Report.findByIdAndDelete(id);
//     if (!medication)
//       return res.status(404).json({ error: "Medication not found" });
//     res.json({ message: "Medication deleted successfully" });
//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       res.status(500).json({ error: error.message });
//     } else {
//       res.status(500).json({ error: "An unknown error occurred" });
//     }
//   }
// };

// Types for request params and query parameters to ensure full safety
type IDParams = { id: string };
type ReportQuery = { userId?: string };

/**
 * 1. GET ALL REPORTS
 * Route: GET /report?userId=...
 * Description: Fetches all historical reports filtered by the active user ID, sorted newest first.
 */
export const getReports: RequestHandler<
  unknown,
  any[] | { error: string },
  unknown,
  ReportQuery
> = async (req, res) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res
        .status(400)
        .json({ error: "User ID query parameter is required." });
    }

    // Enforce matching string filter constraints on the Mongoose lookup query
    const historicalReports = await Report.find({ userId })
      .sort({ date: -1 }) // Sort from newest to oldest day tracking log
      .lean();

    // Map through unknown to safely resolve any heavy Mongoose prototype type assertions
    res.status(200).json(historicalReports as unknown as any[]);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "An unknown database error occurred." });
    }
  }
};

/**
 * 2. CREATE NEW REPORT
 * Route: POST /report
 * Description: Validates incoming slider/text metrics and commits a new daily report snapshot to MongoDB.
 */

/**
 * CREATE NEW REPORT (POST)
 * Route: POST /reports
 * Description: Intercepts the user payload, runs Zod metrics verification,
 *              and commits a new clinical document to the collection.
 */
export const createReport: RequestHandler<
  unknown,
  any | { error: string; details?: any }
> = async (req, res) => {
  try {
    // 1. Validate the incoming data payload directly against your Zod rules
    const validatedData = reportInputSchema.parse(req.body);

    // 2. Instantiate and compile a new Mongoose document matching the model parameters
    const newReport = new Report({
      userId: validatedData.userId,
      mood: validatedData.mood,
      concentration: validatedData.concentration,
      irritability: validatedData.irritability,
      energy: validatedData.energy,
      sleep: validatedData.sleep,
      message: validatedData.message,
      activeMedications: validatedData.activeMedications, // Captures background snapshot array
    });

    // 3. Atomically persist the document straight into the MongoDB reports collection
    const savedReport = await newReport.save();

    // 4. Return the successfully created document along with a 211 Status
    res.status(201).json(savedReport);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      // Catches slider hacking attempts or validation failures
      return res.status(400).json({
        error:
          "Validation failure. Clinical metric values must strictly range between 0 and 5.",
      });
    }

    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({
        error:
          "Could not create the progress report document inside database index layers.",
      });
    }
  }
};

export const getReportById: RequestHandler<IDParams> = async (req, res) => {
  try {
    const { id } = req.params; // Correctly pulls from the /:id param we mapped above

    const targetReport = await Report.findById(id).lean();

    if (!targetReport) {
      return res
        .status(404)
        .json({ error: "Report log document not found in storage indices." });
    }

    res.status(200).json(targetReport);
  } catch (error: unknown) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : "Database fetch error",
      });
  }
};
/**
 * 3. UPDATE EXISTING REPORT
 * Route: PUT /report/:id
 * Description: Edits a report entry using a partial modification envelope wrapper.
 */
// export const updateReport: RequestHandler<
//   IDParams,
//   any | { error: string; details?: any }
// > = async (req, res) => {
//   try {
//     const { id } = req.params;

//     // Use a partial variation of your schema so empty values handle safely on modification updates
//     const reportUpdateSchema = reportInputSchema.partial();
//     const validatedData = reportUpdateSchema.parse(req.body);

//     const updatedReport = await Report.findByIdAndUpdate(id, validatedData, {
//       new: true, // Returns the newly modified row snapshot asset
//       runValidators: true,
//     }).lean();

//     if (!updatedReport) {
//       return res.status(404).json({
//         error: "The requested tracking log entry document was not found.",
//       });
//     }

//     res.status(200).json(updatedReport);
//   } catch (error: unknown) {
//     if (error instanceof z.ZodError) {
//       return res.status(400).json({ error: "Validation failure." });
//     }

//     if (error instanceof Error) {
//       res.status(500).json({ error: error.message });
//     } else {
//       res
//         .status(500)
//         .json({ error: "Failed updating database document reference." });
//     }
//   }
// };

/**
 * 3. UPDATE EXISTING REPORT
 * Route: PUT /report/:id
 */
export const updateReport: RequestHandler<
  IDParams,
  any | { error: string; details?: any }
> = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. CRUCIAL: The data is ALREADY completely validated and structured
    // by your `validateBody(reportUpdateSchema)` middleware right at the route gate!
    const validatedData = req.body;

    // 2. Use Mongoose \$set to cleanly override the modified metrics array parameters
    const updatedReport = await Report.findByIdAndUpdate(
      id,
      { $set: validatedData }, // Safely patches only the keys sent by the frontend
      {
        new: true, // Returns the fresh updated document array state
        runValidators: true,
      },
    ).lean();

    if (!updatedReport) {
      return res.status(404).json({
        error: "The requested tracking log entry document was not found.",
      });
    }

    // 3. Return the clean updated database object to sync frontend state arrays
    res.status(200).json(updatedReport);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res
        .status(500)
        .json({ error: "Failed updating database document reference." });
    }
  }
};

/**
 * 4. DELETE REPORT
 * Route: DELETE /report/:id
 * Description: Permanently drops a report entry out of the live ecosystem document stream.
 */
export const deleteReport: RequestHandler<
  IDParams,
  { message: string } | { error: string }
> = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedReport = await Report.findByIdAndDelete(id);

    if (!deletedReport) {
      return res.status(404).json({
        error: "The targeted index tracking document could not be found.",
      });
    }

    res.status(200).json({
      message:
        "Daily progress record row dropped successfully out of storage index bounds.",
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res
        .status(500)
        .json({ error: "Failed deleting index row reference target entry." });
    }
  }
};
