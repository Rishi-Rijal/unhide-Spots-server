import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import AsyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import Listing from "../models/listing.model.js";
import "dotenv/config";


const verifyJWT = AsyncHandler(async (req, res, next) => {
  const token = req.cookies?.accessToken;
  if (!token) {
    throw new ApiError(401, "No access token provided");
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded?._id).select("-password -refreshToken");

    if (!user) {
      throw new ApiError(401, "User not found for provided token");
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new ApiError(401, "Access token expired");
    }
    if (err.name === "JsonWebTokenError") {
      throw new ApiError(401, "Invalid access token");
    }

    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(500, "Internal server error");
  }
});

const verifyAdmin = AsyncHandler(async (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        throw new ApiError(403, "Forbidden: Admins only");
    }
});

const verifyOwner = AsyncHandler(async (req, res, next) => {
  const resourceId = req.params.id;
  const resource = await Listing.findById(resourceId);

  if (!resource) {
    throw new ApiError(404, "Resource not found");
  }

  if (resource.author.toString() === req.user._id.toString()) {
    next();
  } else {
    throw new ApiError(403, "Forbidden: Owners only");
  }
});

// Allow either an admin OR the owner of the resource to proceed.
const verifyAdminOrOwner = AsyncHandler(async (req, res, next) => {
  const resourceId = req.params.id;
  const resource = await Listing.findById(resourceId);

  if (!resource) {
    throw new ApiError(404, "Resource not found");
  }
  
  // Check if author and user._id exist before calling toString
  const isOwner = req.user && req.user._id && resource.author && resource.author.toString() === req.user._id.toString();
  const isAdmin = req.user && req.user.isAdmin;

  if (isAdmin || isOwner) {
    return next();
  }

  throw new ApiError(403, "Forbidden: Admin or Owner required");
});

export { verifyJWT, verifyAdmin, verifyOwner, verifyAdminOrOwner }