import Listing from "../models/listing.model.js";
import Review from "../models/review.model.js";
import ApiError from "../utils/ApiError.js"
import mongoose from "mongoose";

const addReviewService = async (userName, rating, reviewMsg, authorId, postId) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const reviewPayload = {
            listingId: postId,
            userName,
            rating,
            reviewMsg,
            ...(authorId && { authorId })
        };

        const newReview = await Review.create([reviewPayload], { session });

        const updatedListing = await Listing.findByIdAndUpdate(
            postId,
            [
                {
                    $set: {
                        ratingsCount: {
                            $add: [{ $ifNull: ["$ratingsCount", 0] }, 1]
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
                                { $add: [{ $ifNull: ["$ratingsCount", 0] }, 1] }
                            ]
                        }
                    }
                }
            ],
            { new: true, session }
        );

        if (!updatedListing) {
            throw new ApiError(400, "Cannot add review: Listing not found");
        }

        await session.commitTransaction();
        return newReview[0];

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

const getReviewsByListingIdService = async (postId) => {
    const reviews = await Review.find({ listingId: postId, isPublic: true });
    return reviews;
}

const updateReviewService = async (reviewId, newRating, newMsg) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const originalReview = await Review.findByIdAndUpdate(
            reviewId,
            {
                $set: {
                    ...(newRating !== undefined && { rating: newRating }),
                    ...(newMsg !== undefined && { reviewMsg: newMsg })
                }
            },
            { 
                session, 
                returnDocument: "before" 
            }
        );

        if (!originalReview) {
            throw new ApiError(404, "Review not found");
        }

        if (newRating !== undefined && originalReview.rating !== newRating) {
            
            const updatedListing = await Listing.findByIdAndUpdate(
                originalReview.listingId,
                [
                    {
                        $set: {
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
                                            -originalReview.rating, 
                                            newRating               
                                        ]
                                    },
                                    { $ifNull: ["$ratingsCount", 1] } // Count doesn't change
                                ]
                            }
                        }
                    }
                ],
                { new: true, session }
            );

            if (!updatedListing) {
                throw new ApiError(404, "Listing not found to update stats");
            }
        }

        await session.commitTransaction();
        
        return { ...originalReview.toObject(), rating: newRating ?? originalReview.rating, reviewMsg: newMsg ?? originalReview.reviewMsg };

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

const deleteReviewService = async (reviewId) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const review = await Review.findOneAndUpdate(
            { _id: reviewId, isPublic: true },
            { $set: { isPublic: false } },
            { session, new: false } 
        );

        if (!review) {
            throw new ApiError(404, "Review not found or already deleted");
        }

        const ratingToRemove = review.rating || 0;

        const updatedListing = await Listing.findByIdAndUpdate(
            review.listingId,
            [
                {
                    $set: {
                        averageRating: {
                            $cond: {
                                if: { $lte: ["$ratingsCount", 1] },
                                then: 0,
                                else: {
                                    $divide: [
                                        {
                                            $add: [
                                                {
                                                    $multiply: [
                                                        { $ifNull: ["$averageRating", 0] },
                                                        { $ifNull: ["$ratingsCount", 0] }
                                                    ]
                                                },
                                                -ratingToRemove 
                                            ]
                                        },
                                        { $add: [{ $ifNull: ["$ratingsCount", 0] }, -1] } // New Count
                                    ]
                                }
                            }
                        },
                        ratingsCount: {
                            $max: [0, { $add: [{ $ifNull: ["$ratingsCount", 0] }, -1] }]
                        }
                    }
                }
            ],
            { new: true, session }
        );

        if (!updatedListing) {
            throw new ApiError(404, "Listing not found to update stats");
        }

        await session.commitTransaction();
        return { message: "Review deleted successfully" };

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

export { addReviewService, getReviewsByListingIdService, updateReviewService, deleteReviewService };