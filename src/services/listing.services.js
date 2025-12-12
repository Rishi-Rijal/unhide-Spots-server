import Listing from '../models/listing.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import mongoose from 'mongoose';
import { decodeCursor, encodeCursor } from '../utils/cursor.js';
import {
	buildMatchStage,
	buildSortStage,
	buildCursorStage,
	generateNextCursorData
} from './pipelines.services.js';
import { removeImages } from '../utils/uploadCloudinary.js';

const createListingService = async (data) => {
    const {
        author, name, description, categories,
        tags, latitude, longitude, permitsRequired,
        permitsDescription, bestSeason, difficulty,
        extraAdvice, physicalAddress, uploadedImages
    } = data;

    const location = {
        type: 'Point',
        coordinates: [longitude, latitude]
    };

    try {
        const newListing = await Listing.create({
            name,
            description,
            categories,
            tags,
            location,
            bestSeason,
            difficulty,
            permitsRequired,
            permitsDescription,
            physicalAddress,
            extraAdvice,
            author,
            images: uploadedImages,
        });

        const userUpdate = await User.findByIdAndUpdate(
            author,
            { $push: { listings: newListing._id } },
            { new: true }
        );

        if (!userUpdate) {
            await Listing.findByIdAndDelete(newListing._id);
            throw new ApiError(404, "User not found");
        }

        return newListing;
    } catch (error) {
        throw error;
    } 
};

const getListingService = async (listingId, userId) => {
	const listing = await Listing.findById(listingId) // .populate('author', 'username profilePicture');
	if (!listing) {
		throw new ApiError(404, 'Listing not found');
	}
	const likedByUser = userId && Array.isArray(listing.likedBy)
		? listing.likedBy.some((uid) => uid.toString() === userId.toString())
		: false;

	const result = listing.toObject({ getters: true });
	result.likedByUser = likedByUser;
	return result;
}

const deleteListingService = async (listingId) => {
	const deletedListing = await Listing.findByIdAndDelete(listingId);
	if (!deletedListing) {
		throw new ApiError(404, 'Listing not found');
	}	
	if (Array.isArray(deletedListing.images) && deletedListing.images.length) {
		const removalErrors = [];
		await Promise.all(
			deletedListing.images.map(async (img) => {
				try {
					await removeImages([{ public_id: img.public_id }]);
				} catch (err) {
					removalErrors.push({ public_id: img.public_id, error: err?.message || err });
					console.error('Error removing image from Cloudinary for', img.public_id, err);
				}
			})
		);
		if (removalErrors.length) {
			// attach non-fatal removal errors to the returned object for diagnostics
			deletedListing._imageRemovalErrors = removalErrors;
		}
	}

	return deletedListing;
};

const getFilteredListingsService = async (filters) => {
	const {
		lat, lng, distanceKm, sort, limit = 10, cursor
	} = filters;

	const hasGeoPoint = typeof lat === "number" && typeof lng === "number";
	if (sort === "distance" && !hasGeoPoint) {
		throw new ApiError(400, "lat and lng are required for distance sort");
	}

	const decodedCursor = cursor ? decodeCursor(cursor) : null;
	if (cursor && !decodedCursor) throw new ApiError(400, "Invalid cursor");

	// pipeline helpers
	const matchStage = buildMatchStage(filters);
	const cursorMatchStage = buildCursorStage(decodedCursor, sort);
	const sortStage = buildSortStage(sort);

	// Aggregation Pipeline
	const pipeline = [];
	const shouldRunGeoNear = (hasGeoPoint && distanceKm > 0) || sort === "distance";

	if (shouldRunGeoNear) {
		pipeline.push({
			$geoNear: {
				near: { type: "Point", coordinates: [lng, lat] },
				distanceField: "distanceMeters",
				spherical: true,
				key: "location",
				maxDistance: (distanceKm || 10000) * 1000,
				query: matchStage
			}
		});

		if (Object.keys(cursorMatchStage).length) {
			pipeline.push({ $match: cursorMatchStage });
		}
	} else {
		if (Object.keys(matchStage).length) pipeline.push({ $match: matchStage });
		if (Object.keys(cursorMatchStage).length) pipeline.push({ $match: cursorMatchStage });
	}

	pipeline.push({
		$project: {
			name: 1,
			description: { $substrCP: ["$description", 0, 240] },
			categories: 1,
			tags: 1,
			images: { $slice: ["$images", 1] },
			averageRating: 1,
			ratingsCount: 1,
			likesCount: 1,
			createdAt: 1,
			location: 1,
			physicalAddress: 1,
			...(shouldRunGeoNear ? { distanceMeters: 1 } : {}),
		},
	});

	pipeline.push({ $sort: sortStage });
	pipeline.push({ $limit: limit + 1 }); // Fetch one extra to detect next page

	const rows = await Listing.aggregate(pipeline).allowDiskUse(true);

	// Pagination Logic
	const hasNextPage = rows.length > limit;
	const data = hasNextPage ? rows.slice(0, limit) : rows;

	let nextCursor = null;
	if (hasNextPage && data.length > 0) {
		const lastItem = data[data.length - 1];
		const cursorData = generateNextCursorData(lastItem, sort);
		nextCursor = encodeCursor(cursorData);
	}

	return { data, nextCursor, hasNextPage };
};

