const jwt = require("jsonwebtoken");

const createToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET,{
    expiresIn: '24h' // Token expires in 1 hour
  });
};

const setCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const clearCookie = (res) => {
  res.clearCookie("token", {
    httpOnly: true,
    // secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  });
};

module.exports = {createToken, setCookie, clearCookie};