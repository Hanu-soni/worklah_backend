const Job = require("../models/Job");
const Employer = require("../models/Employer");
const Outlet = require("../models/Outlet");
const Application = require("../models/Application");
const Shift = require("../models/Shift");
const mongoose = require("mongoose");
const moment = require("moment");

exports.getAllJobs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      jobName,
      employerId,
      outletId,
      status,
      city,
      startDate,
      endDate,
      minShifts,
      maxShifts,
      // jobStatus
      // sortBy = "createdAt", // createdAt, date, totalWage
      // sortOrder = "desc",   // asc or desc
    } = req.query;

    const filters = {};
    if (jobName) filters.jobName = { $regex: jobName, $options: "i" };
    if (employerId && mongoose.Types.ObjectId.isValid(employerId)) filters.company = employerId;
    if (outletId && mongoose.Types.ObjectId.isValid(outletId)) filters.outlet = outletId;
    if (city) filters.location = { $regex: city, $options: "i" };
    if (startDate && endDate) {
      filters.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    // if(jobStatus) filters.jobStatus=jobStatus

    // For high no show status, collect jobIds separately
    let highNoShowJobIds = [];
    if (status === "highNoShow") {
      const lowAttendanceJobs = await Application.aggregate([
        {
          $group: {
            _id: "$jobId",
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            attendanceRate: {
              $cond: [
                { $eq: ["$total", 0] },
                100,
                { $multiply: [{ $divide: ["$completed", "$total"] }, 100] },
              ],
            },
          },
        },
        {
          $match: {
            attendanceRate: { $lt: 50 },
          },
        },
      ]);
      highNoShowJobIds = lowAttendanceJobs.map((job) => job._id);
      filters._id = { $in: highNoShowJobIds };
    } else if (status === "Cancelled") {
      filters.isCancelled = true;
    } else if (status === "Upcoming") {
      filters.date = { $gt: new Date() };
  filters.isCancelled = false;
    } else if (status === "Active") {
      filters.date = { $gte: new Date() };
      filters.isCancelled = { $ne: true };
    } else if (status==="Completed") {
      filters.date = { $lt: new Date() };
    } else if(status==='Today') {
      // ✅ Include all jobs including cancelled by default
      // Do NOT add filters.isCancelled — let it be free
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0); // set time to 00:00:00.000 in UTC
      const formatted = today.toISOString().replace('Z', '+00:00');
      filters.date=formatted

      console.log(filters,".....................90")

    }
    
    

    const skip = (Number(page) - 1) * Number(limit);

 // Extract query params
const sortBy = req.query.sortBy || "date";
const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;

// Create sort object
let sortQuery = {};

