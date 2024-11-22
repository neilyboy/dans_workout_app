// Global variables
let currentUser = null;
let users = [];
let routines = [];

// Utility functions
function validateUsername(username) {
    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
    return usernameRegex.test(username);
}

function validatePassword(password) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*()_+]{8,}$/;
    return passwordRegex.test(password);
}

function showError(inputElement, message) {
    if (!inputElement) return;
    
    const errorDiv = inputElement.parentElement.querySelector('.error-message') || 
                    document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.color = 'red';
    errorDiv.style.fontSize = '0.8em';
    errorDiv.style.marginTop = '5px';
    
    if (!inputElement.parentElement.querySelector('.error-message')) {
        inputElement.parentElement.appendChild(errorDiv);
    }
    inputElement.classList.add('error');
}

function clearError(inputElement) {
    if (!inputElement) return;
    
    const errorDiv = inputElement.parentElement.querySelector('.error-message');
    if (errorDiv) {
        errorDiv.remove();
    }
    inputElement.classList.remove('error');
}

// State management
let state = {
    user: null,
    currentRoutine: null,
    workoutInProgress: false,
    currentExerciseIndex: 0,
    exerciseLogs: []
};

// Get DOM elements
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authView = document.getElementById('auth-view');
const mainView = document.getElementById('main-view');
const userAvatar = document.getElementById('user-avatar');
const usernameDisplay = document.getElementById('username-display');
const logoutBtn = document.getElementById('logout-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const routinesList = document.getElementById('routines-list');

// Modal elements
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalConfirm = document.getElementById('modal-confirm');
const modalCancel = document.getElementById('modal-cancel');
const closeModal = document.querySelector('.close-modal');

// Modal functions
function showModal(title, content, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <h2>${title}</h2>
                <button type="button" class="btn-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button type="button" class="btn btn-primary" id="modal-confirm">Confirm</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Confirm button handler
    const confirmBtn = modal.querySelector('#modal-confirm');
    confirmBtn.addEventListener('click', async () => {
        if (onConfirm) {
            await onConfirm();
        }
        modal.remove();
    });
    
    return modal;
}

function hideModal() {
    modal.classList.add('hidden');
    modalTitle.textContent = '';
    modalBody.innerHTML = '';
    modalConfirm.onclick = null;
    modal.onclick = null;
}

// Authentication
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username.value,
                password: password.value
            }),
            credentials: 'include'
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log('Login successful:', data);
            currentUser = data;
            
            // Show main view and update UI
            showMainView();
            
            // Show admin dashboard button if user is admin
            const adminDashboardBtn = document.getElementById('admin-dashboard-btn');
            if (data.isAdmin) {
                adminDashboardBtn.classList.remove('hidden');
            } else {
                adminDashboardBtn.classList.add('hidden');
            }
            
            // Clear any error messages
            clearError(username);
            clearError(password);
        } else {
            showError(username, data.error || 'Invalid username or password');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError(username, 'An error occurred during login');
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            state.user = null;
            showAuthView();
        } else {
            throw new Error('Logout failed');
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out: ' + error.message);
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(registerForm);
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                username: formData.get('username'),
                password: formData.get('password')
            })
        });
        const data = await response.json();
        if (response.ok) {
            alert('Registration successful! Please login.');
            tabBtns[0].click();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Registration failed. Please try again.');
    }
});

