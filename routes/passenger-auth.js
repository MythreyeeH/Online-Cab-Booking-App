const crypto = require('crypto');
const db = require('../db');

const SESSION_COOKIE = 'cabflow_passenger_session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;
const sessions = new Map();
const loginAttempts = new Map();
const dummySalt = 'cabflow-login-dummy-salt';
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;

function authError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function required(value, field) {
    if (value === undefined || value === null || String(value).trim() === '') {
        throw authError(`${field} is required`, 400);
    }

    return String(value).trim();
}

function validatePassword(password) {
    if (typeof password !== 'string' || password.length < 8) {
        throw authError('Password must be at least 8 characters long', 400);
    }

    if (Buffer.byteLength(password, 'utf8') > 128) {
        throw authError('Password must be no more than 128 bytes', 400);
    }

    return password;
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
    const [salt, storedHash] = String(storedPassword || '').split(':');

    if (!/^[a-f0-9]{32}$/i.test(salt || '') || !/^[a-f0-9]{128}$/i.test(storedHash || '')) {
        crypto.scryptSync(password, dummySalt, 64);
        return false;
    }

    const actualHash = crypto.scryptSync(password, salt, 64);
    const expectedHash = Buffer.from(storedHash, 'hex');

    return crypto.timingSafeEqual(actualHash, expectedHash);
}

function parseCookies(header = '') {
    return header.split(';').reduce((cookies, part) => {
        const separator = part.indexOf('=');

        if (separator > 0) {
            const name = part.slice(0, separator).trim();
            const value = part.slice(separator + 1).trim();
            cookies[name] = value;
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

function deleteExpiredSessions() {
    const now = Date.now();

    for (const [token, session] of sessions) {
        if (session.expiresAt <= now) {
            sessions.delete(token);
        }
    }
}

function startSession(userId, passengerId) {
    deleteExpiredSessions();

    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
        userId,
        passengerId,
        expiresAt: Date.now() + SESSION_MAX_AGE_MS
    });

    return {
        cookie: sessionCookie(token),
        session: {
            user_id: userId,
            passenger_id: passengerId
        }
    };
}

async function register(data) {
    const name = required(data.name, 'Name');
    const email = required(data.email, 'Email').toLowerCase();
    const mobile = required(data.mobile, 'Mobile number');
    const password = validatePassword(data.password);

    if (name.length > 100) {
        throw authError('Name must be 100 characters or fewer', 400);
    }

    if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw authError('Enter a valid email address', 400);
    }

    if (mobile.length > 20) {
        throw authError('Mobile number must be 20 characters or fewer', 400);
    }

    const defaultAddress = data.default_address == null
        ? null
        : String(data.default_address).trim();

    if (defaultAddress && defaultAddress.length > 255) {
        throw authError('Default address must be 255 characters or fewer', 400);
    }

    const emergencyContact = data.emergency_contact == null
        ? null
        : String(data.emergency_contact).trim();

    if (emergencyContact && emergencyContact.length > 20) {
        throw authError('Emergency contact must be 20 characters or fewer', 400);
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [userResult] = await connection.query(`
            INSERT INTO users (name, email, password, mobile, role, status)
            VALUES (?, ?, ?, ?, 'PASSENGER', 'ACTIVE')
        `, [name, email, hashPassword(password), mobile]);

        const [profileResult] = await connection.query(`
            INSERT INTO passenger_profiles
                (user_id, default_address, emergency_contact)
            VALUES (?, ?, ?)
        `, [
            userResult.insertId,
            defaultAddress,
            emergencyContact
        ]);

        await connection.commit();

        return {
            passenger: {
                user_id: userResult.insertId,
                passenger_id: profileResult.insertId,
                name,
                email,
                mobile,
                default_address: defaultAddress
            },
            ...startSession(userResult.insertId, profileResult.insertId)
        };
    } catch (error) {
        await connection.rollback();

        if (error.code === 'ER_DUP_ENTRY') {
            throw authError('An account already exists for that email address', 409);
        }

        throw error;
    } finally {
        connection.release();
    }
}

async function login(data, ipAddress = 'unknown') {
    const email = required(data.email, 'Email').toLowerCase();
    const password = validatePassword(data.password);

    const now = Date.now();

    for (const [address, attempt] of loginAttempts) {
        if (now - attempt.startedAt >= LOGIN_ATTEMPT_WINDOW_MS) {
            loginAttempts.delete(address);
        }
    }

    const attempts = loginAttempts.get(ipAddress);

    if (attempts && now - attempts.startedAt < LOGIN_ATTEMPT_WINDOW_MS) {
        if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
            throw authError('Too many sign-in attempts. Please wait 15 minutes and try again.', 429);
        }
    } else {
        loginAttempts.delete(ipAddress);
    }

    if (email.length > 150) {
        throw authError('Invalid email or password', 401);
    }

    const [rows] = await db.query(`
        SELECT
            u.user_id,
            u.name,
            u.email,
            u.mobile,
            u.password,
            u.status AS account_status,
            pp.passenger_id,
            pp.default_address,
            pp.emergency_contact
        FROM users u
        JOIN passenger_profiles pp ON pp.user_id = u.user_id
        WHERE u.email = ?
            AND u.role = 'PASSENGER'
        LIMIT 1
    `, [email]);

    const user = rows[0];
    const passwordMatches = verifyPassword(
        password,
        user ? user.password : ''
    );

    if (!user || !passwordMatches || user.account_status !== 'ACTIVE') {
        const currentAttempts = loginAttempts.get(ipAddress);
        loginAttempts.set(ipAddress, {
            startedAt: currentAttempts && now - currentAttempts.startedAt < LOGIN_ATTEMPT_WINDOW_MS
                ? currentAttempts.startedAt
                : now,
            count: currentAttempts && now - currentAttempts.startedAt < LOGIN_ATTEMPT_WINDOW_MS
                ? currentAttempts.count + 1
                : 1
        });
        throw authError('Invalid email or password', 401);
    }

    loginAttempts.delete(ipAddress);

    return {
        passenger: {
            user_id: user.user_id,
            passenger_id: user.passenger_id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            default_address: user.default_address,
            emergency_contact: user.emergency_contact
        },
        ...startSession(user.user_id, user.passenger_id)
    };
}

async function getSession(req) {
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
            u.mobile,
            u.status AS account_status,
            pp.passenger_id,
            pp.default_address,
            pp.emergency_contact
        FROM users u
        JOIN passenger_profiles pp ON pp.user_id = u.user_id
        WHERE u.user_id = ?
            AND u.role = 'PASSENGER'
            AND u.status = 'ACTIVE'
        LIMIT 1
    `, [session.userId]);

    if (!rows.length || rows[0].passenger_id !== session.passengerId) {
        sessions.delete(token);
        return null;
    }

    return {
        user_id: rows[0].user_id,
        passenger_id: rows[0].passenger_id,
        name: rows[0].name,
        email: rows[0].email,
        mobile: rows[0].mobile,
        default_address: rows[0].default_address,
        emergency_contact: rows[0].emergency_contact
    };
}

function logout(req) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];

    if (token) {
        sessions.delete(token);
    }

    return clearSessionCookie();
}

module.exports = {
    register,
    login,
    getSession,
    logout
};
