const express = require("express");
const cors = require("cors");
const app = express();
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const authRoute = require("./router/auth-router");
const contactRoute = require("./router/contact-router");
const serviceRoute = require("./router/service-router");
const adminRoute = require("./router/admin-router");
const errorMiddleware = require("./middlewares/error-middleware");
const { cronAuth } = require("./middlewares/auth-middleware");

// Load environment variables
dotenv.config();

const connectDb = require("./utils/db");
app.use(cors('*'));

app.use(express.json());

// Mount the Router: To use the router in your main Express app, you can "mount" it at a specific URL prefix
app.get("/", (req, res) => {
    return res.send("Welcome to Node js, express js in Docker");
});

app.use("/api/auth", authRoute);
app.use("/api/form", contactRoute);
app.use("/api/data", serviceRoute);

// let's define admin route
app.use("/api/admin", adminRoute);

// Database status endpoint
app.get('/api/status', async (_req, res) => {
  await connectDb()
  const dbState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  res.json({
    status: 'success',
    message: `Server is running`,
    data: {
      database: states[dbState] || 'unknown',
      uptime: process.uptime(),
    },
  });
});

// ─── MongoDB Connection CronJob ─────────────────────────────────────────────────────

app.get("/api/db-heartbeat", cronAuth, async (req, res) => {
  try {
    await connectDb()
    await mongoose.connection.db
      .collection("heartbeat")
      .updateOne(
        { _id: "heartbeat" },
        { $set: { lastRun: new Date() } },
        { upsert: true }
      );

    res.json({
      success: true,
      message: "Heartbeat updated"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.use(errorMiddleware);

const PORT = process.env.PORT;
connectDb().then(() => {
  app.listen(PORT, () => {
    console.log(`server is running at port: ${PORT}`);
  });
});
