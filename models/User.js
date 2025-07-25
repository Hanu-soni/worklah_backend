const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    employmentStatus: { type: String, enum: ["Singaporean/Permanent Resident", "Long Term Visit Pass Holder", "Student Pass", "No Valid Work Pass"], required: true },
    profileCompleted: { type: Boolean, default: false },
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: "Profile" },
    applications: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Application' }],
    profilePicture: {
      type: String,
      default: '/static/image.png',
    },
    role: { type: String, enum: ['ADMIN', 'USER'], default: 'USER' },
    eWallet: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet" },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    verificationAction: {
      type: String,
      enum: ['Approved', 'Rejected', null],
      default: null
    },
    rejectionReason: {
      type: String,
      default: ""
    },
    status: { type: String, enum: ['Verified', 'Pending', 'Rejected', 'Incomplete Profile', 'Activated'], default: 'Incomplete Profile' },
    foodHygieneCert:{type: String},
    selfie:{type:String},
    nricFront:{type:String},
    nricBack:{type:String},
    finFront:{type:String},
    finBack:{type:String},
    plocImage:{type:String},
    studentCard:{type:String},
    plocExpiry:{type:String},
    studentId:{type:String},
    nricNo:{type:String},
    activatedHustle:{type:Boolean,default:false}
  });

module.exports = mongoose.model('User', userSchema);