// View management
function showView(viewName) {
    // Hide all content views
    document.querySelectorAll('.content-view').forEach(view => {
        view.classList.add('hidden');
    });

    // Show the selected view
    const selectedView = document.getElementById(`${viewName}-view`);
    if (selectedView) {
        selectedView.classList.remove('hidden');
    }

    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function showAuthView() {
    document.getElementById('auth-view').classList.remove('hidden');
    document.getElementById('main-view').classList.add('hidden');
}

function showMainView() {
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('main-view').classList.remove('hidden');

    // Show routines view by default
    showView('routines');

    // Load user data
    if (currentUser) {
        // Update user info
        document.getElementById('username-display').textContent = currentUser.username;
        const userAvatar = document.getElementById('user-avatar');
        userAvatar.textContent = currentUser.avatar;
        userAvatar.setAttribute('data-initial', currentUser.avatar);

        // Show/hide admin dashboard button
        const adminDashboardBtn = document.getElementById('admin-dashboard-btn');
        if (currentUser.isAdmin) {
            console.log('User is admin, showing dashboard button');
            adminDashboardBtn.classList.remove('hidden');
            // Load users for admin
            loadUsers();
        } else {
            console.log('User is not admin, hiding dashboard button');
            adminDashboardBtn.classList.add('hidden');
        }
    }
}

// Display functions
function displayUsers() {
    if (!currentUser?.isAdmin) return;

    const userList = document.getElementById('user-list');
    if (!userList) return;

    userList.innerHTML = users.map(user => `
        <div class="user-item" data-user-id="${user.id}">
            <div class="user-info">
                <div class="avatar" data-initial="${user.avatar}">${user.avatar}</div>
                <span class="user-name">${user.username}</span>
            </div>
            <div class="user-actions">
                <button onclick="editUser(${user.id})" class="btn-secondary">
                    <i class="material-icons">edit</i>
                </button>
                ${user.username !== 'admin' ? `
                    <button onclick="deleteUser(${user.id})" class="btn-danger">
                        <i class="material-icons">delete</i>
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Tab switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        // Update active tab button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Show/hide forms
        if (tab === 'login') {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        } else {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        }
    });
});

// Workout state
let activeWorkout = {
    sessionId: null,
    exercises: [],
    currentExerciseIndex: 0,
    startTime: null,
    exerciseLogs: [],
    isPaused: false,
    pauseStartTime: null,
    totalPauseDuration: 0
};

// Admin state
let isAdmin = false;

// DOM Elements
const navBtns = document.querySelectorAll('.nav-btn');
const contentViews = document.querySelectorAll('.content-view');
const addRoutineBtn = document.getElementById('add-routine-btn');
const masterTimerDisplay = document.getElementById('master-timer');
const currentExerciseCard = document.getElementById('current-exercise');
const pauseWorkoutBtn = document.getElementById('pause-workout');
const nextExerciseBtn = document.getElementById('next-exercise');
const completeWorkoutBtn = document.getElementById('complete-workout');

// Timer functions
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function playCountdownBeep() {
    const beep = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBkCU1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTqO0/DSeDAGIG7A7+OZRA0PVqzn77NdGQlBmNzzxnMpBSh8yu7ilUELFWS57OynUxILSaPi8751JgU8ktXwz3UsBylwxu3mmEINEVur6e6uWRYIP5bW886ALwUkecju55JCCxVns+vtqVIRCkqh4vO8dSYFPZLV8M91LAcpccbt5phCDRFbq+nurVkWCD+W1vPOgC8FJHXI7ueRQgsWZ7Pr7alSEQpKoeLzvXUmBT2S1fDPdSwHKXHG7eaYQg0RW6vp7q1ZFgg/ltbzzoAvBSR1yO7nkUILFmez6+2pUhEKSqHi8711JgU9ktXwz3UsBylxxu3mmEINEVur6e6tWRYIP5bW886ALwUkdcju55FCCxZns+vtqVIRCkqh4vO9dSYFPZLV8M91LAcpccbt5phCDRFbq+nurVkWCD+W1vPOgC8FJHXI7ueRQgsWZ7Pr7alSEQpKoeLzvXUmBT2S1fDPdSwHKXHG7eaYQg0RW6vp7q1ZFgg/ltbzzoAvBSR1yO7nkUILFmez6+2pUhEKSqHi8711JgU9ktXwz3UsBylxxu3mmEINEVur6e6tWRYIP5bW886ALwUkdcju55FCCxZns+vtqVIRCkqh4vO9dSYFPZLV8M91LAcpccbt5phCDRFbq+nurVkWCD+W1vPOgC8FJHXI7ueRQgsWZ7Pr7alSEQpKoeLzvXUmBT2S1fDPdSwHKXHG7eaYQg0RW6vp7q1ZFgg/ltbzzoAvBSR1yO7nkUILFmez6+2pUhEKSqHi8711JgU9ktXwz3UsBylxxu3mmEINEVur6e6tWRYIP5bW886ALwUkdcju55FCCxZns+vtqVIRCkqh4vO9dSYFPZLV8M91LAcpccbt5phCDRFbq+nurVkWCD+W1vPOgC8FJHXI7ueRQgsWZ7Pr7alSEQo=');
    beep.play().catch(err => console.log('Audio play failed:', err));
}

