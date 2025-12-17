// تحميل متغيرات البيئة من ملف .env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');
const { v2: cloudinary } = require('cloudinary');
const multer = require('multer');

// تهيئة التطبيق
const app = express();

// تكوين CORS
app.use(cors());

// تكوين Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('views'));

// تكوين Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// تهيئة Firebase Admin
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// الحصول على مراجع Firebase
const db = admin.firestore();
const auth = admin.auth();

// تكوين multer لرفع الملفات
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// ================================
// Routes
// ================================

// الصفحة الرئيسية
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'home.html'));
});

// صفحة التسجيل
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// صفحة الدخول
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// صفحة البروفيل
app.get('/profile/:userId', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'profile.html'));
});

// صفحة إنشاء منشور
app.get('/create-post', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'create_post.html'));
});

// ================================
// API Routes
// ================================

// تسجيل مستخدم جديد
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    // إنشاء المستخدم في Firebase Auth
    const userRecord = await auth.createUser({
      email: email,
      password: password,
    });

    // حفظ بيانات المستخدم في Firestore
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      username: username,
      email: email,
      profileImage: null,
      bio: '',
      createdAt: new Date(),
      followers: [],
      following: [],
    });

    res.json({ success: true, uid: userRecord.uid });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// الحصول على بيانات المستخدم
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    res.json(userDoc.data());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// إنشاء منشور جديد
app.post('/api/posts/create', upload.single('media'), async (req, res) => {
  try {
    const { userId, content, mediaType } = req.body;
    let mediaUrl = null;

    // رفع الملف إلى Cloudinary
    if (req.file) {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: mediaType === 'audio' ? 'video' : 'auto',
          folder: 'egg_posts',
        },
        async (error, result) => {
          if (error) {
            return res.status(400).json({ error: error.message });
          }

          mediaUrl = result.secure_url;

          // حفظ المنشور في Firestore
          const postRef = await db.collection('posts').add({
            userId: userId,
            content: content,
            mediaUrl: mediaUrl,
            mediaType: mediaType,
            likes: [],
            comments: [],
            createdAt: new Date(),
          });

          res.json({ success: true, postId: postRef.id });
        }
      );

      uploadStream.end(req.file.buffer);
    } else {
      // منشور نصي بدون وسائط
      const postRef = await db.collection('posts').add({
        userId: userId,
        content: content,
        mediaUrl: null,
        mediaType: null,
        likes: [],
        comments: [],
        createdAt: new Date(),
      });

      res.json({ success: true, postId: postRef.id });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// الحصول على جميع المنشورات
app.get('/api/posts', async (req, res) => {
  try {
    const postsSnapshot = await db.collection('posts')
      .orderBy('createdAt', 'desc')
      .get();

    const posts = [];
    for (const doc of postsSnapshot.docs) {
      const postData = doc.data();
      const userDoc = await db.collection('users').doc(postData.userId).get();
      
      posts.push({
        id: doc.id,
        ...postData,
        author: userDoc.data(),
      });
    }

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// إضافة تعليق على منشور
app.post('/api/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, content } = req.body;

    const postRef = db.collection('posts').doc(postId);
    await postRef.update({
      comments: admin.firestore.FieldValue.arrayUnion({
        userId: userId,
        content: content,
        createdAt: new Date(),
      }),
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// إضافة إعجاب على منشور
app.post('/api/posts/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    const postRef = db.collection('posts').doc(postId);
    await postRef.update({
      likes: admin.firestore.FieldValue.arrayUnion(userId),
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// إزالة إعجاب من منشور
app.post('/api/posts/:postId/unlike', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    const postRef = db.collection('posts').doc(postId);
    await postRef.update({
      likes: admin.firestore.FieldValue.arrayRemove(userId),
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// بدء السيرفر
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server Egg تم تشغيله على http://localhost:${PORT}`);
});
