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


/**
 * Wait for a connecting connection to resolve to either connected or disconnected.
 * Returns false if disconnected/timed out, true if connected.
 */
function waitForConnection(timeoutMs = 8000) {
  const readyState = mongoose.connection.readyState;
  // Already connected
  if (readyState === 1) return Promise.resolve(true);
  // Not in a connecting state — won't become connected
  if (readyState !== 2) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(mongoose.connection.readyState === 1);
      }
    }, timeoutMs);

    const onConnected = () => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(true);
      }
    };
    const onDisconnected = () => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(false);
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      mongoose.connection.removeListener('connected', onConnected);
      mongoose.connection.removeListener('disconnected', onDisconnected);
    };

    mongoose.connection.once('connected', onConnected);
    mongoose.connection.once('disconnected', onDisconnected);
  });
}

// Database status endpoint
app.get('/api/status', async (_req, res, next) => {
  try {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    let dbState = mongoose.connection.readyState;

    // If connecting, wait to see if it becomes connected or disconnected
    if (dbState === 2) {
      const becameConnected = await waitForConnection();
      // Re-check state after wait
      dbState = becameConnected ? 1 : mongoose.connection.readyState;
    }

    // If still not connected after waiting (or was disconnected/disconnecting), return 503
    if (dbState !== 1) {
      return res.status(503).json({
        status: 'error',
        message: 'Database is not connected',
        data: {
          database: states[dbState] || 'unknown',
          uptime: process.uptime(),
          uptime_hours: (process.uptime() / 3600).toFixed(2),
        },
      });
    }

    // Ping is lightweight and fast — replaces expensive serverStatus()
    const pingResult = await mongoose.connection.db
      .admin()
      .ping();

    const dbName = mongoose.connection.db.databaseName;

    // Stats with a 3-second timeout using Promise.race
    const statsPromise = mongoose.connection.db.stats();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('stats timed out')), 3000)
    );
    const stats = await Promise.race([statsPromise, timeoutPromise]).catch(
      () => null
    );

    res.json({
      status: 'success',
      message: 'Server is running',
      data: {
        database: states[dbState],
        db_Name: dbName,
        ping: pingResult.ok === 1 ? 'ok' : 'fail',
        uptime: process.uptime(),
        uptime_hours: (process.uptime() / 3600).toFixed(2),
        collections: stats?.collections ?? null,
        documents: stats?.objects ?? null,
        indexes: stats?.indexes ?? null,
        data_size: stats?.dataSize
          ? (stats.dataSize / 1024 / 1024).toFixed(2) + ' MB'
          : null,
        storage_size: stats?.storageSize
          ? (stats.storageSize / 1024 / 1024).toFixed(2) + ' MB'
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
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
