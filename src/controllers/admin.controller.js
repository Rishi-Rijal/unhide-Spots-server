import AsyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import User from "../models/user.model.js";
import Listing from "../models/listing.model.js";
import "dotenv/config";
import { getAllUsersService, updateRoleService,
	deleteUserService, getAllUserService,
	verifyListingService,
 } from "../services/admin.services.js";

const listUsers = AsyncHandler(async (req, res) => {
	const currPage = Math.max(parseInt(req.query.page || "1", 10), 1);
	const currLimit = Math.max(parseInt(req.query.limit || "20", 10), 1);
	const search = (req.query.search || "").trim();

	const { users, total, page, limit } = await getAllUsersService(currPage, currLimit, search);

	return res.status(200).json({ success: true, data: { users, total, page, limit } });
});

const updateUserRole = AsyncHandler(async (req, res) => {
	const userId = req.params.id;
	const { isAdmin } = req.body;

	if (typeof isAdmin !== "boolean") {
		throw new ApiError(400, "isAdmin must be boolean");
	}
	const user = await updateRoleService(userId, isAdmin);

	return res.status(200).json({ success: true, data: user, message: "User role updated" });
});

const deleteUser = AsyncHandler(async (req, res) => {
	const userId = req.params.id;
	const user = await deleteUserService(userId);

	return res.status(200).json({ success: true, data: user, message: "User deleted" });
});

const listListings = AsyncHandler(async (req, res) => {
	const currPage = Math.max(parseInt(req.query.page || "1", 10), 1);
	const currLimit = Math.max(parseInt(req.query.limit || "20", 10), 1);
	const search = (req.query.search || "").trim();

	const { listings, total, page, limit } = await getAllUserService(currPage, currLimit, search);
	return res.status(200).json({ success: true, data: { listings, total, page, limit } });
});

const verifyListing = AsyncHandler(async (req, res) => {
	const id = req.params.id;
	const { isVerified } = req.body;
	if (typeof isVerified !== "boolean") {
		throw new ApiError(400, "isVerified must be boolean");
	}

	const listing = await verifyListingService(id, isVerified);

	return res.status(200).json({ success: true, data: listing, message: "Listing verification updated" });
});

const deleteListing = AsyncHandler(async (req, res) => {
	const id = req.params.id;
	const listing = await deleteListingService(id);

	return res.status(200).json({ success: true, data: listing, message: "Listing deleted" });
});

export {
	listUsers,
	updateUserRole,
	deleteUser,
	listListings,
	verifyListing,
	deleteListing,
};
