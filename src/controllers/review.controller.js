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

    const reviews = await Review.find({ listingId: postId, isPublic:true });

    res.status(200).json({
        success: true,
        count: reviews.length,
        data: reviews
    });
});

export { addReview, getReviewsByListingId }

