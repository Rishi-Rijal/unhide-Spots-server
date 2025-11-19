import Review from "../models/review.model.js"
import asyncHandler from "../utils/asyncHandler.js"
import ApiError from "../utils/ApiError.js"
import Listing from "../models/listing.model.js"

// const id = new mongoose.Types.ObjectId();

const addReview = asyncHandler(async (req, res) => {

    const { postId } = req.params;
    const { userName, rating, reviewMsg } = req.body;
    if (!postId) {
        throw new ApiError(400, "Listing is required to add a review");
    }


    const updatedListing = await Listing.findByIdAndUpdate(
        postId,
        [
            {
                $set: {
                    ratingsCount: {
                        $add: [
                            { $ifNull: ["$ratingsCount", 0] },
                            1
                        ]
                    },

                    averageRating: {
                        $divide: [
                            {
                                $add: [
                                    {
                                        $multiply: [
                                            { $ifNull: ["$averageRating", 0] },
                                            { $ifNull: ["$ratingsCount", 0] }
                                        ]
                                    },
                                    rating
                                ]
                            },
                            {
                                $add: [
                                    { $ifNull: ["$ratingsCount", 0] },
                                    1
                                ]
                            }
                        ]
                    }
                }
            }
        ],
        { new: true }
    );


    if (!updatedListing) {
        throw new ApiError(400, "cannot add review for the listing");
    }

    const newReview = await Review.create({
        listingId: postId,
        userName,
        rating,
        reviewMsg
    });

    const createdReview = await Review.findById(newReview._id);

    if (!createdReview) {
        throw new ApiError(500, "Some problem while adding the review. Please try again later")
    }
    res.status(200).json({ message: "review added successfully", data: createdReview });
})

const getReviewsByListingId = asyncHandler(async (req, res) => {
    const { postId } = req.params;

    if (!postId) {
        throw new ApiError(400, "Listing ID is required");
    }

    const reviews = await Review.find({ listingId: postId, isPublic: true });

    res.status(200).json({
        success: true,
        count: reviews.length,
        data: reviews
    });
});

const updateReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const { rating, reviewMsg } = req.body;
    const review = await Review.findById(reviewId);

    if (!review) {
        throw new ApiError(404, "Review not found");
    }
    review.rating = rating || review.rating;
    review.reviewMsg = reviewMsg || review.reviewMsg;
    await review.save();
    // Recompute listing averages after the review update
    try {
        const listingId = review.listingId;
        const reviews = await Review.find({ listingId, isPublic: true });
        const count = reviews.length;
        const avg = count ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / count : 0;
        await Listing.findByIdAndUpdate(listingId, { averageRating: Math.round(avg * 10) / 10, ratingsCount: count });
    } catch (e) {
        throw new ApiError(500, "Failed to recompute listing stats after review update");
    }

    res.status(200).json({ message: "review updated successfully", data: review });
});

const deleteReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const review = await Review.findByIdAndUpdate(reviewId,
        { isPublic: false },
        { new: true });
    if (!review) {
        throw new ApiError(404, "Review not found");
    }
    try {
        const listingId = review.listingId;
        const reviews = await Review.find({ listingId, isPublic: true });
        const count = reviews.length;
        const avg = count ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / count : 0;
        await Listing.findByIdAndUpdate(listingId, { averageRating: Math.round(avg * 10) / 10, ratingsCount: count });
    } catch (e) {
        throw new ApiError(500, "Failed to recompute listing stats after review delete");
    }

    res.status(200).json({ message: "review deleted successfully" });
});

export {
    addReview,
    getReviewsByListingId,
    updateReview,
    deleteReview
}

