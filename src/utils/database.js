import * as SQLite from 'expo-sqlite';
import { File, Paths, Directory } from 'expo-file-system';

const DB_NAME = 'voidultra.db';
let db;

export const getDB = () => db;

export const getDBPath = () => `SQLite/${DB_NAME}`;

// Calibrate the Root: expo-sqlite uses Library/SQLite on iOS and databases/ on Android.
// We use Paths.library if available, otherwise fallback to Paths.document.
const DB_ROOT = Paths.library || Paths.document;

export const deleteDatabaseFiles = async () => {
  const dbPath = getDBPath();
  const dbFile = new File(DB_ROOT, dbPath);
  const walFile = new File(DB_ROOT, dbPath + '-wal');
  const shmFile = new File(DB_ROOT, dbPath + '-shm');
  
  try { if (dbFile.exists) await dbFile.delete(); } catch (_) {}
  try { if (walFile.exists) await walFile.delete(); } catch (_) {}
  try { if (shmFile.exists) await shmFile.delete(); } catch (_) {}
};

export const initDB = async () => {
  try {
    if (db) {
      try { await db.closeAsync(); } catch (_) {}
    }

    db = await SQLite.openDatabaseAsync(DB_NAME);

    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        content TEXT,
        timestamp INTEGER,
        is_pinned BOOLEAN DEFAULT 0,
        is_favorite BOOLEAN DEFAULT 0,
        mood_score INTEGER,
        parent_id TEXT
      );

      CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY,
        post_id TEXT,
        file_uri TEXT,
        media_type TEXT DEFAULT 'image',
        FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE
      );

      CREATE TABLE IF NOT EXISTS post_tags (
        post_id TEXT,
        tag_id TEXT,
        FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (post_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS checklist_items (
        id TEXT PRIMARY KEY,
        post_id TEXT,
        content TEXT,
        is_checked INTEGER DEFAULT 0,
        position INTEGER DEFAULT 0,
        FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
      );
    `);

    // Silent migrations for existing DBs
    const migrations = [
      `ALTER TABLE posts ADD COLUMN parent_id TEXT;`,
      `ALTER TABLE media ADD COLUMN media_type TEXT DEFAULT 'image';`,
      `ALTER TABLE posts ADD COLUMN is_favorite BOOLEAN DEFAULT 0;`,
    ];
    for (const sql of migrations) {
      try { await db.execAsync(sql); } catch (_) {}
    }

    // Ensure media directory exists
    const mediaDir = new Directory(Paths.document, 'media');
    if (!mediaDir.exists) await mediaDir.create();

    console.log('Database initialized');
  } catch (error) {
    console.error('Error initializing database', error);
  }
};

export const closeDatabase = async () => {
  if (db) {
    try {
      await db.closeAsync();
      db = null;
    } catch (e) {
      console.error('Error closing database:', e);
    }
  }
};

const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substr(2);

// ─── Posts ────────────────────────────────────────────────────────────────────

export const createPost = async ({
  content,
  isPinned = false,
  moodScore = null,
  mediaItems = [],   // [{ uri, type }]  type: 'image' | 'video'
  tagNames = [],
  checklistItems = [],  // ['item text', ...]
  parentId = null,
}) => {
  if (!db) throw new Error('DB not ready');
  const postId = generateId();
  const timestamp = Date.now();

  await db.runAsync(
    `INSERT INTO posts (id, content, timestamp, is_pinned, is_favorite, mood_score, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [postId, content, timestamp, isPinned ? 1 : 0, 0, moodScore, parentId]
  );

  for (const item of mediaItems) {
    const mediaId = generateId();
    let finalUri = item.uri;

    // Persist media to internal 'media' folder
    try {
      const extension = item.uri.split('.').pop() || 'file';
      const fileName = `media/${mediaId}.${extension}`;
      const destFile = new File(Paths.document, fileName);
      
      const sourceFile = new File(item.uri);
      if (sourceFile.exists) {
        await sourceFile.copy(destFile);
        finalUri = destFile.uri;
      }
    } catch (e) {
      console.error('Failed to persist media:', e);
    }

    await db.runAsync(
      `INSERT INTO media (id, post_id, file_uri, media_type) VALUES (?, ?, ?, ?);`,
      [mediaId, postId, finalUri, item.type || 'image']
    );
  }

  for (let i = 0; i < checklistItems.length; i++) {
    const text = typeof checklistItems[i] === 'string' ? checklistItems[i] : checklistItems[i].content;
    if (!text?.trim()) continue;
    await db.runAsync(
      `INSERT INTO checklist_items (id, post_id, content, is_checked, position) VALUES (?, ?, ?, 0, ?);`,
      [generateId(), postId, text.trim(), i]
    );
  }

  for (const tagName of tagNames) {
    if (!tagName?.trim()) continue;
    let tagId;
    const existing = await db.getFirstAsync(`SELECT id FROM tags WHERE name = ?;`, [tagName.trim()]);
    if (existing) {
      tagId = existing.id;
    } else {
      tagId = generateId();
      await db.runAsync(`INSERT INTO tags (id, name) VALUES (?, ?);`, [tagId, tagName.trim()]);
    }
    try {
      await db.runAsync(`INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?);`, [postId, tagId]);
    } catch (_) {}
  }

  return postId;
};

export const updatePost = async (postId, { content, tagNames = [] }) => {
  if (!db) return;
  await db.runAsync(`UPDATE posts SET content = ? WHERE id = ?;`, [content, postId]);

  // Replace tags
  await db.runAsync(`DELETE FROM post_tags WHERE post_id = ?;`, [postId]);
  for (const tagName of tagNames) {
    if (!tagName?.trim()) continue;
    let tagId;
    const existing = await db.getFirstAsync(`SELECT id FROM tags WHERE name = ?;`, [tagName.trim()]);
    if (existing) {
      tagId = existing.id;
    } else {
      tagId = generateId();
      await db.runAsync(`INSERT INTO tags (id, name) VALUES (?, ?);`, [tagId, tagName.trim()]);
    }
    try {
      await db.runAsync(`INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?);`, [postId, tagId]);
    } catch (_) {}
  }
};

export const getPosts = async (tagFilter = null) => {
  if (!db) return [];
  try {
    let posts = [];
    if (tagFilter) {
      posts = await db.getAllAsync(`
        SELECT p.* FROM posts p
        JOIN post_tags pt ON p.id = pt.post_id
        JOIN tags t ON pt.tag_id = t.id
        WHERE t.name = ? AND p.parent_id IS NULL
        ORDER BY p.is_pinned DESC, p.timestamp DESC;
      `, [tagFilter]);
    } else {
      posts = await db.getAllAsync(
        `SELECT * FROM posts WHERE parent_id IS NULL ORDER BY is_pinned DESC, timestamp DESC;`
      );
    }
    const finalPosts = await attachExtrasToMany(posts);
    return finalPosts;
  } catch (error) {
    console.error('Error fetching posts', error);
    return [];
  }
};

export const updatePostPin = async (postId, isPinned) => {
  if (!db) return;
  await db.runAsync(`UPDATE posts SET is_pinned = ? WHERE id = ?;`, [isPinned ? 1 : 0, postId]);
};

export const updatePostFavorite = async (postId, isFavorite) => {
  if (!db) return;
  await db.runAsync(`UPDATE posts SET is_favorite = ? WHERE id = ?;`, [isFavorite ? 1 : 0, postId]);
};

export const deletePost = async (postId) => {
  if (!db) return;
  await db.execAsync(`PRAGMA foreign_keys = ON;`);
  const media = await db.getAllAsync(`SELECT file_uri FROM media WHERE post_id = ?;`, [postId]);
  for (const item of media) {
    try { await new File(item.file_uri).delete(); } catch (_) {}
  }
  await db.runAsync(`DELETE FROM posts WHERE id = ?;`, [postId]);
};

// ─── Checklist ────────────────────────────────────────────────────────────────

export const getChecklistItems = async (postId) => {
  if (!db) return [];
  return db.getAllAsync(
    `SELECT * FROM checklist_items WHERE post_id = ? ORDER BY position ASC;`,
    [postId]
  );
};

export const toggleChecklistItem = async (itemId, isChecked) => {
  if (!db) return;
  await db.runAsync(`UPDATE checklist_items SET is_checked = ? WHERE id = ?;`, [isChecked ? 1 : 0, itemId]);
};

export const addChecklistItem = async (postId, content, position = 0) => {
  if (!db) return;
  await db.runAsync(
    `INSERT INTO checklist_items (id, post_id, content, is_checked, position) VALUES (?, ?, ?, 0, ?);`,
    [generateId(), postId, content, position]
  );
};

export const deleteChecklistItem = async (itemId) => {
  if (!db) return;
  await db.runAsync(`DELETE FROM checklist_items WHERE id = ?;`, [itemId]);
};

// ─── Tags ─────────────────────────────────────────────────────────────────────

export const getAllTags = async () => {
  if (!db) return [];
  return db.getAllAsync(`
    SELECT t.name, COUNT(pt.post_id) as count
    FROM tags t
    JOIN post_tags pt ON t.id = pt.tag_id
    GROUP BY t.name
    ORDER BY count DESC;
  `);
};

// ─── Thread ───────────────────────────────────────────────────────────────────

export const getThread = async (postId) => {
  if (!db) return null;
  try {
    const original = await db.getFirstAsync(`SELECT * FROM posts WHERE id = ?;`, [postId]);
    if (!original) return null;
    await attachExtras(original);

    const replies = await db.getAllAsync(
      `SELECT * FROM posts WHERE parent_id = ? ORDER BY timestamp ASC;`,
      [postId]
    );
    await attachExtrasToMany(replies);

    return { original, replies };
  } catch (error) {
    console.error('Error fetching thread', error);
    return null;
  }
};

// ─── Calendar ─────────────────────────────────────────────────────────────────

export const getPostDates = async () => {
  if (!db) return [];
  return db.getAllAsync(`
    SELECT date(timestamp / 1000, 'unixepoch') as post_date, COUNT(*) as count
    FROM posts
    WHERE parent_id IS NULL
    GROUP BY post_date
    ORDER BY post_date DESC;
  `);
};

// Returns posts for a specific YYYY-MM-DD date string
export const getPostsForDay = async (dateStr) => {
  if (!db) return [];
  // Build unix ms range for the full day (start/end of day in local time via SQLite date())
  const rows = await db.getAllAsync(`
    SELECT * FROM posts
    WHERE parent_id IS NULL
      AND date(timestamp / 1000, 'unixepoch') = ?
    ORDER BY timestamp ASC;
  `, [dateStr]);
  return await attachExtrasToMany(rows);
};


// ─── Search ───────────────────────────────────────────────────────────────────

export const searchPosts = async (query) => {
  if (!db || !query?.trim()) return [];
  const all = await db.getAllAsync(
    `SELECT * FROM posts WHERE parent_id IS NULL AND content LIKE ? ORDER BY timestamp DESC;`,
    [`%${query}%`]
  );
  return attachExtrasToMany(all);
};

export const getFavoritePosts = async (mediaType = 'all') => {
  if (!db) return [];
  let posts = [];
  if (mediaType === 'all') {
    posts = await db.getAllAsync(
      `SELECT * FROM posts WHERE is_favorite = 1 AND parent_id IS NULL ORDER BY timestamp DESC;`
    );
  } else {
    // Media filtering for favorites
    posts = await db.getAllAsync(`
      SELECT DISTINCT p.* 
      FROM posts p
      JOIN media m ON p.id = m.post_id
      WHERE p.is_favorite = 1 AND p.parent_id IS NULL AND m.media_type = ?
      ORDER BY p.timestamp DESC;
    `, [mediaType]);
  }
  return attachExtrasToMany(posts);
};

// Full-featured search: text AND/OR tag AND/OR date
export const advancedSearch = async ({ text = '', tag = '', dateStr = '' } = {}) => {
  if (!db) return [];
  const clauses = ['p.parent_id IS NULL'];
  const params  = [];

  if (text.trim()) {
    clauses.push('p.content LIKE ?');
    params.push(`%${text.trim()}%`);
  }
  if (dateStr.trim()) {
    clauses.push("date(p.timestamp / 1000, 'unixepoch') = ?");
    params.push(dateStr.trim());
  }

  let sql;
  if (tag.trim()) {
    // Join to filter by tag
    sql = `
      SELECT DISTINCT p.*
      FROM posts p
      JOIN post_tags pt ON p.id  = pt.post_id
      JOIN tags t       ON pt.tag_id = t.id
      WHERE ${clauses.join(' AND ')} AND t.name = ?
      ORDER BY p.timestamp DESC;
    `;
    params.push(tag.trim());
  } else {
    sql = `
      SELECT * FROM posts p
      WHERE ${clauses.join(' AND ')}
      ORDER BY p.timestamp DESC;
    `;
  }

  const rows = await db.getAllAsync(sql, params);
  return attachExtrasToMany(rows);
};


// ─── Nuke ─────────────────────────────────────────────────────────────────────

export const nukeDatabase = async () => {
  if (!db) return false;
  try {
    const media = await db.getAllAsync(`SELECT file_uri FROM media;`);
    for (const item of media) {
      try { await new File(item.file_uri).delete(); } catch (_) {}
    }
    await db.execAsync(`
      DROP TABLE IF EXISTS checklist_items;
      DROP TABLE IF EXISTS post_tags;
      DROP TABLE IF EXISTS media;
      DROP TABLE IF EXISTS tags;
      DROP TABLE IF EXISTS posts;
    `);
    await initDB();
    return true;
  } catch (error) {
    console.error('Error nuking database', error);
    return false;
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function attachExtras(post) {
  if (!post) return post;
  post.is_pinned = !!post.is_pinned;
  post.is_favorite = !!post.is_favorite;
  
  const pid = post.id || '';
  post.media = await db.getAllAsync(`SELECT * FROM media WHERE post_id = ?;`, [pid]);
  const tags = await db.getAllAsync(
    `SELECT t.name FROM tags t JOIN post_tags pt ON t.id = pt.tag_id WHERE pt.post_id = ?;`,
    [pid]
  );
  post.tags = tags.map(t => t.name);
  post.checklist = await db.getAllAsync(
    `SELECT * FROM checklist_items WHERE post_id = ? ORDER BY position ASC;`,
    [pid]
  );
  const replyCount = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM posts WHERE parent_id = ?;`,
    [pid]
  );
  post.replyCount = replyCount?.count ?? 0;

  // First reply preview for timeline cards
  if (post.replyCount > 0) {
    const fr = await db.getFirstAsync(
      `SELECT content, timestamp FROM posts WHERE parent_id = ? ORDER BY timestamp ASC LIMIT 1;`,
      [pid]
    );
    post.firstReply = fr ?? null;
  } else {
    post.firstReply = null;
  }

  return post;
}

async function attachExtrasToMany(posts) {
  for (const post of posts) {
    await attachExtras(post);
  }
  return posts;
}

// ─── Reflections ──────────────────────────────────────────────────────────────

export const getAllMedia = async () => {
  if (!db) throw new Error('DB not ready');
  // Returns all media rows, newest posts first
  return db.getAllAsync(`
    SELECT m.id, m.file_uri, m.media_type, m.post_id, p.timestamp
    FROM media m
    JOIN posts p ON m.post_id = p.id
    ORDER BY p.timestamp DESC;
  `);
};
