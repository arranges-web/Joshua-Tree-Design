import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import customersRouter from "./customers";
import jobsRouter from "./jobs";
import quotesRouter from "./quotes";
import fleetRouter from "./fleet";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use(customersRouter);
router.use(jobsRouter);
router.use(quotesRouter);
router.use(fleetRouter);
router.use(adminRouter);

export default router;
