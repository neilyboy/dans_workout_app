const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

// Create necessary directories
const dirs = [
    './public',
    './public/icons',
    './public/icons/avatars',
    './public/css',
    './public/js'
];

dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const app = express();
const port = 3000;

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(bodyParser.json());

// Security middleware
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data:; " +
        "connect-src 'self'"
    );
    next();
});

// Serve static files
app.use(express.static('public'));

app.use(session({
    secret: 'workout-tracker-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // set to true if using https
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Database setup
const db = new sqlite3.Database('workout.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the workout database.');
});

// Initialize database
db.serialize(async () => {
    // Create users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT
        )
    `);

    // Create routines table
    db.run(`
        CREATE TABLE IF NOT EXISTS routines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);

    // Create exercises table
    db.run(`
        CREATE TABLE IF NOT EXISTS exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            routine_id INTEGER,
            name TEXT,
            sets INTEGER,
            reps INTEGER,
            weight REAL,
            duration INTEGER,
            notes TEXT,
            order_index INTEGER,
            FOREIGN KEY (routine_id) REFERENCES routines (id)
        )
    `);

    // Create workout sessions table
    db.run(`
        CREATE TABLE IF NOT EXISTS workout_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            routine_id INTEGER,
            start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            end_time DATETIME,
            status TEXT DEFAULT 'in_progress',
            notes TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (routine_id) REFERENCES routines (id)
        )
    `);

    // Create workout logs table
    db.run(`
        CREATE TABLE IF NOT EXISTS workout_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            exercise_id INTEGER,
            sets_completed INTEGER,
            reps_completed INTEGER,
            weight_used REAL,
            duration_seconds INTEGER,
            completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            FOREIGN KEY (session_id) REFERENCES workout_sessions (id),
            FOREIGN KEY (exercise_id) REFERENCES exercises (id)
        )
    `);

    try {
        // Check if admin user exists
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            // Create admin user if it doesn't exist
            const hashedPassword = await bcrypt.hash('admin', 10);
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)',
                    ['admin', hashedPassword, 'A'],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            });
            console.log('Admin user created successfully');
        }
    } catch (error) {
        console.error('Error initializing admin user:', error);
    }
});

// Validation functions
function validateUsername(username) {
    // Rules:
    // 1. 3-20 characters long
    // 2. Only letters, numbers, and underscores
    // 3. Must start with a letter
    // 4. No spaces
    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
    return usernameRegex.test(username);
}

function validatePassword(password) {
    // Rules:
    // 1. At least 8 characters long
    // 2. Contains at least one uppercase letter
    // 3. Contains at least one lowercase letter
    // 4. Contains at least one number
    // 5. No spaces
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*()_+]{8,}$/;
    return passwordRegex.test(password);
}

// Authentication middleware
const authenticateUser = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Admin middleware
const requireAdmin = (req, res, next) => {
    console.log('Checking admin auth, session:', req.session);
    if (req.session && req.session.userId && req.session.isAdmin) {
        next();
    } else {
        console.log('Admin auth failed');
        res.status(403).json({ error: 'Admin access required' });
    }
};

// Routes
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    // Validate input presence
    if (!username || !password) {
        return res.status(400).json({ 
            error: 'Username and password are required',
            field: !username ? 'username' : 'password'
        });
    }

    // Validate username format
    if (!validateUsername(username)) {
        return res.status(400).json({
            error: 'Username must be 3-20 characters long, start with a letter, and contain only letters, numbers, and underscores',
            field: 'username'
        });
    }

    // Validate password strength
    if (!validatePassword(password)) {
        return res.status(400).json({
            error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number',
            field: 'password'
        });
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create avatar from first letter of username
        const avatar = username.charAt(0).toUpperCase();

        // Insert user into database
        db.run(
            'INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)',
            [username, hashedPassword, avatar],
            function(err) {
                if (err) {
                    console.error('Registration error:', err);
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ 
                            error: 'Username already exists',
                            field: 'username'
                        });
                    }
                    return res.status(500).json({ error: 'Error registering user' });
                }
                res.json({ message: 'User registered successfully' });
            }
        );
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Error registering user' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        // Get user from database
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        console.log('Login attempt:', { username, foundUser: !!user });

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Compare passwords
        const validPassword = await bcrypt.compare(password, user.password);
        console.log('Password validation:', { valid: validPassword });

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Set user session
        req.session.userId = user.id;
        req.session.isAdmin = user.username === 'admin';

        // Return user info without password
        res.json({
            id: user.id,
            username: user.username,
            avatar: user.avatar || user.username.charAt(0).toUpperCase(),
            isAdmin: user.username === 'admin'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error. Please try again.' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

// Routine routes
app.get('/api/routines', authenticateUser, (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    db.all(`
        SELECT r.*, 
            (SELECT COUNT(*) FROM exercises e WHERE e.routine_id = r.id) as exercise_count 
        FROM routines r 
        WHERE r.user_id = ? 
        ORDER BY r.created_at DESC
    `, [req.session.userId], (err, routines) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to load routines' });
        }
        res.json(routines || []);
    });
});