function startExerciseTimer(exercise) {
    const timerDisplay = document.getElementById('exercise-timer');
    let timeLeft = exercise.target_value;
    let isCountingDown = false;

    // Clear any existing timer
    if (state.exerciseTimer) {
        clearInterval(state.exerciseTimer);
    }

    state.exerciseTimer = setInterval(() => {
        if (activeWorkout.isPaused) return;

        timeLeft--;
        timerDisplay.textContent = formatTime(timeLeft);

        // Start countdown beeps at 10 seconds remaining
        if (timeLeft <= 10 && !isCountingDown) {
            isCountingDown = true;
            playCountdownBeep();
        } else if (timeLeft <= 10) {
            playCountdownBeep();
        }

        if (timeLeft <= 0) {
            clearInterval(state.exerciseTimer);
            playCountdownBeep(); // Final beep
            
            // Log the completed exercise
            logExercise(exercise.target_value);

            // Move to next exercise or complete workout
            if (activeWorkout.currentExerciseIndex < activeWorkout.exercises.length - 1) {
                activeWorkout.currentExerciseIndex++;
                showCurrentExercise();
            } else {
                completeWorkout();
            }
        }
    }, 1000);
}

function showCurrentExercise() {
    const exercise = activeWorkout.exercises[activeWorkout.currentExerciseIndex];
    const exerciseCard = document.getElementById('current-exercise');
    
    exerciseCard.innerHTML = `
        <h3>${exercise.name}</h3>
        <div class="exercise-details">
            ${exercise.type === 'time' ? `
                <div class="exercise-timer" id="exercise-timer">${formatTime(exercise.target_value)}</div>
                <div class="progress-bar">
                    <div class="progress" style="width: 0%"></div>
                </div>
            ` : `
                <div class="rep-counter">
                    <button onclick="decrementReps()">-</button>
                    <div class="rep-count" id="rep-count">0</div>
                    <button onclick="incrementReps()">+</button>
                </div>
                <div class="target-reps">Target: ${exercise.target_value} reps</div>
            `}
        </div>
    `;

    // Update progress
    const progress = ((activeWorkout.currentExerciseIndex) / activeWorkout.exercises.length) * 100;
    document.querySelector('.progress').style.width = `${progress}%`;

    // Automatically start timer for timed exercises
    if (exercise.type === 'time') {
        // Small delay to ensure the DOM is updated
        setTimeout(() => {
            startExerciseTimer(exercise);
        }, 100);
    } else {
        currentReps = 0;
        document.getElementById('rep-count').textContent = currentReps;
    }
}

