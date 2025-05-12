const express = require("express");
const { registerUser, getAllUsers, getUserByEmail, loginUser, updateUser, logoutUser, authenticated }= require("../controllers/userController");
// const { auth } = require("../middlewares/auth");
const {authMiddleware, adminOnlyMiddleware} = require('../middlewares/auth');
const router = express.Router();
// const { authenticated } = require('../controllers/userController');
//router.use(authMiddleware, adminOnlyMiddleware);
// Routes
router.post("/register", registerUser);
router.get("/", getAllUsers);
router.get("/:email", getUserByEmail);
router.post("/login", loginUser);
// router.get('/authenticated', authMiddleware,  userController.authenticated);
router.get('/authenticated/auth', authMiddleware, authenticated);
router.patch("/:id", updateUser);
router.post("/logout",authMiddleware, adminOnlyMiddleware, logoutUser);
router.get("/me", authMiddleware, authenticated);

module.exports = router;