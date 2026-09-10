const User = require("../models/User");
const Post = require("../models/Post");

async function searchUsers(req, res) {
  try {
    const query = (req.query.q || "").trim();

    if (!query) {
      return res.json({
        users: [],
      });
    }

    const users = await User.find({
      $or: [
        {
          username: {
            $regex: query,
            $options: "i",
          },
        },
        {
          name: {
            $regex: query,
            $options: "i",
          },
        },
      ],
    })
      .select(
        "username fullName avatar bio followers following isVerified"
      )
      .limit(30);

    res.json({
      users,
    });
  } catch (error) {
    console.error(
      "Search users error:",
      error
    );

    res.status(500).json({
      message: "Unable to search users",
    });
  }
}

async function searchPosts(req, res) {
  try {
    const query = (req.query.q || "").trim();

    if (!query) {
      return res.json({
        posts: [],
      });
    }

    const posts = await Post.find({
      caption: {
        $regex: query,
        $options: "i",
      },
    })
      .populate(
        "user",
        "username  fullName avatar isVerified"
      )
      .sort({
        createdAt: -1,
      })
      .limit(50);

    res.json({
      posts,
    });
  } catch (error) {
    console.error(
      "Search posts error:",
      error
    );

    res.status(500).json({
      message: "Unable to search posts",
    });
  }
}

async function search(req, res) {
  try {
    const query = (req.query.q || "").trim();

    if (!query) {
      return res.json({
        users: [],
        posts: [],
      });
    }

    const [users, posts] =
      await Promise.all([
        User.find({
          $or: [
            {
              username: {
                $regex: query,
                $options: "i",
              },
            },
            {
              name: {
                $regex: query,
                $options: "i",
              },
            },
          ],
        })
          .select(
            "username fullName avatar bio followers following isVerified"
          )
          .limit(15),

        Post.find({
          caption: {
            $regex: query,
            $options: "i",
          },
        })
          .populate(
            "user",
            "username fullName avatar isVerified"
          )
          .sort({
            createdAt: -1,
          })
          .limit(30),
      ]);

    res.json({
      users,
      posts,
    });
  } catch (error) {
    console.error(
      "Search error:",
      error
    );

    res.status(500).json({
      message: "Search failed",
    });
  }
}

module.exports = {
  searchUsers,
  searchPosts,
  search,
};