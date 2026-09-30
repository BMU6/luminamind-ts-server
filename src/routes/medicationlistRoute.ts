import { Router } from "express";
import {
  getMedications,
  createMedication,
  updateMedication,
  deleteMedication,
} from "#controllers";

import { validateBody } from "#middleware";
import { medicationInputSchema } from "#schemas";

//const medicationUpdateSchema = medicationInputSchema.partial();

const medicationRouter = Router();
medicationRouter
  .route("/")
  .get(getMedications)
  .post(validateBody(medicationInputSchema), createMedication);

medicationRouter
  .route("/:id")

  .put(validateBody(medicationInputSchema), updateMedication)
  .delete(deleteMedication);

export default medicationRouter;