// Default sort: date field
if (sortBy === "date") {
  sortQuery.date = sortOrder;
} else if (sortBy === "totalWage") {
  sortQuery.totalWage = sortOrder;
} else {
  sortQuery[sortBy] = sortOrder;
}
    



    let jobs = await Job.find(filters)
      .populate("company", "companyLegalName companyLogo")
      .populate("outlet", "outletName outletAddress outletImage")
      .populate({
        path: "shifts",
        model: "Shift",
        select: "startTime startMeridian endTime endMeridian vacancy standbyVacancy duration breakHours breakType rateType payRate totalWage",
      })
      .sort(sortQuery) // only apply if valid field
      .skip(skip)
      .limit(Number(limit))
      .lean();


      console.log(jobs[0],"......................132");



      
     const totalActiveJobs = await Job.countDocuments({ date: { $lt: new Date() },isCancelled:false });


    const totalUpcomingJobs = await Job.countDocuments({ date: { $gt: new Date() } });
    const totalCancelledJobs = await Job.countDocuments({isCancelled:true});
    const totalCompletedJobs = await Application.countDocuments({
  clockInTime: { $exists: true, $ne: null },
  clockOutTime: { $exists: true, $ne: null }
});

   
  


    const applicationCounts = await Application.aggregate([
      {
        $group: {
          _id: "$jobId",
          totalApplications: { $sum: 1 },
          standbyApplications: {
            $sum: { $cond: [{ $eq: ["$isStandby", true] }, 1, 0] },
          },
        },
      },
    ]);

    const applicationCountMap = {};
    applicationCounts.forEach((app) => {
      applicationCountMap[app._id] = {
        totalApplications: app.totalApplications || 0,
        standbyApplications: app.standbyApplications || 0,
      };
    });

    let formattedJobs = jobs.map((job) => {
      let totalVacancy = 0;
      let totalStandby = 0;
      let totalShifts = job.shifts.length;

      const shiftsArray = job.shifts.map((shift) => {
        totalVacancy += shift.vacancy;
        totalStandby += shift.standbyVacancy;

        return {
          shiftId: shift._id,
          startTime: `${shift.startTime} ${shift.startMeridian}`,
          endTime: `${shift.endTime} ${shift.endMeridian}`,
          breakIncluded: `${shift.breakHours} Hrs ${shift.breakType}`,
          vacancy: shift.vacancy,
          standbyVacancy: shift.standbyVacancy,
          duration: shift.duration,
          payRate: `$${shift.payRate}`,
          totalWage: `$${shift.totalWage}`,
        };
      });

      const applicationStats = applicationCountMap[job._id] || {
        totalApplications: 0,
        standbyApplications: 0,
      };

      //const today = moment().startOf("day");
      //const jobDate = moment(job.date).startOf("day");
      let application= Application.findOne({
        jobId:job._id,
        shiftId:job.shifts,
         clockInTime: { $exists: true, $ne: null },
        clockOutTime: { $exists: true, $ne: null }
      })
      let jobStatus = "Unknown";
      if (job.isCancelled) jobStatus = "Cancelled";
      else if (job.date>new Date()) jobStatus = "Upcoming";
     // else if (applicationStats.totalApplications >= totalVacancy) jobStatus = "Completed";
     else if (application)jobStatus="Completed"
      else jobStatus = "Active";

      return {
        _id: job._id,
        jobName: job.jobName,
        employer: {
          name: job.company?.companyLegalName || "Unknown",
          logo: job.company?.companyLogo || "/static/companyLogo.png",
        },
        outlet: {
          name: job.outlet?.outletName || "Unknown",
          location: job.outlet?.outletAddress || "Not available",
          logo: job.outlet?.outletImage || "/static/Job.png",
        },
        industry: job.industry,
        date: job.date, // ✅ Keep raw Date for sorting
        formattedDate: moment(job.date).format("Do MMMM YYYY"),
        numberOfShifts: totalShifts,
        vacancyUsers: `${applicationStats.totalApplications}/${totalVacancy}`,
        standbyUsers: `${applicationStats.standbyApplications}/${totalStandby}`,
        totalWage: `$${shiftsArray.reduce((acc, shift) => acc + parseFloat(shift.totalWage.replace("$", "")), 0)}`,
        jobStatus,
        shiftSummary: { totalVacancy, totalStandby, totalShifts },
        shifts: shiftsArray,
      };
    });

    // ✅ New: Calculate Fulfilment Rate

let totalApplicantsActive = 0;
let totalHeadcountActive = 0;
let totalApplicantsCompleted = 0;
let totalHeadcountCompleted = 0;

formattedJobs.forEach((job) => {
  const [appliedStr, vacancyStr] = job.vacancyUsers.split('/');
  const applied = parseInt(appliedStr) || 0;
  const vacancy = parseInt(vacancyStr) || 0;

  if (job.jobStatus === "Active" || job.jobStatus === "Upcoming") {
    totalApplicantsActive += applied;
    totalHeadcountActive += vacancy;
  } else if (job.jobStatus === "Completed") {
    totalApplicantsCompleted += applied;
    totalHeadcountCompleted += vacancy;
  }
});

