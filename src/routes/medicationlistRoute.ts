import { Router } from "express";
import {
  getMedications,
  createMedication,
  updateMedication,
  deleteMedication,
} from "#controllers";

import {
  accessHandler,
  authorize,
  validateBody,
  validateIdParam,
} from "#middleware";
import { medicationInputSchema } from "#schemas";

// PUT works like PATCH: the client may send only the fields it wants to change.
const medicationUpdateSchema = medicationInputSchema.partial();

const medicationRouter = Router();

// Who are you (token) and may you (role)? For every medication route.
medicationRouter.use(accessHandler, authorize("patient", "doctor"));
medicationRouter.param("id", validateIdParam); // malformed id -> 400

medicationRouter
  .route("/")
  .get(getMedications)
  .post(validateBody(medicationInputSchema), createMedication);

medicationRouter
  .route("/:id")

  .put(validateBody(medicationUpdateSchema), updateMedication)
  .delete(deleteMedication);

export default medicationRouter;
