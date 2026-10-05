import type { RequestHandler } from "express";
import { medicationInputSchema } from "#schemas";
import { z } from "zod";
import type { Types } from "mongoose";
import { MedicationList } from "#models";

type MedicationInputDTO = z.infer<typeof medicationInputSchema>;
type MedicationOutputDTO = Omit<MedicationInputDTO, "userId"> & {
  _id: Types.ObjectId;
  userId: Types.ObjectId; // in the database it is an ObjectId, JSON turns it into a string
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
    const { userId } = req.query;

    const filter = typeof userId === "string" ? { userId } : {};
    // this would also work. but we need a kind of cast here because nested schedule can't
    // be handeled just by fine() like in some bootcamp exercises done.
    // lean btw makes out of a complete mongoose object just a data object.
    // I used as MedicationOutputDTO[]
    // const medications = await MedicationList.find(filter).lean<MedicationOutputDTO[]>();
    const medications = await MedicationList.find(filter);
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

// export const getMedicationsByUserId: RequestHandler<
//   unknown,
//   MedicationOutputDTO[] | { error: string }
// > = async (req, res, next) => {
//   try {
//     const { userId } = req.query;

//     const filter = typeof userId === "string" ? { userId } : {};

//     const medications = await MedicationList.find(filter).lean();

//     const formattedMedications: MedicationOutputDTO[] = (medications as any[]).map(
//       (medicine) => ({
//         _id: medicine._id,
//         name: medicine.name,
//         dosage: medicine.dosage,
//         effect: medicine.effect,
//         schedule: medicine.schedule,
//         userId: medicine.userId ? medicine.userId.toString() : "",
//         createdAt: medicine.createdAt,
//         updatedAt: medicine.updatedAt,
//       }),
//     );

//     return res.json(formattedMedications);
//   } catch (error) {
//     next(error);
//   }
// };

export const updateMedication: RequestHandler<
   IDParams,
   MedicationOutputDTO | { error: string }
  // MedicationInputDTO
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
