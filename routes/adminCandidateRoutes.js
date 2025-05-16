const express = require("express");
const { getCandidatesByJob, getCandidateProfile, updateCandidate , getCandidates, verifyCandidate, updateApplicationStatus  } = require("../controllers/adminCandidateController");
const { authMiddleware, adminOnlyMiddleware } = require("../middlewares/auth");
const router = express.Router();

// router.use(authMiddleware, adminOnlyMiddleware);
router.get("/candidates", getCandidates);
router.get("/jobs/candidates/:id", getCandidatesByJob); // ✅ Get candidates for a job
router.get("/candidates/:id", getCandidateProfile); // ✅ Get candidate profile
router.post("/candidates/:id", updateCandidate); // ✅ Update candidate details
router.put("/verify-candidate/:id", verifyCandidate); // ✅ Admin approve/reject candidate
router.put("/applications/status/:userId", updateApplicationStatus);



module.exports = router;
