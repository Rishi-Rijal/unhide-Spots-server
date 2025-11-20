import express from "express"
import {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    refreshAccessToken,
    changeCurrentPassword
} from "../controllers/user.controller.js"
const router = express.Router();


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
    .get(getCurrentUser);
router
    .route("/refresh-token")
    .get(refreshAccessToken);
router
    .route("/change-password")
    .post(changeCurrentPassword);

export default router;