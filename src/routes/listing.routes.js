import { Router } from "express";
import {
    createListing,
    getListings,
    getListing,
    updateListing,
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
} from "../controllers/listing.controller.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// route for listings (collection)
// changed from `/all` to `/` for a standard RESTful collection endpoint
router
    .route("/")
    .get(getListings)
    .post(upload.fields([{ name: "images", maxCount: 50 }]), createListing);

router
    .route("/filter")
    .get(getListingFiltered);

router
    .route("/:id")
    .get(getListing)
    .patch(updateListing)
    .delete(deleteListing);

router
    .route("/:id/like")
    .post(likeListing)
    .patch(unlikeListing);

router
    .route("/:id/description")
    .patch(updateDescription);

router
    .route("/:id/tips")
    .patch(updateTips);

router
    .route("/:id/title")
    .patch(updateTitle);

router
    .route("/:id/location")
    .patch(updateLocation);

router
    .route("/:id/images")
    .post(upload.fields([{ name: "images", maxCount: 50 }]), addImage)
    .delete(removeImage);

router
    .route("/:id/tags-categories")
    .patch(updateTagsAndCategories);

export default router;