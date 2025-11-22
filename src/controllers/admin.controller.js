import AsyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import User from "../models/user.model.js";
import Listing from "../models/listing.model.js";

// GET /api/v1/admin/users?page=1&limit=20&search=foo
const listUsers = AsyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.max(parseInt(req.query.limit || "20", 10), 1);
  const search = (req.query.search || "").trim();

  const filter = {};
  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [{ email: regex }, { fullName: regex }, { username: regex }];
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select("-password -refreshToken -passwordResetToken -passwordResetExpires")
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ _id: -1 });

  return res.status(200).json({ success: true, data: { users, total, page, limit } });
});

// PATCH /api/v1/admin/users/:id/role  { isAdmin: true }
const updateUserRole = AsyncHandler(async (req, res) => {
  const userId = req.params.id;
  const { isAdmin } = req.body;

  if (typeof isAdmin !== "boolean") {
    throw new ApiError(400, "isAdmin must be boolean");
  }

  const user = await User.findByIdAndUpdate(userId, { $set: { isAdmin } }, { new: true }).select("-password -refreshToken");
  if (!user) throw new ApiError(404, "User not found");

  return res.status(200).json({ success: true, data: { user }, message: "User role updated" });
});

// DELETE /api/v1/admin/users/:id
const deleteUser = AsyncHandler(async (req, res) => {
  const userId = req.params.id;
  const user = await User.findByIdAndDelete(userId).select("-password -refreshToken");
  if (!user) throw new ApiError(404, "User not found");

  return res.status(200).json({ success: true, data: { user }, message: "User deleted" });
});

// GET /api/v1/admin/listings?page=1&limit=20&search=
const listListings = AsyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.max(parseInt(req.query.limit || "20", 10), 1);
  const search = (req.query.search || "").trim();

  const filter = {};
  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [{ name: regex }, { description: regex }, { tags: regex }];
  }

  const total = await Listing.countDocuments(filter);
  const listings = await Listing.find(filter)
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ _id: -1 });

  return res.status(200).json({ success: true, data: { listings, total, page, limit } });
});

// PATCH /api/v1/admin/listings/:id/verify  { isVerified: true }
const verifyListing = AsyncHandler(async (req, res) => {
  const id = req.params.id;
  const { isVerified } = req.body;
  if (typeof isVerified !== "boolean") {
    throw new ApiError(400, "isVerified must be boolean");
  }

  const listing = await Listing.findByIdAndUpdate(id, { $set: { isVerified } }, { new: true });
  if (!listing) throw new ApiError(404, "Listing not found");

  return res.status(200).json({ success: true, data: { listing }, message: "Listing verification updated" });
});

// DELETE /api/v1/admin/listings/:id
const deleteListing = AsyncHandler(async (req, res) => {
  const id = req.params.id;
  const listing = await Listing.findByIdAndDelete(id);
  if (!listing) throw new ApiError(404, "Listing not found");

  return res.status(200).json({ success: true, data: { listing }, message: "Listing deleted" });
});

export {
  listUsers,
  updateUserRole,
  deleteUser,
  listListings,
  verifyListing,
  deleteListing,
};
