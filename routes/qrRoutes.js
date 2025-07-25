const express = require("express");
const { authMiddleware } = require("../middlewares/auth"); // Ensure authentication middleware is used
const {
  generateQRCode,
  scanQRCode,
  getShifts,
  clockIn,
  clockOut,
  getUpcomingShifts,
  generateQRCodeForToday,
} = require("../controllers/qrController");

const router = express.Router();

// ✅ Get all upcoming shifts for a user
router.get("/upcoming", authMiddleware, getUpcomingShifts);

// ✅ Generate QR Code (Admin-side)
router.post("/generate",  generateQRCode);
router.post("/generate/today",  generateQRCodeForToday);

// ✅ Scan QR Code (Fetch job & shift details)
router.post("/scan", authMiddleware, scanQRCode);

// ✅ Get Shifts (Admin-side)
router.get("/shifts", authMiddleware, getShifts);

// ✅ Manually Clock-In (After scanning QR)
router.post("/clock-in", authMiddleware, clockIn);

// ✅ Manually Clock-Out (After shift ends)
router.post("/clock-out", authMiddleware, clockOut);

module.exports = router;