app.get('/api/routines/:id', authenticateUser, (req, res) => {
    db.get('SELECT * FROM routines WHERE id = ? AND user_id = ?', 
        [req.params.id, req.session.userId], 
        (err, routine) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!routine) {
                return res.status(404).json({ error: 'Routine not found' });
            }
            
            db.all('SELECT * FROM exercises WHERE routine_id = ? ORDER BY order_index', 
                [routine.id], 
                (err, exercises) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    routine.exercises = exercises;
                    res.json(routine);
                });
        });
});

app.post('/api/routines', authenticateUser, (req, res) => {
    const { name, exercises } = req.body;
    
    if (!name || !exercises || !exercises.length) {
        return res.status(400).json({ error: 'Invalid routine data' });
    }
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run('INSERT INTO routines (user_id, name, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [req.session.userId, name],
            function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
                
                const routineId = this.lastID;
                let completed = 0;
                let failed = false;
                
                exercises.forEach((exercise, index) => {
                    const params = [
                        routineId,
                        exercise.name,
                        exercise.type === 'timed' ? null : exercise.sets,
                        exercise.type === 'timed' ? null : exercise.reps,
                        exercise.type === 'timed' ? null : exercise.weight,
                        exercise.type === 'timed' ? 
                            (exercise.unit === 'minutes' ? exercise.duration * 60 : exercise.duration) : null,
                        exercise.notes || '',
                        index
                    ];
                    
                    db.run(`INSERT INTO exercises (
                            routine_id, name, sets, reps, weight, duration, notes, order_index
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        params,
                        (err) => {
                            if (err && !failed) {
                                failed = true;
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: err.message });
                            }
                            
                            completed++;
                            if (completed === exercises.length && !failed) {
                                db.run('COMMIT');
                                res.json({ id: routineId });
                            }
                        }
                    );
                });
            }
        );
    });
});

app.delete('/api/routines/:id', authenticateUser, (req, res) => {
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run('DELETE FROM exercises WHERE routine_id = ?', [req.params.id], (err) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }
            
            db.run('DELETE FROM routines WHERE id = ? AND user_id = ?',
                [req.params.id, req.session.userId],
                function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }
                    
                    if (this.changes === 0) {
                        db.run('ROLLBACK');
                        return res.status(404).json({ error: 'Routine not found' });
                    }
                    
                    db.run('COMMIT');
                    res.json({ message: 'Routine deleted successfully' });
                });
        });
    });
});

// Workout routes
app.post('/api/workouts/start', authenticateUser, (req, res) => {
    const { routineId } = req.body;
    
    if (!routineId) {
        return res.status(400).json({ error: 'Routine ID is required' });
    }

    const userId = req.session.userId;
    const startTime = new Date().toISOString();

    // First, verify the routine exists and belongs to the user
    db.get(
        'SELECT * FROM routines WHERE id = ? AND user_id = ?',
        [routineId, userId],
        (err, routine) => {
            if (err) {
                console.error('Error checking routine:', err);
                return res.status(500).json({ error: 'Failed to start workout' });
            }

            if (!routine) {
                return res.status(404).json({ error: 'Routine not found' });
            }

            // Start a transaction to create the workout session
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Create the workout session
                db.run(
                    `INSERT INTO workout_sessions 
                    (user_id, routine_id, start_time, status) 
                    VALUES (?, ?, ?, ?)`,
                    [userId, routineId, startTime, 'in_progress'],
                    function(err) {
                        if (err) {
                            console.error('Error creating workout session:', err);
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Failed to start workout' });
                        }

                        const sessionId = this.lastID;

                        // Get all exercises for this routine
                        db.all(
                            'SELECT * FROM exercises WHERE routine_id = ? ORDER BY order_index',
                            [routineId],
                            (err, exercises) => {
                                if (err) {
                                    console.error('Error fetching exercises:', err);
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Failed to start workout' });
                                }

                                if (exercises.length === 0) {
                                    db.run('COMMIT');
                                    return res.json({
                                        sessionId,
                                        startTime,
                                        exercises: []
                                    });
                                }

                                let completedInserts = 0;
                                let hasError = false;

                                // Create exercise logs for each exercise
                                exercises.forEach((exercise) => {
                                    db.run(
                                        `INSERT INTO workout_logs 
                                        (session_id, exercise_id, sets_completed, reps_completed, weight_used, duration_seconds, completed_at, notes) 
                                        VALUES (?, ?, 0, 0, 0, 0, CURRENT_TIMESTAMP, '')`,
                                        [sessionId, exercise.id],
                                        (err) => {
                                            if (err && !hasError) {
                                                hasError = true;
                                                console.error('Error creating exercise log:', err);
                                                db.run('ROLLBACK');
                                                return res.status(500).json({ error: 'Failed to start workout' });
                                            }

                                            completedInserts++;
                                            if (completedInserts === exercises.length && !hasError) {
                                                db.run('COMMIT');
                                                res.json({
                                                    sessionId,
                                                    startTime,
                                                    exercises
                                                });
                                            }
                                        }
                                    );
                                });
                            }
                        );
                    }
                );
            });
        }
    );
});

app.post('/api/workouts/:sessionId/complete', authenticateUser, (req, res) => {
    const { sessionId } = req.params;
    const { duration, exerciseLogs } = req.body;
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(
            'UPDATE workout_sessions SET end_time = CURRENT_TIMESTAMP, status = "completed", total_duration = ? WHERE id = ? AND user_id = ?',
            [duration, sessionId, req.session.userId],
            function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
                
                if (this.changes === 0) {
                    db.run('ROLLBACK');
                    return res.status(404).json({ error: 'Workout session not found' });
                }
                
                let completed = 0;
                exerciseLogs.forEach(log => {
                    db.run(
                        'UPDATE workout_logs SET sets_completed = ?, reps_completed = ?, weight_used = ?, duration_seconds = ?, completed_at = ?, notes = ? WHERE session_id = ? AND exercise_id = ?',
                        [log.sets, log.reps, log.weight, log.duration, log.endTime, log.notes, sessionId, log.exerciseId],
                        (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: err.message });
                            }
                            
                            completed++;
                            if (completed === exerciseLogs.length) {
                                db.run('COMMIT');
                                res.json({ message: 'Workout completed successfully' });
                            }
                        }
                    );
                });
                
                if (exerciseLogs.length === 0) {
                    db.run('COMMIT');
                    res.json({ message: 'Workout completed successfully' });
                }
            }
        );
    });
});

app.get('/api/workouts/history', authenticateUser, (req, res) => {
    db.all(`
        SELECT 
            ws.id,
            ws.start_time,
            ws.end_time,
            ws.total_duration,
            r.name as routine_name,
            COUNT(wl.id) as total_exercises,
            SUM(CASE WHEN wl.sets_completed IS NOT NULL THEN 1 ELSE 0 END) as completed_exercises
        FROM workout_sessions ws
        JOIN routines r ON ws.routine_id = r.id
        LEFT JOIN workout_logs wl ON ws.id = wl.session_id
        WHERE ws.user_id = ? AND ws.status = "completed"
        GROUP BY ws.id
        ORDER BY ws.start_time DESC
    `, [req.session.userId], (err, workouts) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(workouts);
    });
});

// Admin routes
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        // Get users from database
        const users = await new Promise((resolve, reject) => {
            db.all('SELECT id, username, avatar FROM users', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        console.log('Admin: fetched users:', users);
        res.json(users);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Error getting users' });
    }
});

app.get('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id, username, avatar FROM users WHERE id = ?', [req.params.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Error getting user' });
    }
});

app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
    const { username, password } = req.body;
    const userId = req.params.id;

    try {
        // Don't allow changing admin username
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT username FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (user.username === 'admin' && username !== 'admin') {
            return res.status(400).json({ error: 'Cannot change admin username' });
        }

        // Update avatar if username changes
        const avatar = username.charAt(0).toUpperCase();

        if (password) {
            // If password is provided, update everything
            const hashedPassword = await bcrypt.hash(password, 10);
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET username = ?, password = ?, avatar = ? WHERE id = ?',
                    [username, hashedPassword, avatar, userId],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.changes);
                    }
                );
            });
        } else {
            // If no password, only update username and avatar
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET username = ?, avatar = ? WHERE id = ?',
                    [username, avatar, userId],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.changes);
                    }
                );
            });
        }

        res.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Error updating user:', error);
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Username already exists' });
        } else {
            res.status(500).json({ error: 'Error updating user' });
        }
    }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
    const { username, password } = req.body;
    
    // Validate input presence
    if (!username || !password) {
        return res.status(400).json({ 
            error: 'Username and password are required',
            field: !username ? 'username' : 'password'
        });
    }

    // Validate username format
    if (!validateUsername(username)) {
        return res.status(400).json({
            error: 'Username must be 3-20 characters long, start with a letter, and contain only letters, numbers, and underscores',
            field: 'username'
        });
    }

    // Validate password strength
    if (!validatePassword(password)) {
        return res.status(400).json({
            error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number',
            field: 'password'
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const avatar = username.charAt(0).toUpperCase();

        db.run(
            'INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)',
            [username, hashedPassword, avatar],
            function(err) {
                if (err) {
                    console.error('User creation error:', err);
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ 
                            error: 'Username already exists',
                            field: 'username'
                        });
                    }
                    return res.status(500).json({ error: 'Error creating user' });
                }
                res.json({ 
                    id: this.lastID,
                    username,
                    avatar
                });
            }
        );
    } catch (error) {
        console.error('User creation error:', error);
        res.status(500).json({ error: 'Error creating user' });
    }
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const userId = req.params.id;
    
    // Prevent deletion of admin user
    if (userId === '1') {
        return res.status(403).json({ error: 'Cannot delete admin user' });
    }
    
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json({ message: 'User deleted successfully' });
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
