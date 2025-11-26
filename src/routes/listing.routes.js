import { Router } from "express";
import {
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
} from "../controllers/listing.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT, verifyAdmin, verifyAdminOrOwner } from "../controllers/auth.controller.js";

const router = Router();

router
    .route("/")
    .post(verifyJWT, upload.fields([{ name: "images", maxCount: 50 }]), createListing);

router
    .route("/filter")
    .get(getListingFiltered);

router
    .route("/:id")
    .get(getListing)
    .delete(verifyJWT, verifyAdmin, deleteListing);

router
    .route("/:id/like")
    .post(likeListing)
    .patch(unlikeListing);

router
    .route("/:id/suggest")
    .post(sendSuggestionEmail);

router
    .route("/:id/description")
    .patch(verifyJWT, verifyAdminOrOwner, updateDescription);

router
    .route("/:id/tips")
    .patch(verifyJWT, verifyAdminOrOwner, updateTips);
router
    .route("/:id/title")
    .patch(verifyJWT, verifyAdminOrOwner, updateTitle);

router
    .route("/:id/location")
    .patch(verifyJWT, verifyAdminOrOwner, updateLocation);
router
    .route("/:id/images")
    .post(verifyJWT, upload.fields([{ name: "images", maxCount: 50 }]), addImage)
    .delete(verifyJWT, verifyAdminOrOwner, removeImage);
router
    .route("/:id/tags-categories")
    .patch(verifyJWT, verifyAdminOrOwner, updateTagsAndCategories);

export default router;