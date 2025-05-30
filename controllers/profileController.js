const Profile = require("../models/Profile");
const User = require("../models/User");
const Application = require("../models/Application");
const Job = require("../models/Job");
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");


// ✅ Upload Profile Picture (Supports File & Base64)
exports.uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    // ✅ Ensure user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    let imageUrl;

    // ✅ If file is uploaded (via Form-Data)
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "WorkLah/ProfilePictures",
          resource_type: "image",
        });
        imageUrl = result.secure_url;
      } catch (uploadError) {
        return res.status(500).json({ error: "Failed to upload image to Cloudinary." });
      }
    }
    // ✅ If base64 image is sent
    else if (req.body.image) {
      try {
        const result = await cloudinary.uploader.upload(req.body.image, {
          folder: "WorkLah/ProfilePictures",
          resource_type: "image",
        });
        imageUrl = result.secure_url;
      } catch (uploadError) {
        return res.status(500).json({ error: "Failed to upload Base64 image." });
      }
    }
    // ✅ No valid image data provided
    else {
      return res.status(400).json({ error: "No image file or Base64 string provided." });
    }

    // ✅ Update User Model
    const updatedUser = await User.findByIdAndUpdate(userId, { profilePicture: imageUrl }, { new: true });

    // ✅ Update Profile Model (if exists)
    await Profile.findOneAndUpdate({ user: userId }, { profilePicture: imageUrl }, { new: true });

    return res.status(200).json({
      message: "Profile picture updated successfully.",
      imageUrl: updatedUser.profilePicture,
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      error: "An unexpected error occurred.",
      details: error.message,
    });
  }
};


// Complete profile dynamically
exports.completeProfile = async (req, res) => {
  try {
    const { userId, dob, gender, postalCode, nricNumber, finNumber, studentIdNumber, schoolName, plocExpiryDate } = req.body;

    const user = await User.findById(userId).populate("profileId");
    if (!user) return res.status(404).json({ error: "User not found." });

    let profile = user.profileId;
    if (!profile) {
      profile = new Profile({ userId });
    }

    profile.nricNumber = undefined;
    profile.nricImages = undefined;
    profile.finNumber = undefined;
    profile.finImages = undefined;
    profile.plocImage = undefined;
    profile.plocExpiryDate = undefined;
    profile.studentIdNumber = undefined;
    profile.schoolName = undefined;
    profile.studentCardImage = undefined;

    // Update Common Fields
    profile.dob = dob;
    profile.gender = gender;
    profile.postalCode = postalCode;

    const files = req.files;

    // ✅ Handle Cloudinary Uploads Based on Employment Status
    switch (user.employmentStatus) {
      case "Singaporean/Permanent Resident":
        if (!nricNumber) return res.status(400).json({ error: "NRIC Number is required for Singaporean/Permanent Resident." });

        profile.nricNumber = nricNumber;
        profile.nricImages = {
          front: files?.nricFront?.[0]?.path || null,
          back: files?.nricBack?.[0]?.path || null,
        };
        break;

      case "Long Term Visit Pass Holder":
        if (!finNumber || !plocExpiryDate) return res.status(400).json({ error: "FIN Number and PLOC Expiry Date are required for Long Term Visit Pass Holder." });

        profile.finNumber = finNumber;
        profile.finImages = {
          front: files?.finFront?.[0]?.path || null,
          back: files?.finBack?.[0]?.path || null,
        };
        profile.plocImage = files?.plocImage?.[0]?.path || null;
        profile.plocExpiryDate = plocExpiryDate;
        break;

      case "Student Pass":
        if (!studentIdNumber || !schoolName) return res.status(400).json({ error: "Student ID Number and School Name are required for Students." });

        profile.studentIdNumber = studentIdNumber;
        profile.schoolName = schoolName;
        profile.studentCardImage = files?.studentCard?.[0]?.path || null;
        break;
    }

    // ✅ Handle Profile Picture Upload to Cloudinary
    if (files?.selfie?.[0]?.path) {
      user.profilePicture = files.selfie[0].path;
    }

    await profile.save();
    user.profileCompleted = true;

    // Set to Pending only if not already Verified or Rejected
    if (!["Verified", "Rejected"].includes(user.status)) {
      user.status = "Pending";
    }

    if (!user.profileId) {
      user.profileId = profile._id;
    }

    await user.save();

    res.status(200).json({
      message: "Profile completed successfully with Cloudinary.",
      profile,
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to complete profile.", details: error.message });
  }
};




// Fetch profile

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch the user and populate their profile and wallet
    const user = await User.findById(userId).populate("profileId").populate("eWallet");
    if (!user) return res.status(404).json({ error: "User not found." });

    const profile = user.profileId;
    const wallet = user.eWallet;

    // If the profile is incomplete, return basic user details
    if (!user.profileCompleted) {
      return res.status(200).json({
        message: "Profile incomplete. Please complete your profile.",
        fullName: user.fullName || null,
        phoneNumber: user.phoneNumber || null,
        email: user.email || null,
        profilePicture: user.profilePicture || "/static/image.png",
        wallet: {
          id: wallet ? wallet._id : null,
          balance: wallet ? wallet.balance : 0,
        },
      });
    }

    // Fetch statistics dynamically
    const totalCompletedJobs = await Application.countDocuments({
      userId: user._id,
      status: "Completed",
    });

    const totalCancelledJobs = await Application.countDocuments({
      userId: user._id,
      status: "Cancelled",
    });

    const totalHoursWorked = await Application.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: "Completed",
        },
      },
      {
        $lookup: {
          from: "jobs",
          localField: "jobId",
          foreignField: "_id",
          as: "jobDetails",
        },
      },
      { $unwind: "$jobDetails" },
      { $unwind: "$jobDetails.dates" },
      { $unwind: "$jobDetails.dates.shifts" },
      {
        $group: {
          _id: null,
          totalHours: { $sum: "$jobDetails.dates.shifts.duration" },
        },
      },
    ]);

    res.status(200).json({
      profile,
      profilePicture: user.profilePicture || "/static/image.png",
      wallet: {
        id: wallet ? wallet._id : null,
        balance: wallet ? wallet.balance : 0,
        transactions: wallet ? wallet.transactions.slice(-5) : [],
      },
      stats: {
        totalCompletedJobs: totalCompletedJobs || 0,
        totalCancelledJobs: totalCancelledJobs || 0,
        totalHoursWorked: totalHoursWorked[0]?.totalHours || 0,
      },
      employmentStatus: user.employmentStatus,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile.", details: err.message });
  }
};


exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    const user = await User.findById(userId).populate('profileId');
    if (!user) return res.status(404).json({ error: "User not found." });

    let profile = user.profileId;
    if (!profile) {
      profile = new Profile({ userId });
    }

    // Update common fields
    if (updates.dob) profile.dob = updates.dob;
    if (updates.gender) profile.gender = updates.gender;
    // if (updates.postalCode) profile.postalCode = updates.postalCode;

    // Update fields based on employment status
    switch (user.employmentStatus) {
      case 'Singaporean/Permanent Resident':
        if (updates.nricNumber) profile.nricNumber = updates.nricNumber;
        if (req.files?.nricFront?.[0]?.path || req.files?.nricBack?.[0]?.path) {
          profile.nricImages = {
            front: req.files?.nricFront?.[0]?.path || profile.nricImages?.front || null,
            back: req.files?.nricBack?.[0]?.path || profile.nricImages?.back || null,
          };
        }
        break;
      case 'Long Term Visit Pass Holder':
        if (updates.finNumber) profile.finNumber = updates.finNumber;
        if (req.files?.finFront?.[0]?.path || req.files?.finBack?.[0]?.path) {
          profile.finImages = {
            front: req.files?.finFront?.[0]?.path || profile.finImages?.front || null,
            back: req.files?.finBack?.[0]?.path || profile.finImages?.back || null,
          };
        }
        if (req.files?.plocImage?.[0]?.path) profile.plocImage = req.files.plocImage[0].path;
        if (updates.plocExpiryDate) profile.plocExpiryDate = updates.plocExpiryDate;
        break;
      case 'Student Pass':
        if (updates.studentIdNumber) profile.studentIdNumber = updates.studentIdNumber;
        if (updates.schoolName) profile.schoolName = updates.schoolName;
        if (req.files?.studentCard?.[0]?.path) profile.studentCardImage = req.files.studentCard[0].path;
        break;
    }

    // Update the selfie/profile picture if uploaded
    if (req.files?.selfie?.[0]?.path) {
      user.profilePicture = req.files.selfie[0].path;
    }

    await profile.save();
    await user.save();

    res.status(200).json({
      message: "Profile updated successfully.",
      profile,
      profilePicture: user.profilePicture,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile.", details: err.message });
  }
};

