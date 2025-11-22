import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import AsyncHandler from "../utils/asyncHandler.js";
import dotenv from "dotenv";
dotenv.config();
import nodemailer from "nodemailer";

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
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
        throw new ApiError(400, "All fields are required");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(400, "User with given email already exists");
    }
    
    const newUser = await User.create({ email, fullName: name, password, isAdmin: false });
    if (!newUser) throw new ApiError(500, "Failed to create user");

    // response
    const userResp = {
        _id: newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        isAdmin: newUser.isAdmin,
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(newUser._id);
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
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

    // ensure password is selected for verification
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.isPasswordCorrect(password))) {
        throw new ApiError(401, "Invalid email or password");
    }

    const loggedInUser = {
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        isAdmin: user.isAdmin,
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json({ success: true, data: loggedInUser, message: "User logged in successfully" });
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
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    };

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json({ success: true, data: {}, message: "User logged out successfully" });
});

const getCurrentUser = AsyncHandler(async (req, res) => {
    const loggedInUser = {
        _id: req.user._id,
        email: req.user.email,
        fullName: req.user.fullName,
        isAdmin: req.user.isAdmin,
    };
    return res.status(200).json({ success: true, data: { user: loggedInUser }, message: "User fetched successfully" });
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
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
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
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword) {
        throw new ApiError(400, "New password and confirm password must be same");
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) throw new ApiError(404, "User not found");
    const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);
    if (!isPasswordCorrect) throw new ApiError(400, "Invalid current password");

    // if (!newPassword || newPassword.length < 8) {
    //     throw new ApiError(400, "New password must be at least 8 characters long");
    // }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({ success: true, data: {}, message: "Password changed successfully" });
});

const generatePasswordResetToken = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(200).json({ success: true, message: "If that email is registered you will receive reset instructions." });
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${user._id}/${resetToken}`;
    console.log(`Password reset URL: ${resetUrl}`);


    const smtpPort = Number(process.env.SMTP_PORT) || 465;
    const smtpSecure = process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE === "true"
        : smtpPort === 465;

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure: smtpSecure, 
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    const displayName = user.fullName || "there";
    const mailOptions = {
        from: `${process.env.EMAIL_FROM_NAME || "Unhide Nepal"} <${process.env.SMTP_EMAIL}>`,
        to: user.email,
        subject: "Reset your Unhide Nepal password",
        text: `Hi ${displayName},\n\nWe received a request to reset the password for your account. Use the link below to set a new password (this link expires soon):\n\n${resetUrl}\n\nIf you didn't request this, please ignore this email or contact support.\n\n— The Unhide Nepal Team`,
        html: `
                <!doctype html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width,initial-scale=1">
                </head>
                <body style="margin:0;padding:0;background:#f4f6f8;font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;">
                    <span style="display:none;max-height:0;overflow:hidden;">Reset your Unhide Nepal password</span>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:20px 0;">
                        <tr>
                            <td align="center">
                                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,0.08);">
                                    <tr>
                                        <td style="padding:24px 32px;border-bottom:1px solid #eef2f5;">
                                            <h1 style="margin:0;font-size:20px;color:#111827;">Reset your password</h1>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:28px 32px;color:#374151;line-height:1.6;font-size:15px;">
                                            <p style="margin:0 0 12px 0;">Hi ${displayName},</p>
                                            <p style="margin:0 0 18px 0;">We received a request to reset your Unhide Nepal password. Click the button below to choose a new password. This link will expire in 10 minutes for your security.</p>

                                            <p style="text-align:center;margin:22px 0;">
                                                <a href="${resetUrl}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:600;">Reset password</a>
                                            </p>

                                            <p style="margin:0 0 8px 0;color:#6b7280;font-size:13px;">Or copy and paste this link into your browser:</p>
                                            <p style="word-break:break-all;margin:0 0 18px 0;color:#374151;font-size:13px;"><a href="${resetUrl}" style="color:#2563eb;text-decoration:underline;">${resetUrl}</a></p>

                                            <p style="margin:0;color:#6b7280;font-size:13px;">If you did not request a password reset, you can safely ignore this email. If you have questions, reply to this email or contact our support.</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:18px 32px;background:#fafafa;border-top:1px solid #eef2f5;color:#9ca3af;font-size:13px;">
                                            <div style="display:flex;justify-content:space-between;align-items:center;"> 
                                                <div>© ${new Date().getFullYear()} Unhide Nepal</div>
                                                <div><a href="${process.env.FRONTEND_URL || '#'}" style="color:#6b7280;text-decoration:none;">Visit site</a></div>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
                `,
    };

    const info = await transporter.sendMail(mailOptions);

    return res.status(200).json({ success: true, message: "If that email is registered you will receive reset instructions." });
}

const verifyPasswordResetToken = AsyncHandler(async (req, res) => {
    const { id, token } = req.params;
    if (!id || !token) throw new ApiError(400, "Invalid password reset link");

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
        _id: id,
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) throw new ApiError(400, "Invalid or expired password reset token");

    return res.status(200).json({ success: true, message: "Token is valid" });
});

const resetPassword = AsyncHandler(async (req, res) => {
    const { id, token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) throw new ApiError(400, "Password and confirm password are required");
    if (password !== confirmPassword) throw new ApiError(400, "Passwords must match");

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
        _id: id,
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
    }).select("+password");

    if (!user) throw new ApiError(400, "Invalid or expired password reset token");

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.status(200).json({ success: true, message: "Password has been reset successfully" });
});

const cookieOptionsForOAuth = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};

const googleAuthCallback = AsyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, "Authentication failed");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptionsForOAuth)
    .cookie("refreshToken", refreshToken, cookieOptionsForOAuth)
    .redirect(`${process.env.FRONTEND_URL}/auth/success`);
});

export {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    refreshAccessToken,
    changeCurrentPassword,
    verifyPasswordResetToken,
    resetPassword,
    generatePasswordResetToken,
    googleAuthCallback,
};