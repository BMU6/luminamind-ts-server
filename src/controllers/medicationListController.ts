import type { RequestHandler } from "express";
import { medicationInputSchema } from "#schemas";
import { z } from "zod";
import type { Types } from "mongoose";
import { MedicationList } from "#models";
import {
  getConnectedIds,
  isConnectedTo,
  isValidId,
} from "../utils/connections.ts";

type MedicationInputDTO = z.infer<typeof medicationInputSchema>;
type MedicationOutputDTO = MedicationInputDTO & {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
type IDParams = {
  id: string;
};

export const getMedications: RequestHandler<
  unknown,
  MedicationOutputDTO[] | { error: string },
  unknown,
  { patientId?: string } // Added typing signature to intercept optional query strings
> = async (req, res) => {
  try {
    // Determine the user role context
    const isDoctor = req.user?.roles?.includes("doctor");

    // UPDATED FILTER STRATEGY:
    // If a clinician is requesting data, filter using the incoming patientId query parameter.
    // If a patient is requesting data, fall back strictly to their authenticated account token ID context.
    let targetUserId = req.user!.id;
    if (isDoctor && req.query.patientId) {
      const { patientId } = req.query;
      if (!isValidId(patientId)) {
        return res.status(400).json({ error: "Invalid patient id." });
      }
      // a doctor may only read the medications of connected patients
      if (!(await isConnectedTo(req.user!.id, patientId))) {
        return res
          .status(403)
          .json({ error: "This patient is not connected to you." });
      }
      targetUserId = patientId;
    }

    const filter = { userId: targetUserId };
    const medications = await MedicationList.find(filter);

    res.json(medications as unknown as MedicationOutputDTO[]);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
};
export const createMedication: RequestHandler<
  unknown,
  MedicationOutputDTO | { error: string },
  MedicationInputDTO & { patientId?: string; userId?: string } // Accept target identifiers in the body
> = async (req, res) => {
  try {
    const isDoctor = req.user?.roles?.includes("doctor");

    // UPDATED OWNERSHIP STRATEGY:
    // If a doctor is adding a record, map the record owner directly to the forwarded target patient ID parameters.
    // Otherwise, enforce using the patient's own authenticated token context ID.
    const recordOwnerId = isDoctor
      ? req.body.patientId || req.body.userId
      : req.user!.id;

    if (!recordOwnerId) {
      return res
        .status(400)
        .json({
          error:
            "Target patient identifier missing from request body parameters.",
        });
    }

    if (isDoctor) {
      if (!isValidId(recordOwnerId)) {
        return res.status(400).json({ error: "Invalid patient id." });
      }
      // a doctor may only add medications for connected patients
      if (!(await isConnectedTo(req.user!.id, recordOwnerId))) {
        return res
          .status(403)
          .json({ error: "This patient is not connected to you." });
      }
    }

    // Strip out the extra frontend tracking parameters before feeding the object to Mongoose
    const { patientId, userId, ...medicationData } = req.body;

    const newMedication = await MedicationList.create({
      ...(medicationData satisfies MedicationInputDTO),
      userId: recordOwnerId,
    });

    res.status(201).json(newMedication as unknown as MedicationOutputDTO);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
};

export const updateMedication: RequestHandler<
  IDParams,
  MedicationOutputDTO | { error: string },
  Partial<MedicationInputDTO>
> = async (req, res) => {
  try {
    const {
      body: { name, dosage, effect, schedule },
      params: { id },
    } = req;

    const isDoctor = req.user?.roles?.includes("doctor");

    // UPDATED LOOKUP QUERIES:
    // If a doctor is logged in, find by document ID regardless of the user field (assuming route-level authentication guards roles).
    // If a patient is logged in, restrict the filter matching strictly to their own account identity.
    // A doctor only reaches medications of connected patients.
    const lookupFilter = isDoctor
      ? { _id: id, userId: { $in: await getConnectedIds(req.user!.id) } }
      : { _id: id, userId: req.user!.id };

    const medication = await MedicationList.findOne(lookupFilter);
    if (!medication)
      return res.status(404).json({ error: "Medication record not found" });

    // PUT works like PATCH: only the fields that were sent are changed.
    const changes = Object.fromEntries(
      Object.entries({ name, dosage, effect, schedule }).filter(
        ([, value]) => value !== undefined,
      ),
    );
    medication.set(changes);
    await medication.save();

    res.json(medication as unknown as MedicationOutputDTO);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
};

export const deleteMedication: RequestHandler<
  IDParams,
  { message: string } | { error: string }
> = async (req, res) => {
  try {
    const {
      params: { id },
    } = req;

    const isDoctor = req.user?.roles?.includes("doctor");

    // UPDATED REMOVAL STRATEGY:
    // Apply role rules symmetrically to the delete mechanism.
    // A doctor only reaches medications of connected patients.
    const lookupFilter = isDoctor
      ? { _id: id, userId: { $in: await getConnectedIds(req.user!.id) } }
      : { _id: id, userId: req.user!.id };

    const medication = await MedicationList.findOneAndDelete(lookupFilter);
    if (!medication)
      return res.status(404).json({ error: "Medication record not found" });

    res.json({ message: "Medication deleted successfully" });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
};