// Default Fulfilment Rate for Active jobs
let currentFulfilmentRate = 0;
if (totalHeadcountActive > 0) {
  currentFulfilmentRate = ((totalApplicantsActive / totalHeadcountActive) * 100).toFixed(2);
}


    // Filter by shift count (minShifts/maxShifts)
    if (minShifts || maxShifts) {
      const min = parseInt(minShifts) || 0;
      const max = parseInt(maxShifts) || Infinity;
      formattedJobs = formattedJobs.filter((job) =>
        job.shiftSummary.totalShifts >= min && job.shiftSummary.totalShifts <= max
      );
    }

    // Sort manually by totalWage if requested
    if (sortBy === "totalWage") {
      formattedJobs.sort((a, b) =>
        sortOrder === "asc"
          ? parseFloat(a.totalWage.replace("$", "")) - parseFloat(b.totalWage.replace("$", ""))
          : parseFloat(b.totalWage.replace("$", "")) - parseFloat(a.totalWage.replace("$", ""))
      );
    }

    // const totalActiveJobs = formattedJobs.filter((job) => job.jobStatus === "Active").length;
    // const totalUpcomingJobs = formattedJobs.filter((job) => job.jobStatus === "Upcoming").length;
    // const totalCancelledJobs = formattedJobs.filter((job) => job.jobStatus === "Cancelled").length;
    // const totalCompletedJobs = formattedJobs.filter((job) => job.jobStatus === "Completed").length;

    // const attendanceData = await Application.aggregate([
    //   { $match: { status: "Completed" } },
    //   { $group: { _id: null, count: { $sum: 1 } } },
    // ]);
    // const totalCompletedJobs = attendanceData[0]?.count || 0;
    // const totalApplications = await Application.countDocuments();
    // const attendanceRate =
    //   totalApplications > 0
    //     ? ((totalCompletedJobs / totalApplications) * 100).toFixed(2)
    //     : 0;

    // ✅ Total jobs before pagination (from DB, not formatted)
    const totalMatchingJobs = await Job.countDocuments(filters);
    const totalPages = Math.ceil(totalMatchingJobs / limit);

    res.status(200).json({
      success: true,
      totalJobs: totalMatchingJobs, // total jobs in DB after filters
      totalJobsOnCurrentPage: formattedJobs.length,
      totalPages,
      currentPage: Number(page),
      pageLimit: Number(limit),
      totalActiveJobs,
      totalUpcomingJobs,
      totalCancelledJobs,
      totalCompletedJobs,
      // averageAttendanceRate: `${attendanceRate}%`,
      currentFulfilmentRate: `${currentFulfilmentRate}%`, // ✅ Current Fulfilment Rate
      // page: Number(page),
      jobs: formattedJobs,
    });
  } catch (error) {
    console.error("Error in getAllJobs:", error);
    res.status(500).json({
      error: "Failed to fetch jobs",
      details: error.message,
    });
  }
};





// ✅ Fetch a single job by ID (with employer, outlet, shifts)
exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate("company", "companyLegalName companyLogo")
      .populate("outlet", "outletName outletAddress outletImage")
      .populate({
        path: "shifts",
        model: "Shift",
        select: "startTime startMeridian endTime endMeridian vacancy standbyVacancy duration breakHours breakType rateType payRate totalWage",
      })
      .lean();

    if (!job) return res.status(404).json({ message: "Job not found" });

    // Fetch applications to calculate filled vacancies & standby users
    const applicationStats = await Application.aggregate([
      { $match: { jobId: job._id } },
      {
        $group: {
          _id: "$jobId",
          totalApplications: { $sum: 1 },
          standbyApplications: { $sum: { $cond: [{ $eq: ["$isStandby", true] }, 1, 0] } },
        },
      },
    ]);

    const jobApplications = applicationStats[0] || {
      totalApplications: 0,
      standbyApplications: 0,
    };

    // After calculating jobDetails
