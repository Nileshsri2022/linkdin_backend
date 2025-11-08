const express = require('express');
const Post = require('../models/Post');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Get all posts (public feed)
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('user', 'name')
      .populate('likes.user', 'name')
      .populate('comments.user', 'name')
      .sort({ createdAt: -1 });
    res.send(posts);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Create a post
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const postData = {
      text: req.body.text,
      user: req.user._id,
    };

    if (req.file) {
      postData.image = `/uploads/${req.file.filename}`;
    }

    const post = new Post(postData);
    await post.save();
    await post.populate('user', 'name');
    res.status(201).send(post);
  } catch (error) {
    res.status(400).send(error);
  }
});

// Update a post (only by owner)
router.patch('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, user: req.user._id });
    if (!post) {
      return res.status(404).send({ error: 'Post not found' });
    }

    Object.keys(req.body).forEach(key => {
      post[key] = req.body[key];
    });
    await post.save();
    await post.populate('user', 'name');
    res.send(post);
  } catch (error) {
    res.status(400).send(error);
  }
});

// Delete a post (only by owner)
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!post) {
      return res.status(404).send({ error: 'Post not found' });
    }
    res.send(post);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Like a post
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).send({ error: 'Post not found' });
    }

    const likeIndex = post.likes.findIndex(like => like.user.toString() === req.user._id.toString());
    if (likeIndex > -1) {
      post.likes.splice(likeIndex, 1);
    } else {
      post.likes.push({ user: req.user._id });
    }

    await post.save();
    await post.populate('likes.user', 'name');
    res.send(post);
  } catch (error) {
    res.status(400).send(error);
  }
});

// Add comment to a post
router.post('/:id/comment', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).send({ error: 'Post not found' });
    }

    post.comments.push({
      user: req.user._id,
      text: req.body.text,
    });

    await post.save();
    await post.populate('comments.user', 'name');
    res.send(post);
  } catch (error) {
    res.status(400).send(error);
  }
});

module.exports = router;
