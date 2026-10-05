import { Router } from "express";
import { getHomeReports } from "#controllers";
import { authorize } from "#middleware";

const homeRouter = Router();

// accessHandler (who are you?) is added in app.ts, authorize (may you?) here
homeRouter.use(authorize("patient"));

homeRouter.get("/", getHomeReports);

export default homeRouter;
