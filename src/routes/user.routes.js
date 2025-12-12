import express from "express"
import "dotenv/config";
import {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    refreshAccessToken,
    changeCurrentPassword,
    generatePasswordResetToken,
    verifyPasswordResetToken,
    resetPassword,
    googleAuthCallback,
} from "../controllers/user.controller.js"
import { verifyJWT } from "../controllers/auth.controller.js";
const router = express.Router();

import passport from "passport";


router
    .route("/register")
    .post(registerUser);

router
    .route("/login")
    .post(loginUser);

router
    .route("/logout")
    .post(logoutUser);
router
    .route("/me")
    .get(verifyJWT, getCurrentUser);
router
    .route("/refresh-token")
    .get(refreshAccessToken);
router
    .route("/change-password")
    .post(verifyJWT, changeCurrentPassword);

// Password reset (validate token and perform reset)
router
    .route("/reset-password/:id/:token")
    .get(verifyPasswordResetToken)
    .post(resetPassword);

router
    .route("/forgot-password")
    .post(generatePasswordResetToken);

// Google OAuth routes
router
    .route("/auth/google")
    .get(passport.authenticate("google", { scope: ["profile", "email"], session: false }));


const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((s) => s.trim()).filter(Boolean)
    : defaultAllowed;

const primaryFrontendUrl = allowedOrigins[0];

router
    .route("/auth/google/callback")
    .get(
        passport.authenticate("google", { session: false, failureRedirect: `${primaryFrontendUrl}/login` }),
        googleAuthCallback
    );

export default router;