// Workout management
async function loadRoutines() {
    try {
        const response = await fetch('/api/routines', {
            credentials: 'include'
        });
        const routines = await response.json();
        
        if (routines.length === 0) {
            routinesList.innerHTML = `
                <div class="empty-state">
                    <i class="material-icons">fitness_center</i>
                    <p>No routines yet. Create your first workout routine!</p>
                </div>
            `;
            return;
        }
        
        routinesList.innerHTML = routines.map(routine => `
            <div class="list-item routine-item">
                <div class="routine-info">
                    <h3>${routine.name}</h3>
                    <p>${routine.created_at ? new Date(routine.created_at).toLocaleDateString() : ''}</p>
                </div>
                <div class="routine-actions">
                    <button onclick="startWorkout(${routine.id})" class="btn-primary">
                        <i class="material-icons">play_circle</i>
                        Start
                    </button>
                    <button onclick="editRoutine(${routine.id})" class="btn-secondary">
                        <i class="material-icons">edit</i>
                        Edit
                    </button>
                    <button onclick="deleteRoutine(${routine.id})" class="btn-danger">
                        <i class="material-icons">delete</i>
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        alert('Failed to load routines');
    }
}

async function startWorkout(routineId) {
    try {
        const response = await fetch('/api/workouts/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ routineId })
        });

        if (!response.ok) {
            throw new Error('Failed to start workout');
        }

        const data = await response.json();
        
        // Initialize workout state
        activeWorkout = {
            id: data.workoutId,
            routineId: routineId,
            exercises: data.exercises,
            currentExerciseIndex: 0,
            exerciseLogs: [],
            isPaused: false,
            totalPauseDuration: 0,
            startTime: Date.now()
        };

        // Show workout view and start timers
        document.getElementById('routine-list-view').classList.add('hidden');
        document.getElementById('workout-view').classList.remove('hidden');
        
        // Initialize and start the master timer
        const masterTimerDisplay = document.getElementById('master-timer');
        startTimer(masterTimerDisplay);
        
        // Show and start the first exercise
        showCurrentExercise();

    } catch (error) {
        console.error('Error starting workout:', error);
        alert('Failed to start workout: ' + error.message);
    }
}

function startTimer(display) {
    let startTime = Date.now();
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!activeWorkout.isPaused) {
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            display.textContent = formatTime(elapsedSeconds);
        }
    }, 1000);
}

let timerInterval;

// Exercise management
function logExercise(value) {
    const exercise = activeWorkout.exercises[activeWorkout.currentExerciseIndex];
    activeWorkout.exerciseLogs.push({
        exerciseId: exercise.id,
        value: value,
        startTime: new Date(Date.now() - (value * 1000)).toISOString(),
        endTime: new Date().toISOString()
    });
}

async function completeWorkout() {
    try {
        clearInterval(timerInterval);
        const duration = Math.floor((Date.now() - activeWorkout.startTime) / 1000) - activeWorkout.totalPauseDuration;
        
        const response = await fetch(`/api/workouts/${activeWorkout.id}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                duration: duration,
                exerciseLogs: activeWorkout.exerciseLogs
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to complete workout');
        }
        
        showWorkoutSummary(duration);
        
    } catch (error) {
        alert('Failed to save workout: ' + error.message);
    }
}

function showWorkoutSummary(duration) {
    const workoutView = document.getElementById('workout-view');
    workoutView.innerHTML = `
        <div class="workout-summary">
            <h2>Workout Complete!</h2>
            <div class="summary-stats">
                <div class="stat">
                    <span class="label">Duration</span>
                    <span class="value">${formatTime(duration)}</span>
                </div>
                <div class="stat">
                    <span class="label">Exercises</span>
                    <span class="value">${activeWorkout.exercises.length}</span>
                </div>
            </div>
            <button onclick="showRoutinesView()" class="btn-primary">
                <i class="material-icons">home</i>
                Back to Routines
            </button>
        </div>
    `;
}

// Workout controls
document.getElementById('pause-workout').addEventListener('click', function() {
    const button = this;
    if (activeWorkout.isPaused) {
        activeWorkout.totalPauseDuration += Math.floor((Date.now() - activeWorkout.pauseStartTime) / 1000);
        activeWorkout.isPaused = false;
        button.innerHTML = '<i class="material-icons">pause</i> Pause';
    } else {
        activeWorkout.isPaused = true;
        activeWorkout.pauseStartTime = Date.now();
        button.innerHTML = '<i class="material-icons">play_arrow</i> Resume';
    }
});

document.getElementById('complete-workout').addEventListener('click', () => {
    if (confirm('Are you sure you want to end this workout?')) {
        completeWorkout();
    }
});

