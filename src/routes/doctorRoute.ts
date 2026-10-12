import { Router } from "express";
import {
  generateInviteCode,
  redeemInviteCode,
  getMyConnectedPatients,
  getPatientHistoricalSummary,
} from "../controllers/doctorController.ts";
import { authorize, validateBody } from "#middleware";
import { redeemInviteCodeSchema } from "#schemas";

const doctorRouter = Router();

// 1. Patient Interface Pathway: Redeem code to link with a clinician
doctorRouter.post(
  "/patient/redeem-code",
  authorize("patient"),
  validateBody(redeemInviteCodeSchema),
  redeemInviteCode,
);

// 2. Clinician Interface Pathways: Protected doctor workspace operations
doctorRouter.post(
  "/doctor/generate-code",
  authorize("doctor"),
  generateInviteCode,
);

doctorRouter.get(
  "/doctor/patients",
  authorize("doctor"),
  getMyConnectedPatients,
);

doctorRouter.get(
  "/doctor/patient-summary/:patientId",
  authorize("doctor"),
  getPatientHistoricalSummary,
);

export default doctorRouter;