exports.getProfileStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch the user and their profile
    const user = await User.findById(userId).populate("profileId").populate("eWallet");
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Unified response object
    const response = {
      profilePicture: user.profilePicture || "/static/image.png",
      wallet: {
        id: user.eWallet ? user.eWallet._id : null,
        balance: user.eWallet ? user.eWallet.balance : 0,
      },
      username: user.fullName || "Unknown User",
    };

    // Handle Incomplete Profile
    if (!user.profileCompleted) {
      response.stats = {
        age: "--",
        gender: "NIL",
        totalHoursWorked: "-- Hrs",
      };
      response.message = "Complete your profile to unlock all stats.";
    } else {
      // Fetch Completed Jobs
      const totalCompletedJobs = await Application.countDocuments({
        userId: userId,
        status: "Completed",
      });

      // Fetch Cancelled Jobs
      const totalCancelledJobs = await Application.countDocuments({
        userId: userId,
        status: "Cancelled",
      });

      // Fetch No-Show Jobs
      const noShowJobs = await Application.countDocuments({
        userId: userId,
        status: "No Show",
      });

      // Aggregate Total Hours Worked
      const totalHoursWorked = await Application.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            status: "Completed",
          },
        },
        {
          $lookup: {
            from: "jobs",
            localField: "jobId",
            foreignField: "_id",
            as: "jobDetails",
          },
        },
        { $unwind: "$jobDetails" },
        { $unwind: "$jobDetails.dates" },
        { $unwind: "$jobDetails.dates.shifts" },
        {
          $group: {
            _id: null,
            totalHours: { $sum: "$jobDetails.dates.shifts.duration" },
          },
        },
      ]);

      // Fetch Recent Past Jobs
      // const recentPastJobs = await Application.find({ userId })
      //   .sort({ createdAt: -1 })
      //   .limit(5)
      //   .populate({
      //     path: "jobId",
      //     select: "jobName subtitle subtitleIcon location employer dates",
      //     populate: {
      //       path: "employer",
      //       select: "companyName",
      //     },
      //   });

      // Format Recent Past Jobs
      // const formattedPastJobs = recentPastJobs.map((job) => ({
      //   jobName: job.jobId?.jobName || "Unknown",
      //   subtitle: job.jobId?.subtitle || "Unknown",
      //   subtitleIcon: job.jobId?.subtitleIcon || "/static/image.png",
      //   location: job.jobId?.location || "Unknown Location",
      //   duration: `${job.jobId?.dates?.[0]?.shifts?.[0]?.duration || "N/A"} hrs`,
      //   status: job.status || "N/A",
      //   companyName: job.jobId?.employer?.companyName || "Unknown Employer",
      //   date: job.createdAt,
      // }));

      // Calculate Demerit Points (e.g., $5 per No-Show Job)
      const demeritPoints = noShowJobs * 5;

      // Add Complete Profile Data to the Response
      Object.assign(response, {
        accountStatus: user.status, // Hardcoded as verified for now
        rating: 4.8, // Example rating
        id: user._id,
        profileCompleted: user.profileCompleted,
        phoneNumber: user.phoneNumber,
        joinDate: user.createdAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
        }),
        stats: {
          age: user.profileId?.dob
            ? new Date().getFullYear() - new Date(user.profileId.dob).getFullYear()
            : "--",
          gender: user.profileId?.gender || "NIL",
          totalCompletedJobs: totalCompletedJobs || 0,
          totalCancelledJobs: totalCancelledJobs || 0,
          noShowJobs: noShowJobs || 0,
          totalHoursWorked: totalHoursWorked[0]?.totalHours || 0,
        },
        demeritPoints: demeritPoints || 0,
        // recentPastJobs: formattedPastJobs,
      });
    }

    // Send the response
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile stats.", details: err.message });
  }
};






exports.getWalletDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.status(200).json({
      eWallet: {
        balance: user.eWallet.balance,
        transactions: user.eWallet.transactions,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch wallet details.", details: err.message });
  }
};

exports.cashOut = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (amount > user.eWallet.balance) {
      return res.status(400).json({ error: "Insufficient balance." });
    }

    user.eWallet.balance -= amount;

    // Record the transaction
    user.eWallet.transactions.push({
      type: "Debit",
      amount,
      description: "Cash out",
    });

    await user.save();

    res.status(200).json({ message: "Cash out successful.", balance: user.eWallet.balance });
  } catch (err) {
    res.status(500).json({ error: "Failed to process cash out.", details: err.message });
  }
};

exports.addCreditToWallet = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, description } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    user.eWallet.balance += amount;

    // Record the transaction
    user.eWallet.transactions.push({
      type: "Credit",
      amount,
      description: description || "Credit added",
    });

    await user.save();

    res.status(200).json({ message: "Credit added successfully.", balance: user.eWallet.balance });
  } catch (err) {
    res.status(500).json({ error: "Failed to add credit.", details: err.message });
  }
};
