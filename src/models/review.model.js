import mongoose  from "mongoose";

const reviewSchema = new mongoose.Schema({
    listingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Listing',
        required: true,
    },
    // userId: { // I will add this filed later when I login is available for the user
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'User',
    //     required: true,
    //     index: true
    // },

    userName : { 
        type: String,
        required: true
    },

    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    reviewMsg: {
        type: String,
        trim: true
    },

    isDeleted: {
        type: Boolean,
        default: false
    },
    isPublic: {
        type: Boolean,
        default: true
    },
}, { timestamps: true });

// reviewSchema.index({ listingId: 1, createdAt: -1 });


const Review = mongoose.model('Review', reviewSchema);
export default Review;