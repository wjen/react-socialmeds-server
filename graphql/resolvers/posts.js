const { AuthenticationError, UserInputError } = require('apollo-server');
const { compareSync } = require('bcryptjs');
const Post = require('../../models/Post');
const checkAuth = require('../../util/check-auth');

module.exports = {
  Query: {
    async getPosts() {
      try {
        const posts = await Post.find().sort({ createdAt: -1 });
        return posts;
      } catch (err) {
        throw new Error(err);
      }
    },
    async getPost(_, { postId }) {
      try {
        let post = await Post.findById(postId);
        if (!post) {
          throw new Error('Post not found');
        }
        return post;
      } catch (err) {
        throw new Error(err);
      }
    },
  },
  // context will contain req
  Mutation: {
    async createPost(_, { body }, context) {
      const user = checkAuth(context);

      if (body.trim() === '') {
        let errors = {};
        errors.general = 'Post body must not be empty';
        throw new UserInputError('Post body must not be empty', {
          errors,
        });
      }
      let newPost = new Post({
        body,
        user: user.id,
        username: user.username,
        createdAt: new Date().toISOString(),
      });
      console.log('hi');
      console.log(newPost);

      const post = await newPost.save();

      context.pubsub.publish('NEW_POST', {
        newPost: post,
      });

      return post;
    },
    async editPost(_, { postId, body }, context) {
      const user = checkAuth(context);
      try {
        let post = await Post.findById(postId);
        console.log('post: ' + post);
        console.log(user);
        if (user.username === post.username) {
          console.log(body);
          let newPost = new Post({
            body,
            user: user.id,
            username: user.username,
            createdAt: post.createdAt,
            _id: post.id,
          });
          post = await Post.findByIdAndUpdate(postId, newPost, { new: true });
          console.log('new post: ', post);
          return post;
        }
      } catch (err) {
        throw new Error(err);
      }
    },

    async deletePost(_, { postId }, context) {
      const user = checkAuth(context);
      try {
        const post = await Post.findById(postId);
        if (user.username === post.username) {
          await post.delete();
          return 'Post deleted succesfully';
        } else {
          throw new AuthenticationError('Action not allowed');
        }
      } catch (err) {
        throw new Error(err);
      }
    },
    async likePost(_, { postId }, context) {
      let { username } = checkAuth(context);
      const post = await Post.findById(postId);
      if (post) {
        if (post.likes.find((like) => like.username === username)) {
          post.likes = post.likes.filter((like) => like.username !== username);
        } else {
          post.likes.push({ username, createdAt: new Date().toISOString() });
        }
        await post.save();
        return post;
      } else {
        throw new UserInputError('Post not found');
      }
    },
  },
  Subscription: {
    newPost: {
      subscribe: (_, __, { pubsub }) => pubsub.asyncIterator('NEW_POST'),
    },
  },
};
