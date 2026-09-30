import type { RequestHandler } from "express";
import { medicationInputSchema } from "#schemas";
import { z } from "zod";
import type { Types } from "mongoose";
import { MedicationList } from "#models";

type MedicationInputDTO = z.infer<typeof medicationInputSchema>;
type MedicationOutputDTO = MedicationInputDTO & {
  _id: InstanceType<typeof Types.ObjectId>;
  createdAt: Date;
  updatedAt: Date;
};
type IDParams = {
  id: string;
};

export const getMedications: RequestHandler<
  unknown,
  MedicationOutputDTO[] | { error: string }
> = async (req, res) => {
  try {
    const medications = await MedicationList.find();
    res.json(medications as MedicationOutputDTO[]);
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
  MedicationInputDTO
> = async (req, res) => {
  try {
    const newUser = await MedicationList.create(
      req.body satisfies MedicationInputDTO,
    );
    //const newUser = await User.create<MedicationInputDTO>(req.body);

    res.status(201).json(newUser as MedicationOutputDTO);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
};

// export const getMedicationById: RequestHandler<
//   IDParams,
//   MedicationOutputDTO | { error: string }
// > = async (req, res) => {
//   try {
//     const user = await MedicationList.findById(req.params.id);
//     if (!user) return res.status(404).json({ error: "Medication not found" });
//     res.json(user);
//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       res.status(500).json({ error: error.message });
//     } else {
//       res.status(500).json({ error: "An unknown error occurred" });
//     }
//   }
// };

export const updateMedication: RequestHandler<
  IDParams,
  MedicationOutputDTO | { error: string },
  MedicationInputDTO
> = async (req, res) => {
  try {
    const {
      body,
      params: { id },
    } = req;
    const { name, dosage, effect, schedule } = body;
    if (!name || !dosage || !effect || !schedule)
      return res
        .status(400)
        .json({ error: "name, dosage, effect and time are required" });
    const medication = await MedicationList.findById(id);
    if (!medication)
      return res.status(404).json({ error: "Medication not found" });
    medication.dosage = dosage;
    medication.effect = effect;
    medication.schedule = schedule;
    medication.name = name;
    await medication.save();

    res.json(medication as MedicationOutputDTO);
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
    const medication = await MedicationList.findByIdAndDelete(id);
    if (!medication)
      return res.status(404).json({ error: "Medication not found" });
    res.json({ message: "Medication deleted successfully" });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
};
