import Listing from '../models/listing.model.js';
import ApiError from '../utils/ApiError.js';
import AsyncHandler from "../utils/asyncHandler.js"
import { uploadImages } from '../utils/uploadCloudinary.js';
import { createListingSchema, filterListingsSchema, tipsSchema } from '../schemas/listing.schema.js';
import sendEmail from '../utils/sendEmail.js';
import {
	createListingService,
	getListingService,
	deleteListingService,
	getFilteredListingsService,
	likeListingService,
	unlikeListingService,
	updateDescriptionService,
	updateTipsService,
	updateTitleService,
	removeImageService,
	addImageService,
	updateLocationService,
	updateTagsAndCategoriesService,
} from '../services/listing.services.js';
import "dotenv/config";

const createListing = AsyncHandler(async (req, res) => {
	const author = req.user?._id;
	if (!author) {
		throw new ApiError(401, 'Unauthorized');
	}
	const parsedData = createListingSchema.safeParse({ ...req.body, author: author.toString() });
	if (!parsedData.success) {
		const errorMessage = parsedData.error.errors.map(e => e.message).join(', ');
		throw new ApiError(400, errorMessage);
	}
	const images = req.files?.images || [];
	const uploadedImages = await uploadImages(images);

	const newListing = await createListingService({ ...parsedData.data, uploadedImages });

	res.status(201).json({ message: 'Listing created successfully', data: newListing });
});


const getListing = AsyncHandler(async (req, res) => {
	const { id } = req.params;

	const listing = await getListingService(id, req.user?._id);
	res.status(200).json({ message: 'Listing retrieved successfully', data: listing });
});

const deleteListing = AsyncHandler(async (req, res) => {
	const { id } = req.params;

	await deleteListingService(id);
	res.status(200).json({ message: 'Listing deleted successfully', data: null });
});

const getListingFiltered = AsyncHandler(async (req, res) => {
	const parsed = filterListingsSchema.safeParse(req.query ?? {});
	if (!parsed.success) {
		const errorMessage = parsed.error.errors.map(e => e.message).join(', ');
		throw new ApiError(400, errorMessage);
	}
	const listingsData = await getFilteredListingsService(parsed.data);
	res.status(200).json({ message: 'Listings retrieved successfully', data: listingsData.data, nextCursor: listingsData.nextCursor, hasNextPage: listingsData.hasNextPage });

});

const likeListing = AsyncHandler(async (req, res) => {
	const { id } = req.params;
	const userId = req.user?.id || req.body?.userId || null;

	const liked = await likeListingService(id, userId);
	res.status(200).json(liked);
});

const unlikeListing = AsyncHandler(async (req, res) => {
	const { id } = req.params;
	if (!id) {
		throw new ApiError(400, "Listing ID is required");
	}
	const userId = req.user?.id || req.body?.userId || null;

	const unLiked = await unlikeListingService(id, userId);
	res.status(200).json(unLiked);
});

const updateDescription = AsyncHandler(async (req, res) => {
	const { id } = req.params;
	const { description } = req.body;
	if (!description) {
		throw new ApiError(400, 'Description is required');
	}

	const updatedListing = await updateDescriptionService(id, description);
	res.status(200).json({ message: "Description updated successfully", data: updatedListing });
});

const updateTips = AsyncHandler(async (req, res) => {
	const { id } = req.params;
	const parsed = tipsSchema.safeParse(req.body);
	if (!parsed.success) {
		const errorMessage = parsed.error.errors.map(e => e.message).join(', ');
		throw new ApiError(400, errorMessage);
	}
	const updateData = {};

	if (parsed.data.extraAdvice !== undefined) updateData.extraAdvice = parsed.data.extraAdvice;
	if (parsed.data.bestSeason !== undefined) updateData.bestSeason = parsed.data.bestSeason;
	if (parsed.data.difficulty !== undefined) updateData.difficulty = parsed.data.difficulty;
	if (parsed.data.permitsRequired !== undefined) updateData.permitsRequired = parsed.data.permitsRequired;
	if (parsed.data.permitsDescription !== undefined) updateData.permitsDescription = parsed.data.permitsDescription;

	const updatedListing = await updateTipsService(id, updateData);
	res.status(200).json({
		message: "Tips updated successfully",
		data: updatedListing
	});
});

