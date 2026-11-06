const crypto = require('crypto');
const db = require('../db');
const passengerAuth = require('./passenger-auth');

const SESSION_COOKIE = 'cabflow_role_session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;
const sessions = new Map();
const loginAttempts = new Map();
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;
const DUMMY_SALT = 'cabflow-login-dummy-salt';

function authError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function parseCookies(header = '') {
    return header.split(';').reduce((cookies, part) => {
        const separator = part.indexOf('=');

        if (separator > 0) {
            cookies[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
        }

        return cookies;
    }, {});
}

function sessionCookie(token) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

function clearSessionCookie() {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function verifyPassword(password, storedPassword) {
    const [salt, storedHash] = String(storedPassword || '').split(':');

    if (!/^[a-f0-9]{32}$/i.test(salt || '') || !/^[a-f0-9]{128}$/i.test(storedHash || '')) {
        crypto.scryptSync(password, DUMMY_SALT, 64);
        return false;
    }

    const actualHash = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(actualHash, Buffer.from(storedHash, 'hex'));
}

function recordFailedAttempt(ipAddress) {
    const now = Date.now();

    for (const [address, attempt] of loginAttempts) {
        if (now - attempt.startedAt >= LOGIN_ATTEMPT_WINDOW_MS) {
            loginAttempts.delete(address);
        }
    }

    const attempt = loginAttempts.get(ipAddress);

    if (attempt && now - attempt.startedAt < LOGIN_ATTEMPT_WINDOW_MS) {
        attempt.count += 1;
    } else {
        loginAttempts.set(ipAddress, { startedAt: now, count: 1 });
    }
}

function checkLoginLimit(ipAddress) {
    const attempt = loginAttempts.get(ipAddress);

    if (attempt && Date.now() - attempt.startedAt < LOGIN_ATTEMPT_WINDOW_MS &&
        attempt.count >= MAX_LOGIN_ATTEMPTS) {
        throw authError('Too many sign-in attempts. Please wait 15 minutes and try again.', 429);
    }
}

function deleteExpiredSessions() {
    const now = Date.now();

    for (const [token, session] of sessions) {
        if (session.expiresAt <= now) {
            sessions.delete(token);
        }
    }
}

function startSession(user) {
    deleteExpiredSessions();

    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
        userId: user.user_id,
        role: user.role,
        expiresAt: Date.now() + SESSION_MAX_AGE_MS
    });

    return sessionCookie(token);
}

async function login(data, req) {
    const ipAddress = req.socket.remoteAddress || 'unknown';

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw authError('Enter your email address and password', 400);
    }

    const email = String(data.email || '').trim().toLowerCase();
    const requestedRole = String(data.role || '').trim().toUpperCase();
    const password = data.password;

    if (!['PASSENGER', 'DRIVER', 'ADMIN', 'SUPER ADMIN'].includes(requestedRole)) {
        throw authError('Choose a valid account type', 400);
    }

    if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 150 ||
        typeof password !== 'string' ||
        password.length < 8 ||
        Buffer.byteLength(password, 'utf8') > 128
    ) {
        throw authError('Enter a valid email address and password', 400);
    }

    const [accountRows] = await db.query(
        'SELECT role FROM users WHERE email = ? LIMIT 1',
        [email]
    );
    const accountRole = accountRows[0] && accountRows[0].role;

    if (accountRole !== requestedRole) {
        checkLoginLimit(ipAddress);
        verifyPassword(password, '');
        recordFailedAttempt(ipAddress);
        throw authError('Invalid email or password', 401);
    }

    if (requestedRole === 'PASSENGER') {
        const result = await passengerAuth.login({ email, password }, ipAddress);
        return {
            role: 'PASSENGER',
            user: result.passenger,
            cookies: [result.cookie, clearSessionCookie()]
        };
    }

    checkLoginLimit(ipAddress);
    const [rows] = await db.query(`
        SELECT
            u.user_id,
            u.name,
            u.email,
            u.password,
            u.role,
            u.status AS account_status,
            dp.driver_id,
            dp.verification_status
        FROM users u
        LEFT JOIN driver_profiles dp ON dp.user_id = u.user_id
        WHERE u.email = ?
            AND u.role = ?
        LIMIT 1
    `, [email, accountRole]);

    const user = rows[0];
    const passwordMatches = verifyPassword(password, user ? user.password : '');

    if (!user || !passwordMatches || user.account_status !== 'ACTIVE' ||
        (accountRole === 'DRIVER' && !user.driver_id)) {
        recordFailedAttempt(ipAddress);
        throw authError('Invalid email or password', 401);
    }

    if (accountRole === 'DRIVER' && user.verification_status !== 'APPROVED') {
        throw authError('Your driver account is awaiting approval', 403);
    }

    loginAttempts.delete(ipAddress);
    const sessionUser = {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        ...(user.driver_id ? { driver_id: user.driver_id } : {})
    };

    return {
        role: user.role,
        user: sessionUser,
        cookies: [startSession(sessionUser), passengerAuth.logout(req)]
    };
}

async function getRoleSession(req) {
    deleteExpiredSessions();

    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    const session = sessions.get(token);

    if (!session) {
        return null;
    }

    const [rows] = await db.query(`
        SELECT
            u.user_id,
            u.name,
            u.email,
            u.role,
            u.status AS account_status,
            dp.driver_id,
            dp.verification_status
        FROM users u
        LEFT JOIN driver_profiles dp ON dp.user_id = u.user_id
        WHERE u.user_id = ?
        LIMIT 1
    `, [session.userId]);

    const user = rows[0];
    if (!user || user.account_status !== 'ACTIVE' || user.role !== session.role ||
        (user.role === 'DRIVER' &&
            (!user.driver_id || user.verification_status !== 'APPROVED'))) {
        sessions.delete(token);
        return null;
    }

    return {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        ...(user.driver_id ? { driver_id: user.driver_id } : {})
    };
}

async function getSession(req) {
    const cookies = parseCookies(req.headers.cookie);

    if (cookies[SESSION_COOKIE]) {
        const user = await getRoleSession(req);
        return user ? { user, role: user.role } : null;
    }

    const passenger = await passengerAuth.getSession(req);
    return passenger ? { user: passenger, role: 'PASSENGER' } : null;
}

function logout(req) {
    deleteExpiredSessions();

    const token = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
    if (token) {
        sessions.delete(token);
    }

    return [
        passengerAuth.logout(req),
        clearSessionCookie()
    ];
}

module.exports = {
    login,
    getSession,
    getRoleSession,
    clearRoleSessionCookie: clearSessionCookie,
    logout
};