// Routine creation
async function addRoutine() {
    const formHTML = `
        <form id="add-routine-form" class="modal-form">
            <div class="form-group">
                <label for="routine-name">Routine Name</label>
                <input type="text" id="routine-name" name="name" required>
            </div>
            <div id="exercises-list" class="exercises-list">
                <!-- Exercise items will be added here -->
            </div>
            <button type="button" class="btn btn-secondary" onclick="addExerciseField()">
                <i class="material-icons">add</i> Add Exercise
            </button>
        </form>
    `;

    showModal('Create New Routine', formHTML, async () => {
        const form = document.getElementById('add-routine-form');
        const exercises = Array.from(document.querySelectorAll('.exercise-item')).map(item => {
            const exerciseType = item.querySelector('select[name="type"]').value;
            const data = {
                name: item.querySelector('input[name="name"]').value,
                type: exerciseType,
                notes: item.querySelector('textarea[name="notes"]').value || ''
            };

            if (exerciseType === 'timed') {
                data.duration = parseInt(item.querySelector('input[name="duration"]').value);
                data.unit = item.querySelector('select[name="timeUnit"]').value;
            } else {
                data.sets = parseInt(item.querySelector('input[name="sets"]').value);
                data.reps = parseInt(item.querySelector('input[name="reps"]').value);
                data.weight = parseFloat(item.querySelector('input[name="weight"]').value) || 0;
            }

            return data;
        });

        const routineData = {
            name: document.getElementById('routine-name').value,
            exercises: exercises
        };

        try {
            const response = await fetch('/api/routines', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(routineData)
            });

            if (!response.ok) {
                throw new Error('Failed to create routine');
            }

            loadRoutines();
            alert('Routine created successfully!');
        } catch (error) {
            console.error('Error creating routine:', error);
            alert('Failed to create routine: ' + error.message);
        }
    });

    // Add the first exercise field automatically
    addExerciseField();
}

function addExerciseField() {
    const exercisesList = document.getElementById('exercises-list');
    const exerciseItem = document.createElement('div');
    exerciseItem.className = 'exercise-item';
    exerciseItem.innerHTML = `
        <div class="exercise-header">
            <h4>Exercise ${exercisesList.children.length + 1}</h4>
            <button type="button" class="btn-icon btn-danger" onclick="removeExercise(this)" aria-label="Remove Exercise">
                <i class="material-icons">delete</i>
            </button>
        </div>
        <div class="form-group">
            <input type="text" name="name" placeholder="Exercise Name" required class="form-control">
        </div>
        <div class="form-group">
            <label>Exercise Type</label>
            <select name="type" class="form-control" onchange="toggleExerciseFields(this)">
                <option value="reps">Sets & Reps</option>
                <option value="timed">Timed</option>
            </select>
        </div>
        <div class="exercise-details reps-based">
            <div class="form-row">
                <div class="form-group">
                    <input type="number" name="sets" placeholder="Sets" required min="1" class="form-control">
                </div>
                <div class="form-group">
                    <input type="number" name="reps" placeholder="Reps" required min="1" class="form-control">
                </div>
                <div class="form-group">
                    <input type="number" name="weight" placeholder="Weight (optional)" step="0.5" class="form-control">
                </div>
            </div>
        </div>
        <div class="exercise-details timed-based hidden">
            <div class="form-row">
                <div class="form-group flex-2">
                    <input type="number" name="duration" placeholder="Duration" required min="1" class="form-control">
                </div>
                <div class="form-group">
                    <select name="timeUnit" class="form-control">
                        <option value="seconds">Seconds</option>
                        <option value="minutes">Minutes</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="form-group">
            <textarea name="notes" placeholder="Notes (optional)" class="form-control"></textarea>
        </div>
    `;
    exercisesList.appendChild(exerciseItem);
}

