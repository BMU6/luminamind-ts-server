import type { RequestParamHandler } from "express";
import { isValidId } from "../utils/connections.ts";

// Use with router.param("id", validateIdParam): every route that has this URL
// parameter answers 400 for a malformed MongoDB id instead of crashing with 500.
const validateIdParam: RequestParamHandler = (_req, _res, next, value) => {
  if (!isValidId(value)) {
    return next(new Error("Invalid id.", { cause: { status: 400 } }));
  }
  next();
};

export default validateIdParam;