const updateTitle = AsyncHandler(async (req, res) => {
	const { id } = req.params;
	const { title } = req.body;

	if (!title) {
		throw new ApiError(400, 'Title is required');
	}
	const updatedListing = await updateTitleService(id, title);

	res.status(200).json({ message: "Title updated successfully", data: updatedListing });
});

const removeImage = AsyncHandler(async (req, res) => {
	const { id } = req.params;
	const { public_id } = req.body;
	if (!public_id) {
		throw new ApiError(400, 'public_id is required');
	}
	const listing = await removeImageService(id, public_id);
	res.status(200).json({
		message: "Image removed successfully",
		data: listing
	});
});

const addImage = AsyncHandler(async (req, res) => {
	const { id } = req.params;
	const images = req.files?.images || [];
	if (images.length === 0) {
		throw new ApiError(400, 'At least one image is required');
	}
	const uploadedImages = await uploadImages(images);
	const listing = await addImageService(id, uploadedImages);

	res.status(200).json({
		message: "Image added successfully",
		data: listing
	});
});

const updateLocation = AsyncHandler(async (req, res) => {
	const { id } = req.params;
	const { latitude, longitude } = req.body;
	if (latitude === undefined || longitude === undefined) {
		throw new ApiError(400, 'Latitude and Longitude are required');
	}
	const updatedListing = await updateLocationService(id, { latitude, longitude });
	res.status(200).json({
		message: "Location updated successfully",
		data: updatedListing
	});
});

const updateTagsAndCategories = AsyncHandler(async (req, res) => {
	const { id } = req.params;
	const { tags, categories } = req.body;
	const updateData = {};
	if (tags !== undefined) updateData.tags = tags;
	if (categories !== undefined) updateData.categories = categories;
	const updatedListing = await updateTagsAndCategoriesService(id, updateData);
	res.status(200).json({
		message: "Tags and Categories updated successfully",
		data: updatedListing
	});
});

const sendSuggestionEmail = AsyncHandler(async (req, res) => {
	const { id } = req.params;
	const { field, suggestion, name = "", email = "" } = req.body;
	if (!field || !suggestion) {
		throw new ApiError(400, 'Field and suggestion are required');
	}

	const listing = await Listing.findById(id).populate('author', 'email fullName');
	if (!listing) {
		throw new ApiError(404, 'Listing not found');
	}
	const recipient = process.env.DEFAULT_EMAIL_TO;

	const allowedOrigins = process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(",").map((s) => s.trim()).filter(Boolean)
        : defaultAllowed;
    const primaryFrontendUrl = allowedOrigins[0];
	const listingUrl = `${primaryFrontendUrl}/listing/${id}`;


	const subject = `Suggestion for listing: ${listing.name} - ${field}`;
	const reporterInfo = (name || email) ? `${name}${email ? ` &lt;${email}&gt;` : ''}` : 'Anonymous';
	const text = `A suggestion was submitted for listing "${listing.name}" (ID: ${id}).\n\nField: ${field}\nSuggestion:\n${suggestion}\n\nReporter: ${reporterInfo}\n\n Email: ${email}\nListing: ${listingUrl}`;
	const html = `
		<p>A suggestion was submitted for listing <strong>${listing.name}</strong> (ID: ${id}).</p>
		<p><strong>Field:</strong> ${field}</p>
		<p><strong>Suggestion:</strong><br/>${suggestion.replace(/\n/g, '<br/>')}</p>
		<p><strong>Reporter:</strong> ${reporterInfo}</p>
		<p>Email: ${email}</p>
		<p><a href="${listingUrl}">View listing</a></p>
		`;

	const resp =await sendEmail(recipient, subject, text, html);
	return res.status(200).json({ success: true, message: 'Suggestion submitted' });
});

export {
	createListing,
	getListing,
	deleteListing,
	getListingFiltered,
	likeListing,
	unlikeListing,
	updateDescription,
	updateTips,
	updateTitle,
	updateLocation,
	removeImage,
	addImage,
	updateTagsAndCategories,
	sendSuggestionEmail,
};