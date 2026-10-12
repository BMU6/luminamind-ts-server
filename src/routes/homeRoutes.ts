import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { getHomeReports, summarizeHomeReports } from "#controllers";
import { authorize } from "#middleware";

const homeRouter = Router();

// accessHandler (who are you?) is added in app.ts, authorize (may you?) here
homeRouter.use(authorize("patient"));

homeRouter.get("/", getHomeReports);

// An AI call is slow and costs resources, so it gets its own limit: 10 summaries per 15 minutes per client
const summaryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "Too many summaries, please try again later." },
});
homeRouter.post("/summary", summaryLimiter, summarizeHomeReports);

export default homeRouter;
