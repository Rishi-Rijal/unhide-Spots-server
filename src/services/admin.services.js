import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import Listing from '../models/listing.model.js';

const getAllUsersService = async (currPage = 1, currLimit = 20, search = "") => {
    const filter = {};
    if (search) {
        const regex = new RegExp(search, "i");
        filter.$or = [{ email: regex }, { fullName: regex }, { username: regex }];
    }
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
        .select("-password -refreshToken -passwordResetToken -passwordResetExpires")
        .skip((currPage - 1) * currLimit)
        .limit(currLimit)
        .sort({ _id: -1 });
    return { users, total, page: currPage, limit: currLimit };
}

const updateRoleService = async (userId, isAdmin) => {
    const user = await User.findByIdAndUpdate(userId, { $set: { isAdmin } }, { new: true }).select("-password -refreshToken");
    if (!user) throw new ApiError(404, "User not found");
    return user;
}

const deleteUserService = async (userId) => {
    const user = await User.findByIdAndDelete(userId).select("-password -refreshToken");
    if (!user) throw new ApiError(404, "User not found");
    return user;
}

const getAllUserService = async (currPage, currLimit, search = "") => {
    const filter = {};
    if (search) {
        const regex = new RegExp(search, "i");
        filter.$or = [{ name: regex }, { description: regex }, { tags: regex }];
    }

    const total = await Listing.countDocuments(filter);
    const listings = await Listing.find(filter)
        .skip((currPage - 1) * currLimit)
        .limit(currLimit)
        .sort({ _id: -1 });
    return { listings, total, page: currPage, limit: currLimit };
}

const verifyListingService = async (id, isVerified) => {
    const listing = await Listing.findByIdAndUpdate(id, { $set: { isVerified } }, { new: true });
    if (!listing) throw new ApiError(404, "Listing not found");
    return listing;
}

const deleteListingService = async (listingId) => {
    const listing = await Listing.findByIdAndDelete(listingId);
    if (!listing) {
        throw new ApiError(404, 'Listing not found');
    }
    return listing;
}

export {
    getAllUsersService,
    updateRoleService,
    deleteUserService,
    getAllUserService,
    verifyListingService,
    deleteListingService
};