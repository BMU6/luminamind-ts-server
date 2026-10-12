import "#db";
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import {
  authRoutes,
  medicationRouter,
  reportRouter,
  homeRouter,
  doctorRouter,
  chatRouter,
} from "#routes"; // homeRouter added
import { accessHandler, errorHandler, notFoundHandler } from "#middleware"; // accessHandler added
import { CLIENT_BASE_URL, PORT } from "#config";

const app = express();

app.use(
  cors({
    origin: CLIENT_BASE_URL,
    credentials: true,
    exposedHeaders: ["WWW-Authenticate"], // needed to send the 'refresh trigger''
  }),
);

app.use(express.json(), cookieParser());

app.use("/auth", authRoutes);
app.use("/medicationlist", medicationRouter);
app.use("/reports", reportRouter);
app.use("/home", accessHandler, homeRouter);
app.use("/doctor", accessHandler, doctorRouter);
app.use("/chat", accessHandler, chatRouter);
app.use("*splat", notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`LuminaMind Server listening on http://localhost:${PORT}`);
});
