import { Router } from "express";
import {
    addReview,
    getReviewsByListingId,
    updateReview,
    deleteReview
} from "../controllers/review.controller.js";
import { verifyJWT } from "../controllers/auth.controller.js";

const router = Router();

router
    .route("/:postId")
    .get(getReviewsByListingId)
    .post(addReview)

router
    .route("/:reviewId")
    .patch(verifyJWT, updateReview)
    .delete(verifyJWT, deleteReview);

export default router