import Review from "../models/review.model.js"
import asyncHandler from "../utils/asyncHandler.js"
import ApiError from "../utils/ApiError.js"
import Listing from "../models/listing.model.js"
import { addReviewService ,
    getReviewsByListingIdService,
    updateReviewService,
    deleteReviewService,
} from "../services/review.services.js"

const addReview = asyncHandler(async (req, res) => {

    const { postId } = req.params;
    const { userName, rating, reviewMsg, authorId } = req.body;
    if (!postId) {
        throw new ApiError(400, "Listing is required to add a review");
    }

    const newReview = await addReviewService(userName, rating, reviewMsg, authorId, postId);

    res.status(200).json({ message: "review added successfully", data: newReview });
})

const getReviewsByListingId = asyncHandler(async (req, res) => {
    const { postId } = req.params;

    if (!postId) {
        throw new ApiError(400, "Listing ID is required");
    }

    const reviews = await getReviewsByListingIdService(postId);
    res.status(200).json({
        success: true,
        count: reviews.length,
        data: reviews
    });
});

const updateReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const { rating, reviewMsg } = req.body;

    const updatedReview = await updateReviewService(reviewId, rating, reviewMsg);
    
    res.status(200).json({ message: "review updated successfully", data: updatedReview });
});

const deleteReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    await deleteReviewService(reviewId);
    res.status(200).json({ message: "review deleted successfully" });
});

export {
    addReview,
    getReviewsByListingId,
    updateReview,
    deleteReview
}

