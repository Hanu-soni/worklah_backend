const express = require('express');
const { getAllJobs, getJobById, createJob, updateJob, changeJobStatus, deleteJob, duplicateJob, deactivateJob, cancelJob, getDeploymentTracking, approveApplication, rejectApplication} = require('../controllers/adminJobController');
const { authMiddleware, adminOnlyMiddleware } = require("../middlewares/auth");
const router = express.Router();

// Routes for Admin Job Management
router.use(authMiddleware, adminOnlyMiddleware);
router.get('/', getAllJobs); // ✅ Get all jobs with filters
router.get('/deployment-tracking', getDeploymentTracking); // ✅ Get deployment tracking data
router.get('/:id', getJobById); // ✅ Get a specific job
router.post('/', createJob); // ✅ Create a new job
router.put('/:id', updateJob); // ✅ Update a job
router.patch('/:id/status', changeJobStatus); // ✅ Change job status
router.put('/cancel/:id', deleteJob); // ✅ Delete a job
router.post("/:id/duplicate", duplicateJob); // ✅ Duplicate Job
router.patch("/:id/deactivate", deactivateJob); // ✅ Deactivate Job
router.patch("/:id/cancel", cancelJob); // ✅ Cancel Job
router.post('/approve-application/:id', approveApplication); // ✅ Approve application
router.post('/reject-application/:id', rejectApplication); // ✅ Reject application

module.exports = router;