const applications = await Application.find({ jobId: job._id })
.populate("userId", "name email phone") // Adjust fields as needed
.select("_id userId shiftId date adminStatus")
.lean();

    // Initialize shift summary
    let totalVacancy = 0;
    let totalStandby = 0;
    let totalShifts = job.shifts.length;

    // Extracting shift data for easier frontend integration
    const shiftsArray = job.shifts.map((shift) => {
      totalVacancy += shift.vacancy;
      totalStandby += shift.standbyVacancy;

      return {
        shiftId: shift._id,
        startTime: shift.startTime,
        startMeridian: shift.startMeridian,
        endTime: shift.endTime,
        endMeridian: shift.endMeridian,
        totalDuration: shift.duration,
        breakIncluded: shift.breakHours,
        breakType: shift.breakType,
        rateType: shift.rateType,
        vacancy: shift.vacancy,
        standbyVacancy: shift.standbyVacancy,
        payRate: shift.payRate,
        totalWage: shift.totalWage,
      };
    });
    const totalWage = shiftsArray.reduce((acc, shift) => acc + shift.totalWage, 0);

    // Determine Job Status Logic
    const today = moment().startOf("day");
    const jobDate = moment(job.date).startOf("day");

    let jobStatus = "Unknown";

    if (job.isCancelled) {
      jobStatus = "Cancelled";
    } else if (jobDate.isAfter(today)) {
      jobStatus = "Upcoming";
    } else if (jobApplications.totalApplications >= totalVacancy) {
      jobStatus = "Completed";
    } else {
      jobStatus = "Active";
    }

    // Shift Summary
    const shiftSummary = {
      totalVacancy,
      totalStandby,
      totalShifts,
    };

    // Static shift cancellation penalties
    const shiftCancellationPenalties = [
      { condition: "5 Minutes after applying", penalty: "No Penalty" },
      { condition: "< 24 Hours", penalty: "No Penalty" },
      { condition: "> 24 Hours", penalty: "$5 Penalty" },
      { condition: "> 48 Hours", penalty: "$10 Penalty" },
      { condition: "> 72 Hours", penalty: "$15 Penalty" },
      { condition: "No Show - During Shift", penalty: "$50 Penalty" },
    ];

    // Construct job response
    const jobDetails = {
      jobId: job._id,
      jobName: job.jobName,
      jobIcon: job.jobIcon || "/static/jobIcon.png",
      industry: job.industry,
      employer: {
        _id: job.company?._id,
        name: job.company?.companyLegalName || "Unknown",
        logo: job.company?.companyLogo || "/static/companyLogo.png",
      },
      outlet: {
        _id: job.outlet?._id,
        name: job.outlet?.outletName || "Unknown",
        location: job.outlet?.outletAddress || "Not Available",
        logo: job.outlet?.outletImage || "/static/Job.png",
      },
      date: moment(job.date).format("DD MMM, YY"),
      location: job.location,
      shortAddress: job.shortAddress || "Not Available",
      jobScope: job.jobScope || [],
      jobRequirements: job.jobRequirements || [],
      jobStatus, // ✅ Job status now included
      vacancyUsers: `${jobApplications.totalApplications}/${totalVacancy}`, // ✅ Vacancy count
      standbyUsers: `${jobApplications.standbyApplications}/${totalStandby}`, // ✅ Standby count
      shiftSummary, // Summary of shifts
      shifts: shiftsArray, // ✅ Flattened shift data for frontend ease
      totalWage: totalWage,
      shiftCancellationPenalties, // Static penalties
    };

    res.status(200).json({ success: true, job: jobDetails, applications });
  } catch (error) {
    console.error("Error in getJobById:", error);
    res.status(500).json({ error: "Failed to fetch job details", details: error.message });
  }
};


// ✅ Create a new job with proper shift details
exports.createJob = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      jobName,
      employerId,
      outletId,
      date,
      location,
      industry,
      shortAddress,
      jobScope,
      jobRequirements,
      shifts,
    } = req.body;

    // Validate Employer
    const employer = await Employer.findById(employerId).session(session);
    if (!employer) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Employer not found" });
    }

    // Validate Outlet
    const outlet = await Outlet.findById(outletId).session(session);
    if (!outlet) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Outlet not found" });
    }

    // Create Job Entry
    const newJob = new Job({
      jobIcon: "/static/jobIcon.png", // Default Icon
      jobName,
      company: employerId,
      outlet: outletId,
      date: new Date(date),
      location,
      shortAddress, // Pull address from outlet
      industry,
      outletImage: outlet.outletImage || "/static/outletImage.png",
      jobScope,
      jobRequirements,
    });

    // Save Job
    const savedJob = await newJob.save({ session });

    // Handle Shifts if provided
    let createdShifts = [];
    if (shifts && shifts.length > 0) {
      createdShifts = await Shift.insertMany(
        shifts.map((shift) => ({
          job: savedJob._id,
          startTime: shift.startTime,
          startMeridian: shift.startMeridian,
          endTime: shift.endTime,
          endMeridian: shift.endMeridian,
          vacancy: shift.vacancy,
          standbyVacancy: shift.standbyVacancy,
          duration: shift.duration,
          breakHours: shift.breakHours,
          breakType: shift.breakType,
          rateType: shift.rateType,
          payRate: shift.payRate,
          totalWage: shift.rateType === "Hourly rate" ? shift.payRate * shift.duration : shift.payRate,
        })),
        { session }
      );

      // Associate shifts with the job
      savedJob.shifts = createdShifts.map((shift) => shift._id);
      await savedJob.save({ session });
    }

    // Commit Transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Job created successfully",
      job: savedJob,
      shifts: createdShifts,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating job:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};