const likeListingService = async (listingId, userId) => {
	if (!listingId) throw new ApiError(400, "id is required");

	const listing = await Listing.findById(listingId);
	if (!listing) throw new ApiError(404, "Listing not found");

	// If user is logged in, check if they have already liked the listing(soft verify is done using local storage on client)
	if (userId) {
		const alreadyLiked = Array.isArray(listing.likedBy) && listing.likedBy.some((uid) => uid.toString() === userId.toString());
		if (alreadyLiked) {
			return { message: "Already liked", data: listing };
		}
		listing.likedBy = listing.likedBy || [];
		listing.likedBy.push(mongoose.Types.ObjectId(userId));
	}
	await listing.updateOne({ $inc: { likesCount: 1 } });

	return { message: "Like added successfully", data: listing };
};

const unlikeListingService = async (listingId, userId) => {
	if (userId) {
		const userObjId = mongoose.Types.ObjectId(userId);
		const updatedListing = await Listing.findOneAndUpdate(
			{
				_id: listingId,
				likedBy: userObjId,
				likesCount: { $gt: 0 }
			},
			{
				$pull: { likedBy: userObjId },
				$inc: { likesCount: -1 }
			},
			{ new: true }
		);

		// If updatedListing is null, it means the listing was not found OR the user ID was not present
		if (!updatedListing) {
			const finalListing = await Listing.findById(listingId);
			if (!finalListing) throw new ApiError(404, "Listing not found");

			if (!finalListing.likedBy.some(uid => uid.toString() === userId.toString())) {
				return { message: "Not previously liked", data: finalListing };
			}

			return { message: "Like removed successfully (but count was 0)", data: finalListing };
		}

		return { message: "Like removed successfully", data: updatedListing };
	} else {
		const updatedListing = await Listing.findOneAndUpdate(
			{
				_id: listingId,
				likesCount: { $gt: 0 }
			},
			{ $inc: { likesCount: -1 } },
			{ new: true }
		);

		if (!updatedListing) throw new ApiError(404, "Listing not found or count already 0");

		return { message: "Anonymous unlike successful", data: updatedListing };
	}
}

const updateDescriptionService = async (listingId, description) => {
	const updatedListing = await Listing.findByIdAndUpdate(
		listingId,
		{ description },
		{ new: true }
	);
	if (!updatedListing) {
		throw new ApiError(400, "Listing not found");
	}

	return updatedListing;
};

const updateTipsService = async (listingId, updateData) => {
	const updatedListing = await Listing.findByIdAndUpdate(
		listingId,
		updateData,
		{ new: true }
	);
	if (!updatedListing) {
		throw new ApiError(400, "Listing not found");
	}
	return updatedListing;
};

const updateTitleService = async (listingId, title) => {
	const updatedListing = await Listing.findByIdAndUpdate(
		listingId,
		{ name: title },
		{ new: true }
	);

	if (!updatedListing) {
		throw new ApiError(400, "Listing not found");
	}

	return updatedListing;
};

const removeImageService = async (listingId, imagePublicId) => {
	const listing = await Listing.findByIdAndUpdate(
		listingId,
		{ $pull: { images: { public_id: imagePublicId } } },
		{ new: true });
	if (!listing) {
		throw new ApiError(400, "Listing not found");
	}
	await removeImages([{ public_id: imagePublicId }]);
	return listing;
};

const addImageService = async (listingId, uploadedImages) => {
	const listing = await Listing.findByIdAndUpdate(
		listingId,
		{ $push: { images: { $each: uploadedImages } } },
		{ new: true }
	)
	if (!listing) {
		throw new ApiError(400, "Listing not found");
	}
	return listing;
};

const updateLocationService = async (listingId, { latitude, longitude }) => {
	const location = {
		type: 'Point',
		coordinates: [longitude, latitude]
	};
	const updatedListing = await Listing.findByIdAndUpdate(
		listingId,
		{ location },
		{ new: true }
	);

	if (!updatedListing) {
		throw new ApiError(400, "Listing not found");
	}

	return updatedListing;
};

const updateTagsAndCategoriesService = async (listingId, updateData) => {
	const updatedListing = await Listing.findByIdAndUpdate(
		listingId,
		updateData,
		{ new: true }
	);
	if (!updatedListing) {
		throw new ApiError(400, "Listing not found");
	}
	return updatedListing;
};

const getAllListingsService = async () => {
	const listings = await Listing.find();
	return listings;
}

export {
	createListingService, getListingService, deleteListingService,
	getFilteredListingsService, likeListingService, unlikeListingService,
	updateDescriptionService, updateTipsService, updateTitleService,
	removeImageService, addImageService, updateLocationService,
	updateTagsAndCategoriesService, getAllListingsService,
};