function toggleExerciseFields(select) {
    const exerciseItem = select.closest('.exercise-item');
    const repsBased = exerciseItem.querySelector('.reps-based');
    const timedBased = exerciseItem.querySelector('.timed-based');
    
    if (select.value === 'timed') {
        repsBased.classList.add('hidden');
        timedBased.classList.remove('hidden');
        // Clear and disable reps-based inputs
        repsBased.querySelectorAll('input').forEach(input => {
            input.value = '';
            input.required = false;
        });
        // Enable timed-based inputs
        timedBased.querySelectorAll('input').forEach(input => {
            input.required = true;
        });
    } else {
        repsBased.classList.remove('hidden');
        timedBased.classList.add('hidden');
        // Clear and disable timed-based inputs
        timedBased.querySelectorAll('input').forEach(input => {
            input.value = '';
            input.required = false;
        });
        // Enable reps-based inputs
        repsBased.querySelectorAll('input[name="sets"], input[name="reps"]').forEach(input => {
            input.required = true;
        });
    }
}

// Add event listener for the add routine button
document.getElementById('add-routine-btn').addEventListener('click', addRoutine);

// Admin dashboard functionality
function showAdminDashboard() {
    // Hide all content views
    document.querySelectorAll('.content-view').forEach(view => {
        view.classList.add('hidden');
    });

    // Show admin dashboard
    const adminDashboard = document.getElementById('admin-dashboard');
    adminDashboard.classList.remove('hidden');

    // Load users
    loadUsers();
}

async function loadUsers() {
    if (!currentUser?.isAdmin) return;

    try {
        const response = await fetch('/api/admin/users', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load users');
        }

        const data = await response.json();
        users = data;
        console.log('Loaded users:', users);
        displayUsers();
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Login form submission
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    
    // Clear previous errors
    clearError(username);
    clearError(password);
    
    // Validate username
    if (!username.value) {
        showError(username, 'Username is required');
        return;
    }
    
    // Validate password
    if (!password.value) {
        showError(password, 'Password is required');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username.value.trim(),
                password: password.value
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            showError(username, data.error || 'Login failed');
            return;
        }

        // Store user data
        currentUser = data;
        console.log('Login successful:', currentUser);

        // Update UI based on user role
        document.getElementById('username-display').textContent = currentUser.username;
        document.getElementById('user-avatar').textContent = currentUser.avatar;

        if (currentUser.isAdmin) {
            // Show admin dashboard
            document.getElementById('admin-dashboard').classList.remove('hidden');
            loadUsers();
        }

        // Show main view and hide auth view
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('main-view').classList.remove('hidden');
        
        // Show routines view by default
        showView('routines');
        loadRoutines();
    } catch (error) {
        console.error('Login error:', error);
        showError(username, 'An error occurred during login');
    }
});

// Registration form submission
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('register-username');
    const password = document.getElementById('register-password');
    const confirmPassword = document.getElementById('confirm-password');
    
    // Clear previous errors
    clearError(username);
    clearError(password);
    clearError(confirmPassword);
    
    // Validate username format
    if (!validateUsername(username.value)) {
        showError(username, 'Username must be 3-20 characters long, start with a letter, and contain only letters, numbers, and underscores');
        return;
    }
    
    // Validate password strength
    if (!validatePassword(password.value)) {
        showError(password, 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number');
        return;
    }
    
    // Validate password confirmation
    if (password.value !== confirmPassword.value) {
        showError(confirmPassword, 'Passwords do not match');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username.value.trim(),
                password: password.value
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            if (data.field === 'username') {
                showError(username, data.error);
            } else if (data.field === 'password') {
                showError(password, data.error);
            } else {
                showError(username, data.error || 'Registration failed');
            }
            return;
        }

        // Show success message and redirect to login
        alert('Registration successful! Please log in.');
        window.location.href = '/login';
    } catch (error) {
        showError(username, 'An error occurred during registration');
    }
});

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    showAuthView();
});

// Event listeners for navigation
document.addEventListener('DOMContentLoaded', () => {
    // Bottom navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const viewName = btn.dataset.view;
            showView(viewName);
            // Hide admin dashboard when switching views
            document.getElementById('admin-dashboard').classList.add('hidden');
        });
    });

    // Admin dashboard button
    document.getElementById('admin-dashboard-btn')?.addEventListener('click', () => {
        if (currentUser?.isAdmin) {
            showAdminDashboard();
        }
    });

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                currentUser = null;
                showAuthView();
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
});
