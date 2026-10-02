import { Router } from "express";
import {
  getReports,
  createReport,
  getReportById,
  updateReport,
  deleteReport,
} from "#controllers";

import { validateBody } from "#middleware";
import { reportInputSchema } from "#schemas";
const reportUpdateSchema = reportInputSchema.partial();
const reportRouter = Router();
reportRouter
  .route("/")
  .get(getReports)
  .post(validateBody(reportInputSchema), createReport);

reportRouter
  .route("/:id")
  .get(getReportById)
  .put(validateBody(reportUpdateSchema), updateReport)
  .delete(deleteReport);

export default reportRouter;
