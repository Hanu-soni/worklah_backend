const express = require("express");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

dotenv.config();

const app = express();

// Import Routes
const userRouter = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const jobRoutes = require('./routes/jobRoutes'); 
const shiftRoutes = require('./routes/shiftRoutes');
const homeRoutes = require('./routes/homeRoutes');
const workerRoutes = require('./routes/workerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const walletRoutes = require('./routes/walletRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const employerRoutes = require('./routes/employerRoutes');
const qrRoutes = require('./routes/qrRoutes');
const requirementRoutes = require('./routes/requirementRoutes');
const penaltyRoutes = require('./routes/penaltyRoutes');
const outletRoutes = require('./routes/outletRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const profileRoutes = require('./routes/profileRoutes');
const cancellationRoutes = require('./routes/cancellationRoutes');
const adminJobRoutes = require('./routes/adminJobRoutes');
const adminCandidateRoutes = require("./routes/adminCandidateRoutes");
const adminOutletRoutes = require("./routes/adminOutletRoutes");
const hustleHeroesRoutes = require("./routes/hustleHeroesRoutes");
const bookmarkRoutes=require('./routes/bookmarkRoutes')

// Middleware

const allowedOrigins = [
  "http://localhost:5173",                  // Vite local dev
  "http://127.0.0.1:5173",                  // Localhost (IPv4)
  "http://localhost",                      // Flutter web
  "http://127.0.0.1",                      // Emulator or test
  "https://work-lah-admin-panel.vercel.app",
 // "https://worklah-backend.onrender.com",
  "https://work-lah-admin-panel-six.vercel.app"
   // ✅ Deployed Vercel frontend (no slash)
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://localhost")) {
      callback(null, true);  // ✅ Allow
    } else {
      console.error("❌ Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));  // ❌ Block
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,  // Required if frontend uses cookies or Authorization headers
}));

// Enable preflight (OPTIONS) for all routes
app.options("*", cors());


app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static Files
app.use('/static', express.static('public'));

// Routes
app.use("/api/user", userRouter);
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/shifts", shiftRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/employers', employerRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/penalties', penaltyRoutes);
app.use('/api/outlets', outletRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/cancellation', cancellationRoutes);
app.use('/api/admin/jobs', adminJobRoutes);
app.use("/api/admin", adminCandidateRoutes);
app.use("/api/admin", adminOutletRoutes);
app.use("/api/hustleheroes", hustleHeroesRoutes);
app.use("/api/bookmark", bookmarkRoutes);


// MongoDB connection
mongoose
  .connect(process.env.MONGOOSE_URI_STRING, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB connected");
    // Start the server after successful DB connection
    app.listen(process.env.PORT || 3000, () => {
      console.log(`Server is running on port ${process.env.PORT || 3000}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
