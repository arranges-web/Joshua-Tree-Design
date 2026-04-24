import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import customersRouter from "./customers";
import jobsRouter from "./jobs";
import quotesRouter from "./quotes";
import invoicesRouter from "./invoices";
import fleetRouter from "./fleet";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use(dashboardRouter);
router.use(customersRouter);
router.use(jobsRouter);
router.use(quotesRouter);
router.use(invoicesRouter);
router.use(fleetRouter);
router.use(adminRouter);

export default router;
