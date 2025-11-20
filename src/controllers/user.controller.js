import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import AsyncHandler from "../utils/asyncHandler.js";
import { tr } from "zod/v4/locales";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) throw new Error("User not found for token generation");

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens");
    }
};

const registerUser = AsyncHandler(async (req, res) => {
    const { email, username, fullName, password } = req.body;
    if (!email || !username || !fullName || !password) {
        throw new ApiError(400, "All fields are required");
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
        throw new ApiError(400, "User with given email or username already exists");
    }

    const newUser = await User.create({ email, username, fullName, password });
    if (!newUser) throw new ApiError(500, "Failed to create user");

    // Prepare response user without password
    const userResp = {
        _id: newUser._id,
        email: newUser.email,
        username: newUser.username,
        fullName: newUser.fullName,
    };

    // Optionally generate tokens and set cookies on registration
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(newUser._id);
    const cookieOptions = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(201)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json({ success: true, data: { user: userResp }, message: "User created successfully" });
});

const loginUser = AsyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.isPasswordCorrect(password))) {
        throw new ApiError(401, "Invalid email or password");
    }

    const loggedInUser = {
        _id: user._id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const cookieOptions = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json({ success: true, data: { user: loggedInUser }, accessToken, refreshToken, message: "User logged in successfully" });
});

const logoutUser = AsyncHandler(async (req, res) => {
    if (req.user?._id) {
        await User.findByIdAndUpdate(
            req.user._id,
            { $set: { refreshToken: undefined } },
            { new: true }
        );
    }

    const cookieOptions = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json({ success: true, data: {}, message: "User logged out successfully" });
});

const getCurrentUser = AsyncHandler(async (req, res) => {
    return res.status(200).json({ success: true, data: { user: req.user }, message: "User fetched successfully" });
});

const refreshAccessToken = AsyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id);

        if (!user) throw new ApiError(401, "Invalid refresh token");

        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or already used");
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

        const cookieOptions = {
            httpOnly: true,
            secure: true,
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json({ success: true, data: { accessToken }, message: "Token refreshed successfully" });
    } catch (error) {
        throw new ApiError(400, error?.message || "Invalid refresh token");
    }
});

const changeCurrentPassword = AsyncHandler(async (req, res) => {
    const { oldPassword, newPassword, confPassword } = req.body;
    if (newPassword !== confPassword) {
        throw new ApiError(400, "New password and confirm password must be same");
    }

    const user = await User.findById(req.user._id);
    if (!user) throw new ApiError(404, "User not found");

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) throw new ApiError(400, "Invalid old password");

    // if (!newPassword || newPassword.length < 8) {
    //     throw new ApiError(400, "New password must be at least 8 characters long");
    // }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({ success: true, data: {}, message: "Password changed successfully" });
});

export {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    refreshAccessToken,
    changeCurrentPassword,
};