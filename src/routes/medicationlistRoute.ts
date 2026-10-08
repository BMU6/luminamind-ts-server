import { Router } from "express";
import {
  getMedications,
  createMedication,
  updateMedication,
  deleteMedication,
} from "#controllers";

import { accessHandler, authorize, validateBody } from "#middleware";
import { medicationInputSchema } from "#schemas";

//const medicationUpdateSchema = medicationInputSchema.partial();

const medicationRouter = Router();

// Who are you (token) and may you (role)? For every medication route.
medicationRouter.use(accessHandler, authorize("patient", "doctor"));

medicationRouter
  .route("/")
  .get(getMedications)
  .post(validateBody(medicationInputSchema), createMedication);

medicationRouter
  .route("/:id")

  .put(validateBody(medicationInputSchema), updateMedication)
  .delete(deleteMedication);

export default medicationRouter;
