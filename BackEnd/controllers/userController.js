import User from "../models/userModel.js";
import Post from "../models/postModel.js";
import bcrypt from "bcryptjs";
import generateTokenAndSetCookie from "../utils/helpers/generateTokenAndSetCookie.js";
import mongoose from "mongoose";
import upload from '../utils/helpers/multer.js'



const getUserProfile = async (req, res) => {
	const { query } = req.params;

	try {
		let user;
		if (mongoose.Types.ObjectId.isValid(query)) {
			user = await User.findById(query).select("-password -updatedAt");
		} else {
			user = await User.findOne({ username: query }).select("-password -updatedAt");
		}

		if (!user) return res.status(404).json({ error: "User not found" });

		res.status(200).json(user);
	} catch (err) {
		res.status(500).json({ error: err.message });
		console.log("Error in getUserProfile:", err.message);
	}
};

const signupUser = async (req, res) => {
	try {
		const { name, email, username, password } = req.body;
		const user = await User.findOne({ $or: [{ email }, { username }] });

		if (user) {
			return res.status(400).json({ error: "User already exists" });
		}

		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);

		const newUser = new User({
			name,
			email,
			username,
			password: hashedPassword,
		});
		await newUser.save();

		generateTokenAndSetCookie(newUser._id, res);

		res.status(201).json({
			_id: newUser._id,
			name: newUser.name,
			email: newUser.email,
			username: newUser.username,
			bio: newUser.bio,
			profilePic: newUser.profilePic,
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
		console.log("Error in signupUser:", err.message);
	}
};

const loginUser = async (req, res) => {
	try {
		const { username, password } = req.body;
		const user = await User.findOne({ username });

		if (!user) return res.status(400).json({ error: "Invalid username or password" });

		const isPasswordCorrect = await bcrypt.compare(password, user.password);

		if (!isPasswordCorrect) return res.status(400).json({ error: "Invalid username or password" });

		if (user.isFrozen) {
			return res.status(403).json({ error: "Account is frozen" });
		}

		generateTokenAndSetCookie(user._id, res);

		res.status(200).json({
			_id: user._id,
			name: user.name,
			email: user.email,
			username: user.username,
			bio: user.bio,
			profilePic: user.profilePic,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
		console.log("Error in loginUser:", error.message);
	}
};

const logoutUser = (req, res) => {
	try {
		res.cookie("jwt", "", { maxAge: 1 });
		res.status(200).json({ message: "User logged out successfully" });
	} catch (err) {
		res.status(500).json({ error: err.message });
		console.log("Error in logoutUser:", err.message);
	}
};

const followUnFollowUser = async (req, res) => {
	try {
		const { id } = req.params;
		const userToModify = await User.findById(id);
		const currentUser = await User.findById(req.user._id);

		if (!userToModify || !currentUser) return res.status(400).json({ error: "User not found" });

		if (id === req.user._id.toString())
			return res.status(400).json({ error: "You cannot follow/unfollow yourself" });

		const isFollowing = currentUser.following.includes(id);

		if (isFollowing) {
			await User.findByIdAndUpdate(id, { $pull: { followers: req.user._id } });
			await User.findByIdAndUpdate(req.user._id, { $pull: { following: id } });
			res.status(200).json({ message: "User unfollowed successfully" });
		} else {
			await User.findByIdAndUpdate(id, { $push: { followers: req.user._id } });
			await User.findByIdAndUpdate(req.user._id, { $push: { following: id } });
			res.status(200).json({ message: "User followed successfully" });
		}
	} catch (err) {
		res.status(500).json({ error: err.message });
		console.log("Error in followUnFollowUser:", err.message);
	}
};

const updateUser = async (req, res) => {
    const { name, email, username, password, bio} = req.body;
    const userId = req.user._id;
	let { profilePic } = req.body;

    if (!userId) return res.status(400).json({ error: "User ID is missing" });
    if (req.params.id !== userId.toString())
        return res.status(403).json({ error: "Unauthorized to update this profile" });

    try {
        let user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Update password if provided
        if (password) {
            if (typeof password !== 'string' || password.length < 6) {
                return res.status(400).json({ error: "Invalid password" });
            }
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }
        
		if (req.file) {
            const file = req.file;
            const fileName = `profile_pics/${userId}_${Date.now()}`;

            const fileUpload = bucket.file(fileName);

            await fileUpload.save(file.buffer, {
                metadata: { contentType: file.mimetype },
                public: true
            });

            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            user.profilePic = publicUrl; // Update the user's profile picture URL
        }
		
        // Update user fields
        user.name = name || user.name;
        user.email = email || user.email;
        user.username = username || user.username;
        user.bio = bio || user.bio;

        // Save updated user
        user = await user.save();

        // Update related posts with new user data
        await Post.updateMany(
            { "replies.userId": userId },
            {
                $set: {
                    "replies.$[reply].username": user.username,
                    "replies.$[reply].userProfilePic": user.profilePic,
                },
            },
            { arrayFilters: [{ "reply.userId": userId }] }
        );

        user.password = null;

        res.status(200).json(user);
    } catch (err) {
        console.error("Error in updateUser:", err.message);
        res.status(500).json({ error: "Internal server error", details: err.message });
    }
}
const getSuggestedUsers = async (req, res) => {
	try {
		const userId = req.user._id;
		const usersFollowedByYou = await User.findById(userId).select("following");

		const users = await User.aggregate([
			{ $match: { _id: { $ne: userId } } },
			{ $sample: { size: 10 } },
		]); 

		const filteredUsers = users.filter(user => !usersFollowedByYou.following.includes(user._id));
		const suggestedUsers = filteredUsers.slice(0, 4);

		suggestedUsers.forEach(user => (user.password = null));

		res.status(200).json(suggestedUsers);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const freezeAccount = async (req, res) => {
	try {
		const user = await User.findById(req.user._id);
		if (!user) {
			return res.status(400).json({ error: "User not found" });
		}

		user.isFrozen = true;
		await user.save();

		res.status(200).json({ success: true });
	} catch (error) {
		res.status(500).json({ error: error.message });
		console.log("Error in freezeAccount:", error.message);
	}
};

export {
	signupUser,
	loginUser,
	logoutUser,
	followUnFollowUser,
	updateUser,
	getUserProfile,
	getSuggestedUsers,
	freezeAccount,
};
 