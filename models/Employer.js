const mongoose = require("mongoose");

const EmployerSchema = new mongoose.Schema(
  {
    companyLogo: { type: String, default: '/static/companyLogo.png' },
    companyLegalName: { type: String, required: true },
    hqAddress: { type: String, required: true },
    companyNumber: { type: String, unique: true },
    companyEmail: { type: String, required: true, unique: true },
    mainContactPersonName: { type: String },
    mainContactPersonPosition: { type: String },
    mainContactPersonNumber: { type: String },
    uploadCertificate: { type: String },
    accountManager: { type: String },
    industry: { type: String, enum: ["Retail", "Hospitality", "IT", "Healthcare"] },
    contractStartDate: { type: Date },
    contractEndDate: { type: Date },
    contractStatus: { type: String, enum: ["Active", "In Discussion", "Expired"], default: "In Discussion" },
    serviceAgreement: { type: String, enum: ["Completed", "Pending"], default: "Pending" }, // ✅ New Field
    jobPostingLimit: { type: Number, default: 50 }, // ✅ New Field
    outlets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Outlet" }],
    createdAt: { type: Date, default: Date.now },
  });

module.exports = mongoose.model("Employer", EmployerSchema);