// ✅ Update a job properly
exports.updateJob = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { jobName, employerId, outletId, date, location, industry, jobScope, jobRequirements, shifts } = req.body;

    // Validate employer
    const employer = await Employer.findById(employerId).session(session);
    if (!employer) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Employer not found" });
    }

    // Validate outlet
    const outlet = await Outlet.findById(outletId).session(session);
    if (!outlet) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Outlet not found" });
    }

    // Find the existing job
    const job = await Job.findById(req.params.id).session(session);
    if (!job) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Job not found" });
    }

    // Remove existing shifts & create new shifts
    await Shift.deleteMany({ job: job._id }).session(session);

    const createdShifts = await Shift.insertMany(
      shifts.map((shift) => ({
        job: job._id,
        startTime: shift.startTime,
        startMeridian: shift.startMeridian,
        endTime: shift.endTime,
        endMeridian: shift.endMeridian,
        vacancy: shift.vacancy,
        standbyVacancy: shift.standbyVacancy,
        duration: shift.duration,
        breakHours: shift.breakHours,
        breakType: shift.breakType,
        rateType: shift.rateType,
        payRate: shift.payRate,
        totalWage: shift.rateType === "Hourly rate" ? shift.payRate * shift.duration : shift.payRate,
      })),
      { session }
    );

    // Update job details
    job.jobName = jobName;
    job.company = employerId;
    job.outlet = outletId;
    job.date = new Date(date);
    job.location = location;
    job.industry = industry;
    job.jobScope = jobScope;
    job.jobRequirements = jobRequirements;
    job.shifts = createdShifts.map((shift) => shift._id);

    await job.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ success: true, message: "Job updated successfully", job, shifts: createdShifts });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating job:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};


// ✅ Duplicate Job API
exports.duplicateJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate("shifts");
    if (!job) return res.status(404).json({ message: "Job not found" });

    // Create a copy of the job
    const newJob = new Job({
      jobIcon: job.jobIcon,
      jobName: `${job.jobName} (Copy)`,
      company: job.company,
      outlet: job.outlet,
      date: job.date,
      location: job.location,
      industry: job.industry,
      outletImage: job.outletImage,
      jobScope: job.jobScope,
      jobRequirements: job.jobRequirements,
    });

    // Save duplicated job
    const savedJob = await newJob.save();

    // Duplicate shifts
    const duplicatedShifts = await Shift.insertMany(
      job.shifts.map((shift) => ({
        job: savedJob._id,
        startTime: shift.startTime,
        startMeridian: shift.startMeridian,
        endTime: shift.endTime,
        endMeridian: shift.endMeridian,
        vacancy: shift.vacancy,
        standbyVacancy: shift.standbyVacancy,
        duration: shift.duration,
        breakHours: shift.breakHours,
        breakType: shift.breakType,
        rateType: shift.rateType,
        payRate: shift.payRate,
        totalWage: shift.totalWage,
      }))
    );

    savedJob.shifts = duplicatedShifts.map((shift) => shift._id);
    await savedJob.save();

    return res.status(201).json({ success: true, message: "Job duplicated successfully", job: savedJob });
  } catch (error) {
    console.error("Error duplicating job:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};


// ✅ Change Job Status (Activate, Deactivate, Cancel)
exports.changeJobStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Active", "Completed", "Cancelled", "Upcoming"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const job = await Job.findByIdAndUpdate(req.params.id, { jobStatus: status }, { new: true });
    if (!job) return res.status(404).json({ message: "Job not found" });

    res.status(200).json({ success: true, message: `Job status updated to ${status}`, job });
  } catch (error) {
    console.error("Error updating job status:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
};


// ✅ Cancel Job API
exports.cancelJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, { jobStatus: "Cancelled" }, { new: true });

    if (!job) return res.status(404).json({ message: "Job not found" });

    res.status(200).json({ success: true, message: "Job Cancelled", job });
  } catch (error) {
    console.error("Error cancelling job:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
};


// ✅ Deactivate Job API
exports.deactivateJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, { jobStatus: "Deactivated" }, { new: true });

    if (!job) return res.status(404).json({ message: "Job not found" });

    res.status(200).json({ success: true, message: "Job Deactivated", job });
  } catch (error) {
    console.error("Error deactivating job:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
};


// ✅ Delete Job API
exports.deleteJob = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const job = await Job.findById(req.params.id).session(session);
    if (!job) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Job not found" });
    }

    // Mark job as cancelled (soft delete)
    job.isCancelled = true;
    await job.save({ session });

    // Optional: delete associated shifts (or you can keep them if needed)
    await Shift.deleteMany({ job: job._id }).session(session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ success: true, message: "Job cancelled successfully" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error cancelling job:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};



