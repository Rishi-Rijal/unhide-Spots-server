import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import ApiError from './ApiError.js';
import "dotenv/config";


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        // upload the file
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });
        fs.unlinkSync(localFilePath)
        return response;
    } catch (err) {
        fs.unlinkSync(localFilePath)
        return null;
    }
}

const removeFromCloudinary = async (publicId) => {
    try {
        if (!publicId) return;  
        await cloudinary.uploader.destroy(publicId, {
            resource_type: "image"
        });
    } catch (err) {
        console.error("Error removing from Cloudinary:", err);
    }   
}

const uploadImages = async (images) => {
    const uploadedImages = await Promise.all(
            images.map(async (image) => {
                const uploadResult = await uploadOnCloudinary(image.path);
                if (!uploadResult) throw new ApiError(500, "Image upload failed");
                return {
                    url: uploadResult.secure_url,
                    public_id: uploadResult.public_id,
                    format: uploadResult.format
                };
            })
        );
    return uploadedImages;
}

const removeImages = async (images) => {
    await Promise.all(
        images.map(async (img) => {
            await removeFromCloudinary(img.public_id);
        })
    );
}

export {uploadOnCloudinary, removeFromCloudinary, uploadImages, removeImages};