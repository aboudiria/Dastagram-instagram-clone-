import User from '../models/userModel.js';
import Post from '../models/postModel.js';
import upload from '../utils/helpers/multer.js';
import bucket from '../firebaseAdmin.js'
const createPost = async (req, res) => {
    try {
        const { postedBy, text, img } = req.body;

        if (!postedBy || !text) {
            return res.status(400).json({ error: "postedBy and text fields are required" });
        }

        const user = await User.findById(postedBy);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (user._id.toString() !== req.user._id.toString()) {
            return res.status(401).json({ error: "Unauthorized to create post" });
        }

        const maxLength = 500;
        if (text.length > maxLength) {
            return res.status(400).json({ error: `Text must be less than ${maxLength} characters` });
        }

         
        let imgUrl = null;
        if (req.file) {
            const file = req.file;
            const fileName = `post_images/${postedBy}_${Date.now()}`;

            const fileUpload = bucket.file(fileName);

            await fileUpload.save(file.buffer, {
                metadata: { contentType: file.mimetype },
                public: true
            });

            imgUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        }

       
        const newPost = new Post({
            postedBy,
            text,
            img: imgUrl
        });

        const post = await newPost.save();
        res.status(201).json({ message: "Post created successfully", post });
    } catch (error) {
        console.log("Error in create post:", error.message);
        res.status(500).json({ message: error.message });
    }
};

const getPost = async (req, res) => {
    try {
        const post = await Post.findById(req.params._id);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }
        res.status(200).json({ post });
    } catch (error) {
        console.log("Error in get post:", error.message);
        res.status(500).json({ message: error.message });
    }
};

const deletePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params._id);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }
        if (post.postedBy.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "You are not authorized to delete this post" });
        }
        await Post.findByIdAndDelete(req.params._id);
        res.status(200).json({ message: "Post deleted successfully" });
    } catch (error) {
        console.log("Error in delete post:", error.message);
        res.status(500).json({ message: error.message });
    }
};

const likeUnlikePost = async (req, res) => {
    try {
        const { id: postId } = req.params;
        const userId = req.user._id;
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        const userLikedPost = post.likes.includes(userId);
        if (userLikedPost) {
            await Post.updateOne({ _id: postId }, { $pull: { likes: userId } });
            res.status(200).json({ message: "Post unliked successfully" });
        } else {
            post.likes.push(userId);
            await post.save();
            res.status(200).json({ message: "Post liked successfully" });
        }
    } catch (error) {
        console.log("Error in like/unlike post:", error.message);
        res.status(500).json({ message: error.message });
    }
};

const replyToPost = async (req, res) => {
    try {
        const { text } = req.body;
        const postId = req.params.id;
        const userId = req.user._id;
        const { profilePic: userProfilePic, username } = req.user;

        if (!text) {
            return res.status(400).json({ message: "Text field is required" });
        }

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        const reply = { userId, text, userProfilePic, username };
        post.replies.push(reply);
        await post.save();
        res.status(200).json({ message: "Reply created successfully" });
    } catch (error) {
        console.log("Error in reply to post:", error.message);
        res.status(500).json({ message: error.message });
    }
};

const getFeedPosts = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const following = user.following;
        const feedPosts = await Post.find({ postedBy: { $in: following } }).sort({ createdAt: -1 });

        res.status(200).json(feedPosts);
    } catch (error) {
        console.log("Error in get feed posts:", error.message);
        res.status(500).json({ error: error.message });
    }
};   

const getUserPosts = async (req, res) => {
    const { username } = req.params;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const posts = await Post.find({ postedBy: user._id }).sort({ createdAt: -1 });

        res.status(200).json(posts);
    } catch (error) {
        console.log("Error in get user posts:", error.message);
        res.status(500).json({ error: error.message });
    }
};

export { createPost, getPost, deletePost, likeUnlikePost, replyToPost, getFeedPosts, getUserPosts };
