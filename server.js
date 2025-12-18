const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));

// ===================== قاعدة بيانات وهمية =====================
const users = {};
const posts = [];
const follows = {};
const likes = {};
const comments = [];

// ===================== دوال مساعدة =====================
const generateToken = (userId) => {
    return Buffer.from(`${userId}-${Date.now()}`).toString('base64');
};

const verifyToken = (token) => {
    try {
        const decoded = Buffer.from(token, 'base64').toString();
        const userId = decoded.split('-')[0];
        return userId;
    } catch {
        return null;
    }
};

// ===================== الصفحات الرئيسية =====================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/splash.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/login.html'));
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/home.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/profile.html'));
});

app.get('/create-post', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/create_post.html'));
});

// ===================== مسارات المصادقة (Authentication) =====================

// تسجيل دخول
app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور'
            });
        }

        // البحث عن المستخدم
        const user = Object.values(users).find(u => u.email === email);

        if (!user || user.password !== password) {
            return res.status(401).json({
                success: false,
                message: 'بيانات الدخول غير صحيحة'
            });
        }

        const token = generateToken(user.id);
        res.json({
            success: true,
            message: 'تم تسجيل الدخول بنجاح',
            token,
            userId: user.id,
            user: {
                displayName: user.displayName,
                email: user.email,
                profile: user.profile
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// إنشاء حساب جديد
app.post('/api/auth/register', (req, res) => {
    try {
        const { email, username, password, profile, cover } = req.body;

        if (!email || !username || !password) {
            return res.status(400).json({
                success: false,
                message: 'البيانات المطلوبة ناقصة'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
            });
        }

        // التحقق من وجود البريد الإلكتروني
        if (Object.values(users).some(u => u.email === email)) {
            return res.status(400).json({
                success: false,
                message: 'البريد الإلكتروني مستخدم بالفعل'
            });
        }

        const userId = 'user-' + Date.now();
        const token = generateToken(userId);

        users[userId] = {
            id: userId,
            email,
            username,
            password,
            displayName: username,
            bio: '',
            location: '',
            website: '',
            profile: profile || 'https://res.cloudinary.com/duixjs8az/image/upload/v1766041351/post_media/1766041351185-597659491_1809911759727491_5903335735084455272_n.jpg',
            cover: cover || null,
            createdAt: new Date(),
            followers: 0,
            following: 0,
            postsCount: 0
        };

        follows[userId] = [];

        res.json({
            success: true,
            message: 'تم إنشاء الحساب بنجاح',
            token,
            userId,
            user: users[userId]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// تسجيل الخروج
app.post('/api/auth/logout', (req, res) => {
    res.json({
        success: true,
        message: 'تم تسجيل الخروج بنجاح'
    });
});

// ===================== مسارات المستخدم (User) =====================

// جلب بيانات المستخدم
app.get('/api/users/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const user = users[userId];

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                displayName: user.displayName,
                email: user.email,
                bio: user.bio,
                location: user.location,
                website: user.website,
                profile: user.profile,
                cover: user.cover,
                followers: user.followers || 0,
                following: user.following || 0,
                postsCount: user.postsCount || 0,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// تحديث الملف الشخصي
app.put('/api/users/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const { displayName, bio, location, website } = req.body;
        const token = req.headers.authorization?.split(' ')[1];

        const authenticatedUserId = verifyToken(token);
        if (authenticatedUserId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح بتعديل هذا الملف الشخصي'
            });
        }

        if (!users[userId]) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }

        users[userId] = {
            ...users[userId],
            displayName: displayName || users[userId].displayName,
            bio: bio || users[userId].bio,
            location: location || users[userId].location,
            website: website || users[userId].website
        };

        res.json({
            success: true,
            message: 'تم تحديث الملف الشخصي بنجاح',
            user: users[userId]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// متابعة مستخدم
app.post('/api/users/:userId/follow', (req, res) => {
    try {
        const { userId } = req.params;
        const token = req.headers.authorization?.split(' ')[1];
        const currentUserId = verifyToken(token);

        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: 'يرجى تسجيل الدخول أولاً'
            });
        }

        if (!follows[currentUserId]) {
            follows[currentUserId] = [];
        }

        if (!follows[currentUserId].includes(userId)) {
            follows[currentUserId].push(userId);
            users[userId].followers = (users[userId].followers || 0) + 1;
            users[currentUserId].following = (users[currentUserId].following || 0) + 1;
        }

        res.json({
            success: true,
            message: 'تم المتابعة بنجاح',
            userId
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// إلغاء المتابعة
app.post('/api/users/:userId/unfollow', (req, res) => {
    try {
        const { userId } = req.params;
        const token = req.headers.authorization?.split(' ')[1];
        const currentUserId = verifyToken(token);

        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: 'يرجى تسجيل الدخول أولاً'
            });
        }

        if (follows[currentUserId]?.includes(userId)) {
            follows[currentUserId] = follows[currentUserId].filter(id => id !== userId);
            users[userId].followers = Math.max(0, (users[userId].followers || 0) - 1);
            users[currentUserId].following = Math.max(0, (users[currentUserId].following || 0) - 1);
        }

        res.json({
            success: true,
            message: 'تم إلغاء المتابعة بنجاح',
            userId
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===================== مسارات المنشورات (Posts) =====================

// إنشاء منشور
app.post('/api/posts/create', (req, res) => {
    try {
        const { content, image, userId } = req.body;
        const token = req.headers.authorization?.split(' ')[1];

        const authenticatedUserId = verifyToken(token);
        if (!authenticatedUserId || authenticatedUserId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح بإنشاء منشور'
            });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({
                success: false,
                message: 'نص المنشور مطلوب'
            });
        }

        const postId = 'post-' + Date.now();
        const post = {
            id: postId,
            userId,
            author: users[userId]?.displayName || 'مستخدم',
            avatar: users[userId]?.profile,
            content,
            image,
            createdAt: new Date(),
            likes: 0,
            comments: 0,
            shares: 0
        };

        posts.unshift(post);
        users[userId].postsCount = (users[userId].postsCount || 0) + 1;

        res.json({
            success: true,
            message: 'تم إنشاء المنشور بنجاح',
            post
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// جلب جميع المنشورات
app.get('/api/posts', (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const userId = verifyToken(token);

        const userFollowings = follows[userId] || [];
        const userPosts = posts.filter(p => 
            p.userId === userId || userFollowings.includes(p.userId)
        );

        res.json({
            success: true,
            posts: userPosts,
            count: userPosts.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// جلب منشورات مستخدم معين
app.get('/api/posts/user/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const userPosts = posts.filter(p => p.userId === userId);

        res.json({
            success: true,
            posts: userPosts,
            count: userPosts.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// جلب منشور محدد
app.get('/api/posts/:postId', (req, res) => {
    try {
        const { postId } = req.params;
        const post = posts.find(p => p.id === postId);

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'المنشور غير موجود'
            });
        }

        res.json({
            success: true,
            post
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// تحديث منشور
app.put('/api/posts/:postId', (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const token = req.headers.authorization?.split(' ')[1];
        const userId = verifyToken(token);

        const post = posts.find(p => p.id === postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'المنشور غير موجود'
            });
        }

        if (post.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح بتعديل هذا المنشور'
            });
        }

        post.content = content;
        post.updatedAt = new Date();

        res.json({
            success: true,
            message: 'تم تحديث المنشور بنجاح',
            post
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// حذف منشور
app.delete('/api/posts/:postId', (req, res) => {
    try {
        const { postId } = req.params;
        const token = req.headers.authorization?.split(' ')[1];
        const userId = verifyToken(token);

        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'المنشور غير موجود'
            });
        }

        const post = posts[postIndex];
        if (post.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح بحذف هذا المنشور'
            });
        }

        posts.splice(postIndex, 1);
        users[userId].postsCount = Math.max(0, (users[userId].postsCount || 0) - 1);

        res.json({
            success: true,
            message: 'تم حذف المنشور بنجاح',
            postId
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===================== مسارات الإعجابات (Likes) =====================

// الإعجاب بمنشور
app.post('/api/posts/:postId/like', (req, res) => {
    try {
        const { postId } = req.params;
        const token = req.headers.authorization?.split(' ')[1];
        const userId = verifyToken(token);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'يرجى تسجيل الدخول أولاً'
            });
        }

        const post = posts.find(p => p.id === postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'المنشور غير موجود'
            });
        }

        const likeKey = `${userId}-${postId}`;
        if (!likes[likeKey]) {
            likes[likeKey] = true;
            post.likes = (post.likes || 0) + 1;
        }

        res.json({
            success: true,
            message: 'تم الإعجاب بالمنشور',
            postId,
            likes: post.likes
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// إلغاء الإعجاب
app.post('/api/posts/:postId/unlike', (req, res) => {
    try {
        const { postId } = req.params;
        const token = req.headers.authorization?.split(' ')[1];
        const userId = verifyToken(token);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'يرجى تسجيل الدخول أولاً'
            });
        }

        const post = posts.find(p => p.id === postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'المنشور غير موجود'
            });
        }

        const likeKey = `${userId}-${postId}`;
        if (likes[likeKey]) {
            delete likes[likeKey];
            post.likes = Math.max(0, (post.likes || 0) - 1);
        }

        res.json({
            success: true,
            message: 'تم إلغاء الإعجاب بالمنشور',
            postId,
            likes: post.likes
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===================== مسارات التعليقات (Comments) =====================

// إضافة تعليق
app.post('/api/posts/:postId/comment', (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const token = req.headers.authorization?.split(' ')[1];
        const userId = verifyToken(token);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'يرجى تسجيل الدخول أولاً'
            });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({
                success: false,
                message: 'نص التعليق مطلوب'
            });
        }

        const post = posts.find(p => p.id === postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'المنشور غير موجود'
            });
        }

        const comment = {
            id: 'comment-' + Date.now(),
            postId,
            userId,
            author: users[userId]?.displayName || 'مستخدم',
            avatar: users[userId]?.profile,
            content,
            createdAt: new Date()
        };

        comments.push(comment);
        post.comments = (post.comments || 0) + 1;

        res.json({
            success: true,
            message: 'تم إضافة التعليق بنجاح',
            comment
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// جلب تعليقات المنشور
app.get('/api/posts/:postId/comments', (req, res) => {
    try {
        const { postId } = req.params;
        const postComments = comments.filter(c => c.postId === postId);

        res.json({
            success: true,
            comments: postComments,
            count: postComments.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// حذف تعليق
app.delete('/api/comments/:commentId', (req, res) => {
    try {
        const { commentId } = req.params;
        const token = req.headers.authorization?.split(' ')[1];
        const userId = verifyToken(token);

        const commentIndex = comments.findIndex(c => c.id === commentId);
        if (commentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'التعليق غير موجود'
            });
        }

        const comment = comments[commentIndex];
        if (comment.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح بحذف هذا التعليق'
            });
        }

        const post = posts.find(p => p.id === comment.postId);
        if (post) {
            post.comments = Math.max(0, (post.comments || 0) - 1);
        }

        comments.splice(commentIndex, 1);

        res.json({
            success: true,
            message: 'تم حذف التعليق بنجاح',
            commentId
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===================== معالجة الأخطاء =====================

// 404 Not Found
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'الصفحة غير موجودة'
    });
});

// ===================== بدء الخادم =====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🥚 Egg Platform running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