exports.getDeploymentTracking = async (req, res) => {
  try {
    const { startDate, endDate, employerId, jobId, page = 1, limit = 10 } = req.query;

    const matchStage = { isCancelled: { $ne: true } };

    if (startDate && endDate) {
      matchStage.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    if (employerId) matchStage.company = new mongoose.Types.ObjectId(employerId);
    if (jobId) matchStage._id = new mongoose.Types.ObjectId(jobId);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "employers",
          localField: "company",
          foreignField: "_id",
          as: "employer",
        },
      },
      { $unwind: "$employer" },
      {
        $lookup: {
          from: "outlets",
          localField: "outlet",
          foreignField: "_id",
          as: "outlet",
        },
      },
      { $unwind: "$outlet" },
      {
        $lookup: {
          from: "applications",
          localField: "_id",
          foreignField: "jobId",
          as: "applications",
        },
      },
      {
        $addFields: {
          requestedSeats: {
            $size: {
              $filter: {
                input: "$applications",
                as: "app",
                cond: { $eq: ["$$app.adminStatus", "Pending"] },
              },
            },
          },
          approvedSeats: {
            $size: {
              $filter: {
                input: "$applications",
                as: "app",
                cond: { $eq: ["$$app.adminStatus", "Confirmed"] },
              },
            },
          },
          hasPendingApp: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$applications",
                    as: "app",
                    cond: { $eq: ["$$app.adminStatus", "Pending"] },
                  },
                },
              },
              0,
            ],
          },
          hasApprovedApp: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$applications",
                    as: "app",
                    cond: { $eq: ["$$app.adminStatus", "Confirmed"] },
                  },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $project: {
          jobId: "$_id",
          jobName: "$jobName",
          employerName: "$employer.companyLegalName",
          outletName: "$outlet.outletName",
          requestedSeats: 1,
          approvedSeats: 1,
          RQSTJobs: { $cond: ["$hasPendingApp", 1, 0] },
          approvedJobs: { $cond: ["$hasApprovedApp", 1, 0] },
          fulfillmentRate: {
            $cond: [
              { $gt: ["$requestedSeats", 0] },
              {
                $concat: [
                  {
                    $toString: {
                      $round: [
                        {
                          $multiply: [
                            { $divide: ["$approvedSeats", "$requestedSeats"] },
                            100,
                          ],
                        },
                        0,
                      ],
                    },
                  },
                  "%",
                ],
              },
              "0%",
            ],
          },
        },
      },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: parseInt(limit) }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const result = await Job.aggregate(pipeline);

    res.json({
      data: result[0].data || [],
      total: result[0].total[0]?.count || 0,
    });
  } catch (err) {
    console.error("Deployment tracking error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.approveApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    application.adminStatus = "Confirmed";
    await application.save();

    res.status(200).json({ success: true, message: "Application approved" });
  } catch (error) {
    console.error("Error approving application:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Reject application
exports.rejectApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { reason } = req.body;

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    application.adminStatus = "Rejected";
    application.describedReason = reason || "No reason provided";
    await application.save();

    res.status(200).json({ success: true, message: "Application rejected" });
  } catch (error) {
    console.error("Error rejecting application:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};




